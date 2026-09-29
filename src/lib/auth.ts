import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { serverEnv } from "@/lib/env";

/**
 * Better Auth skeleton. Email + password with sessions in the database.
 *
 * Session 2 adds, against the wireframe's auth screens:
 *   - email OTP as the second factor (pages/auth/two-factor.html)
 *   - trusted devices with a configurable trust window
 *   - the organisation password/lockout/session policies from
 *     pages/settings/security.html
 *
 * Nothing here is wired to a route guard yet; the shell is still open.
 */
function createAuth() {
  const env = serverEnv();

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db(), { provider: "pg" }),
    emailAndPassword: {
      enabled: true,
      // Tightened in session 2 to match the policy screen (min length,
      // expiry, lockout after N failed attempts).
      minPasswordLength: 12,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

export function auth() {
  instance ??= createAuth();
  return instance;
}
