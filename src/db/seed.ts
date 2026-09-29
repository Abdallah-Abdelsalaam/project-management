import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

/**
 * `pnpm db:seed`.
 *
 * Order is not cosmetic: `user.role_id` is a foreign key, so the roles have to
 * exist before a single account can. Running this against a database that
 * already has data is safe — every step is an upsert or a skip, and grants are
 * only written for roles that hold none, so a re-seed never undoes an
 * administrator's edits.
 *
 * Imported lazily, after dotenv, so `DATABASE_URL` is in the environment
 * before anything reads it.
 */
async function main() {
  const { closeDb, db } = await import("@/db");
  const { seedAccess } = await import("@/db/seed-access");
  const { seedRoles } = await import("@/db/seed-access");
  const { seedUsers, SEED_PASSWORD } = await import("@/db/seed-auth");

  const client = db();

  const access = await seedAccess(client);
  console.log(
    `✓ access — ${access.roles} roles, ${access.permissions} capabilities, ` +
      `${access.grants > 0 ? `${access.grants} default grants` : "grants left as they are"}`,
  );

  const idByKey = await seedRoles(client);
  const people = await seedUsers(idByKey, client);

  console.log(
    `\n${people.created} account(s) created, ${people.skipped} already present.\n` +
      `Password: ${SEED_PASSWORD}\n` +
      `Every account requires the emailed second factor; without RESEND_API_KEY the code is written to the server log.`,
  );

  await closeDb();
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  },
);
