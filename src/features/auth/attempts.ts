import { randomUUID } from "node:crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db } from "@/db";
import { loginAttempt } from "@/db/schema";
import { securityPolicy } from "@/lib/policy";
import { clientIp } from "./device";
import { evaluateLockout, minutesUntil, type LockoutState } from "./lockout";

/**
 * The sign-in attempt ledger.
 *
 * `evaluateLockout` in `./lockout.ts` holds the rule; this file holds its
 * storage and the two Better Auth hooks that apply it.
 *
 * ## Why the failure is recorded *before* the password is checked
 *
 * Better Auth throws on invalid credentials, and a thrown endpoint skips the
 * `after` hooks — so there is no "on failure" hook to write to. Recording the
 * attempt pessimistically in the `before` hook and clearing it in the `after`
 * hook inverts that problem into a safe one: the ledger over-counts only if a
 * request dies between the two, and over-counting fails closed.
 *
 * It also means the count is kept for callers that never touch our Server
 * Actions — anything POSTing straight to `/api/auth/sign-in/email`.
 *
 * ## Why the ledger is keyed by email and not by user
 *
 * An attempt against an address with no account has to be counted too.
 * Skipping those would make a lockout the answer to "does this account exist?",
 * which is precisely what the login screen's single neutral error message
 * exists to prevent.
 */

/** Raised when the account is locked. Carries the release time for the copy. */
export const ACCOUNT_LOCKED = "ACCOUNT_LOCKED";

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The attempts that could still count toward a lock: at most the policy's
 * budget, newest first. Anything older cannot influence the verdict, because a
 * lock needs `loginMaxFailedAttempts` *consecutive* failures.
 */
async function recentAttempts(email: string) {
  const policy = securityPolicy();
  // A lock never lasts longer than its duration, so failures older than the
  // window plus a margin cannot matter. Bounding the scan keeps it on the
  // (email, attempted_at) index instead of walking a hot account's history.
  const horizon = new Date(Date.now() - policy.loginLockoutMinutes * 2 * 60 * 1000);

  return db()
    .select({ succeeded: loginAttempt.succeeded, attemptedAt: loginAttempt.attemptedAt })
    .from(loginAttempt)
    .where(and(eq(loginAttempt.email, email), gte(loginAttempt.attemptedAt, horizon)))
    .orderBy(desc(loginAttempt.attemptedAt))
    .limit(policy.loginMaxFailedAttempts);
}

export async function lockoutFor(email: string): Promise<LockoutState> {
  return evaluateLockout(await recentAttempts(normaliseEmail(email)));
}

async function record({
  email,
  succeeded,
  headers,
}: {
  email: string;
  succeeded: boolean;
  headers: Headers;
}): Promise<void> {
  await db()
    .insert(loginAttempt)
    .values({
      id: randomUUID(),
      email: normaliseEmail(email),
      succeeded,
      ipAddress: clientIp(headers),
      userAgent: headers.get("user-agent"),
    });
}

/** Clears the failure budget. A success means the account is not under attack. */
async function clearFailures(email: string): Promise<void> {
  await db()
    .delete(loginAttempt)
    .where(and(eq(loginAttempt.email, normaliseEmail(email)), eq(loginAttempt.succeeded, false)));
}

/* -------------------------------------------------------------------------- */
/*  Hook bodies                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `ctx.body` is typed as the union of every endpoint's body, so it is narrowed
 * here rather than asserted. A body without a usable email is left to Better
 * Auth's own validation.
 */
function emailFromBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const email = (body as { email?: unknown }).email;
  return typeof email === "string" && email.length > 0 ? email : null;
}

type SignInHookContext = {
  body?: unknown;
  headers?: Headers | undefined;
};

/**
 * `before /sign-in/email`: refuse a locked account, then count the attempt.
 *
 * The thrown message is the *same* one an unknown email produces, and carries
 * no hint about whether the account exists — only how long the wait is, which
 * the attacker already knows from the policy.
 */
export async function assertSignInAllowed(ctx: SignInHookContext): Promise<void> {
  const email = emailFromBody(ctx.body);
  if (!email) return;

  const headers = ctx.headers ?? new Headers();
  const state = await lockoutFor(email);

  if (state.locked) {
    throw new APIError("TOO_MANY_REQUESTS", {
      code: ACCOUNT_LOCKED,
      message: `Account temporarily locked. Try again in ${minutesUntil(state.until)} minutes.`,
      minutesRemaining: minutesUntil(state.until),
    });
  }

  await record({ email, succeeded: false, headers });
}

/**
 * `after /sign-in/email`: the hook only runs when the endpoint did not throw,
 * so reaching it *is* the proof that the password was correct — including on
 * the 2FA branch, where no session is issued yet.
 */
export async function recordSignInSuccess(ctx: SignInHookContext): Promise<void> {
  const email = emailFromBody(ctx.body);
  if (!email) return;

  await clearFailures(email);
  await record({ email, succeeded: true, headers: ctx.headers ?? new Headers() });
}
