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
 * There is no "on failure" hook in Better Auth, so the attempt is recorded
 * pessimistically in the `before` hook and withdrawn in the `after` hook once
 * the sign-in is known to have worked. Over-counting then only happens if a
 * request dies between the two, and over-counting fails closed.
 *
 * It also means the count is kept for callers that never touch our Server
 * Actions — anything POSTing straight to `/api/auth/sign-in/email`.
 *
 * ## The `after` hook must check whether the endpoint actually succeeded
 *
 * Session 2 assumed reaching an `after` hook was itself proof of success,
 * because a thrown endpoint would skip it. **That is not how Better Auth
 * behaves.** `dispatch.mjs` catches an `APIError`, turns it into a result, and
 * runs the `after` hooks anyway:
 *
 *     const result = await endpoint(ctx).catch((e) => {
 *       if (isAPIError(e)) return { response: e, status: e.statusCode, … };
 *       throw e;
 *     });
 *     internalContext.context.returned = result.response;
 *     const after = await runAfterHooks(…);
 *
 * So the unguarded version ran `clearFailures()` on every *failed* sign-in —
 * deleting the pessimistic row and writing a success in its place. The ledger
 * recorded failures as successes and the lockout could never fire: there was
 * no brute-force protection at all. Found by probing the deployed app in
 * session 3 (three wrong passwords, three `succeeded = 1` rows), which is
 * precisely what a test that has never run cannot tell you.
 *
 * The failure is visible on the context: `ctx.context.returned` carries the
 * `APIError` instead of the endpoint's body. `signInSucceeded()` below is the
 * guard, and it is a pure function so the rule is unit-tested rather than
 * re-derived from a deployment.
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
  /** Better Auth puts the endpoint's body — or its `APIError` — here. */
  context?: { returned?: unknown } | undefined;
};

/**
 * Whether the sign-in endpoint actually succeeded.
 *
 * Reads `ctx.context.returned`: the endpoint's body on success, an `APIError`
 * on failure. Three checks rather than one `instanceof`, because the identity
 * of the `APIError` class is not guaranteed across module instances and an
 * authorization ledger is the wrong place to rely on it:
 *
 *   1. `instanceof APIError` — the normal case.
 *   2. A numeric `statusCode` of 400 or more — any error-shaped result.
 *   3. A `code`/`message` pair with no body — belt and braces.
 *
 * A missing `returned` is treated as **success**, deliberately. Better Auth
 * always sets it, so the only way to get here without one is a shape change in
 * a future version — and in that case leaving the pessimistic row behind would
 * lock a legitimate user out after five ordinary sign-ins. A silent lockout of
 * real users is a worse failure than a silent loss of lockout, because the
 * second is still caught by `assertSignInAllowed` refusing a locked account.
 */
export function signInSucceeded(ctx: SignInHookContext): boolean {
  const returned = ctx.context?.returned;
  if (returned === undefined || returned === null) return true;
  if (returned instanceof APIError) return false;
  if (typeof returned !== "object") return true;

  const shape = returned as { statusCode?: unknown; status?: unknown; code?: unknown };
  if (typeof shape.statusCode === "number" && shape.statusCode >= 400) return false;
  if (typeof shape.status === "number" && shape.status >= 400) return false;
  // `APIError` carries `status` as a name — "UNAUTHORIZED", "BAD_REQUEST".
  if (typeof shape.status === "string" && shape.status !== "OK" && typeof shape.code === "string") {
    return false;
  }
  return true;
}

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
 * `after /sign-in/email`: withdraw the pessimistic failure, but **only** when
 * the endpoint really succeeded.
 *
 * The hook runs whether the sign-in worked or not — see the note at the top of
 * this file — so the guard is what makes the ledger mean anything. A failure
 * leaves the `before` hook's row exactly where it is, which is what lets five
 * consecutive failures add up to a lock.
 *
 * Success includes the 2FA branch, where no session is issued yet: the password
 * was still correct, so the budget is still cleared.
 */
export async function recordSignInSuccess(ctx: SignInHookContext): Promise<void> {
  const email = emailFromBody(ctx.body);
  if (!email) return;
  if (!signInSucceeded(ctx)) return;

  await clearFailures(email);
  await record({ email, succeeded: true, headers: ctx.headers ?? new Headers() });
}
