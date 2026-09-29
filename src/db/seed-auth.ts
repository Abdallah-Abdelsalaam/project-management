import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { generateRandomString } from "better-auth/crypto";
import { db } from "@/db";
import { account, twoFactor, user } from "@/db/schema";
import { ROLE_KEYS, type RoleKey } from "@/lib/permissions";

config({ path: ".env.local", quiet: true });

/**
 * Seeds one account per role, so session 2's flow can be exercised end to end
 * and the E2E suite has something to sign in as.
 *
 * This is **not** the reference organisation. `docs/OPEN_QUESTIONS.md` Q10 asks
 * whether to seed نُوى's 18 employees, 5 teams and 284 tasks; that decision is
 * needed by session 4 and this seed deliberately does not pre-empt it. Five
 * accounts is what session 2 needs to resolve a user's role, and no more — the
 * brief's own boundary.
 *
 * Every account is created with:
 *   - a `credential` row holding the scrypt hash (Better Auth's own hasher, so
 *     sign-in verifies against it)
 *   - `twoFactorEnabled: true`, because the wireframe's flow always asks for a
 *     code; and a `two_factor` row, which is where the plugin keeps the
 *     account-level failure budget that enforces the lockout
 *   - `emailVerified: true`, since an admin created the account
 *
 * Run with: pnpm db:seed
 */

const PASSWORD = process.env.SEED_PASSWORD ?? "Nuwa!Ops2026x";

const PEOPLE: ReadonlyArray<{ role: RoleKey; name: string; email: string }> = [
  { role: "admin", name: "نورة العتيبي", email: "n.alotaibi@nuwa.sa" },
  { role: "manager", name: "أحمد سالم", email: "a.salem@nuwa.sa" },
  { role: "head", name: "ريم القحطاني", email: "r.alqahtani@nuwa.sa" },
  { role: "lead", name: "خالد الدوسري", email: "k.aldosari@nuwa.sa" },
  { role: "agent", name: "سارة الحربي", email: "s.alharbi@nuwa.sa" },
];

async function seed() {
  const client = db();
  const passwordHash = await hashPassword(PASSWORD);
  const now = new Date();

  for (const person of PEOPLE) {
    const email = person.email.toLowerCase();

    const [existing] = await client
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existing) {
      console.log(`· ${email} already exists — skipped`);
      continue;
    }

    const userId = randomUUID();

    await client.insert(user).values({
      id: userId,
      name: person.name,
      email,
      emailVerified: true,
      role: person.role,
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
  }

  console.log(
    `\nAll five roles seeded (${ROLE_KEYS.join(", ")}).\n` +
      `Password: ${PASSWORD}\n` +
      `Every account requires the emailed second factor; without RESEND_API_KEY the code is written to the server log.`,
  );
}

seed().then(
  () => process.exit(0),
  (error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  },
);
