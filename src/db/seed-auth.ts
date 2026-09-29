import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword, generateRandomString } from "better-auth/crypto";
import { db, type Executor } from "@/db";
import { account, twoFactor, user } from "@/db/schema";
import { type RoleKey } from "@/lib/permissions";

/**
 * Seeds one account per role, so the auth flow can be exercised end to end
 * and the E2E suite has something to sign in as.
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

export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Nuwa!Ops2026x";

export const SEED_PEOPLE: ReadonlyArray<{ role: RoleKey; name: string; email: string }> = [
  { role: "admin", name: "نورة العتيبي", email: "n.alotaibi@nuwa.sa" },
  { role: "manager", name: "أحمد سالم", email: "a.salem@nuwa.sa" },
  { role: "head", name: "ريم القحطاني", email: "r.alqahtani@nuwa.sa" },
  { role: "lead", name: "خالد الدوسري", email: "k.aldosari@nuwa.sa" },
  { role: "agent", name: "سارة الحربي", email: "s.alharbi@nuwa.sa" },
];

/**
 * Creates the five accounts. Takes the role ids rather than looking them up,
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

  for (const person of SEED_PEOPLE) {
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
