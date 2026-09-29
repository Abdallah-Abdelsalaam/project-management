import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { db } from "@/db";
import { account, passwordHistory, trustedDevice, user, verification } from "@/db/schema";
import { securityPolicy } from "@/lib/policy";
import { failedPasswordRules } from "./password-policy";

/**
 * The password rules Better Auth does not enforce.
 *
 * Better Auth checks length and nothing else, so composition and the "last
 * five" rule live here, applied in a `before /reset-password` hook — not in the
 * Server Action, because `/api/auth/reset-password` is reachable directly and a
 * rule enforced in only one of two paths is not a rule.
 *
 * The history holds hashes, never passwords. Checking "is this one of the last
 * five" therefore costs five password verifications, which is deliberately slow
 * work — the same slowness that makes the hash worth storing. It runs only on a
 * reset, so the cost is paid once per password change.
 */

export const PASSWORD_REJECTED = "PASSWORD_DOES_NOT_MEET_POLICY";
export const PASSWORD_REUSED = "PASSWORD_RECENTLY_USED";

/** Rule keys the client also evaluates, so the screen can highlight the same row. */
export type RejectedRule = ReturnType<typeof failedPasswordRules>[number] | "notReused";

/**
 * True when `password` matches one of the account's last N hashes.
 *
 * Also checks the *current* credential, which is not yet in the history table
 * at the moment of a reset — without that, "new password" could be the existing
 * one and the rule would miss the most obvious case of all.
 */
export async function passwordWasRecentlyUsed(userId: string, password: string): Promise<boolean> {
  const depth = securityPolicy().passwordHistoryDepth;

  const [history, credentials] = await Promise.all([
    db()
      .select({ passwordHash: passwordHistory.passwordHash })
      .from(passwordHistory)
      .where(eq(passwordHistory.userId, userId))
      .orderBy(desc(passwordHistory.createdAt))
      .limit(depth),
    db()
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
      .limit(1),
  ]);

  const hashes = [
    ...history.map((row) => row.passwordHash),
    ...credentials.map((row) => row.password),
  ].filter((hash): hash is string => typeof hash === "string" && hash.length > 0);

  for (const hash of hashes) {
    if (await verifyPassword({ hash, password })) return true;
  }
  return false;
}

/**
 * Resolves the user a reset token belongs to, without consuming it.
 *
 * Better Auth stores the token under a `reset-password:<token>` verification
 * row whose value is the user id. The hook needs that id to check the history
 * *before* the endpoint runs, and must leave the token intact so the endpoint
 * can still spend it — which is what makes the link single-use.
 */
type ResetHookContext = {
  body?: unknown;
  context: {
    internalAdapter: {
      findVerificationValue: (identifier: string) => Promise<{ value: string } | null | undefined>;
    };
  };
};

function fieldFromBody(body: unknown, field: string): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * `before /reset-password`: composition first, then reuse.
 *
 * Composition is checked before touching the database because it needs no
 * lookup and is the overwhelmingly common failure. An invalid *token* is left
 * to the endpoint, so this hook never becomes a way to probe tokens.
 */
export async function assertPasswordAcceptable(ctx: ResetHookContext): Promise<void> {
  const password = fieldFromBody(ctx.body, "newPassword");
  if (!password) return;

  const broken = failedPasswordRules(password);
  if (broken.length > 0) {
    throw new APIError("BAD_REQUEST", {
      code: PASSWORD_REJECTED,
      message: `Password does not meet the organisation policy: ${broken.join(", ")}.`,
      rules: broken,
    });
  }

  const token = fieldFromBody(ctx.body, "token");
  if (!token) return;

  const record = await ctx.context.internalAdapter
    .findVerificationValue(`reset-password:${token}`)
    .catch(() => null);
  if (!record?.value) return;

  if (await passwordWasRecentlyUsed(record.value, password)) {
    throw new APIError("BAD_REQUEST", {
      code: PASSWORD_REUSED,
      message: "Password was used recently and cannot be reused.",
      rules: ["notReused"],
    });
  }
}

/**
 * Called by Better Auth's `onPasswordReset`, after the new password is stored.
 *
 * Three consequences, all of which the reset screen promises out loud:
 * the new hash joins the history, the password clock restarts, and every
 * trusted device loses its trust — "إعادة تعيين كلمة المرور تُلغي ثقة كل
 * الأجهزة المحفوظة، لأن الجهاز الموثوق يعتمد على أن الحساب لم يُخترق".
 *
 * Better Auth's `revokeSessionsOnPasswordReset` has already ended the sessions.
 */
export async function onPasswordChanged(userId: string): Promise<void> {
  const [credential] = await db()
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1);

  if (credential?.password) {
    await db()
      .insert(passwordHistory)
      .values({ id: randomUUID(), userId, passwordHash: credential.password });
    await pruneHistory(userId);
  }

  await db()
    .update(user)
    .set({ passwordChangedAt: new Date(), updatedAt: new Date() })
    .where(eq(user.id, userId));

  await revokeAllTrustedDevices(userId);
}

/**
 * Keeps only the newest `passwordHistoryDepth` hashes. Older ones can never
 * change a verdict, and a hash is a credential — not keeping one indefinitely
 * is the point.
 */
async function pruneHistory(userId: string): Promise<void> {
  const depth = securityPolicy().passwordHistoryDepth;

  const keep = await db()
    .select({ id: passwordHistory.id, createdAt: passwordHistory.createdAt })
    .from(passwordHistory)
    .where(eq(passwordHistory.userId, userId))
    .orderBy(desc(passwordHistory.createdAt))
    .limit(depth);

  const oldest = keep.at(-1);
  if (!oldest || keep.length < depth) return;

  await db()
    .delete(passwordHistory)
    .where(
      and(eq(passwordHistory.userId, userId), lt(passwordHistory.createdAt, oldest.createdAt)),
    );
}

/**
 * Drops every trust grant for a user — both the register row and the
 * `verification` row Better Auth actually checks. Deleting only the register
 * row would leave the device still trusted, which is the failure mode this
 * project's two-table split has to be careful about.
 */
export async function revokeAllTrustedDevices(userId: string): Promise<void> {
  const grants = await db()
    .select({ trustIdentifier: trustedDevice.trustIdentifier })
    .from(trustedDevice)
    .where(eq(trustedDevice.userId, userId));

  await db().delete(trustedDevice).where(eq(trustedDevice.userId, userId));

  if (grants.length === 0) return;

  await db()
    .delete(verification)
    .where(
      inArray(
        verification.identifier,
        grants.map((grant) => grant.trustIdentifier),
      ),
    );
}

/** Exported for the seed and for tests that need a policy-compliant hash. */
export async function hashForStorage(password: string): Promise<string> {
  return hashPassword(password);
}
