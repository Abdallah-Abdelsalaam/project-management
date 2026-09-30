import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword, generateRandomString } from "better-auth/crypto";
import { db, type Executor } from "@/db";
import { account, twoFactor, user } from "@/db/schema";
import { type RoleKey } from "@/lib/permissions";
import { SEED_ACCOUNTS, SEED_PASSWORD } from "@/db/seed-identities";

/**
 * Seeds one account per role, plus the one account the E2E suite is allowed
 * to damage, so the auth flow can be exercised end to end.
 *
 * The addresses and names come from `@/db/seed-identities`, which the E2E
 * fixture imports too — see the note there on why they must not be declared
 * twice.
 *
 * This is **not** the reference organisation. `docs/OPEN_QUESTIONS.md` Q10 asks
 * whether to seed نُوى's 18 employees, 5 teams and 284 tasks; that decision is
 * needed by session 4 and this seed deliberately does not pre-empt it. Five
 * accounts is what the auth and permission work needs to resolve a user's
 * role, and no more.
 *
 * Every account is created with:
 *   - a `credential` row holding the scrypt hash (Better Auth's own hasher, so
 *     sign-in verifies against it)
 *   - `twoFactorEnabled: true`, because the wireframe's flow always asks for a
 *     code; and a `two_factor` row, which is where the plugin keeps the
 *     account-level failure budget that enforces the lockout
 *   - `emailVerified: true`, since an admin created the account
 */

export { SEED_PASSWORD, SEED_PEOPLE, SEED_SACRIFICIAL } from "@/db/seed-identities";

/**
 * Creates the accounts. Takes the role ids rather than looking them up,
 * because `user.role_id` is now a foreign key and the roles must already
 * exist — `src/db/seed.ts` enforces that ordering.
 */
export async function seedUsers(
  idByKey: Record<RoleKey, string>,
  client: Executor = db(),
): Promise<{ created: number; skipped: number }> {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (const person of SEED_ACCOUNTS) {
    const email = person.email.toLowerCase();

    const [existing] = await client
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existing) {
      console.log(`· ${email} already exists — skipped`);
      skipped += 1;
      continue;
    }

    const userId = randomUUID();

    await client.insert(user).values({
      id: userId,
      name: person.name,
      email,
      emailVerified: true,
      roleId: idByKey[person.role],
      twoFactorEnabled: true,
      passwordChangedAt: now,
    });

    await client.insert(account).values({
      id: randomUUID(),
      userId,
      // For a credential account Better Auth uses the user id as the account id.
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
    });

    // The OTP itself lives in `verification`; this row exists so the plugin has
    // somewhere to count failed verifications and park a lock.
    await client.insert(twoFactor).values({
      id: randomUUID(),
      userId,
      secret: generateRandomString(32),
      backupCodes: "",
      verified: true,
    });

    console.log(`✓ ${person.role.padEnd(8)} ${email}`);
    created += 1;
  }

  return { created, skipped };
}
