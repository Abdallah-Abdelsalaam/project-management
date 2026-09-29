import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { securityPolicy, twoFactorPolicy } from "@/lib/policy";
import { sendPasswordResetLink, sendTwoFactorCode } from "@/features/auth/mail";
import { assertSignInAllowed, recordSignInSuccess } from "@/features/auth/attempts";
import { assertPasswordAcceptable, onPasswordChanged } from "@/features/auth/password-history";

/**
 * Better Auth, configured entirely from `src/lib/policy.ts`.
 *
 * Nothing here is a literal number. Every lifetime, length and limit comes from
 * `securityPolicy()` / `twoFactorPolicy()`, which session 20 will back with the
 * `/settings/security` and `/settings/two-factor` screens. That is the whole
 * reason the accessor exists: when those screens ship, this file does not
 * change.
 *
 * ## The division of labour
 *
 * Better Auth owns what it is good at — password hashing, session records and
 * cookies, the single-use reset token, and the second-factor challenge
 * (half-authenticated cookie, hashed code, per-challenge attempt budget,
 * trusted-device grant).
 *
 * This project owns the three things it promises and Better Auth does not
 * model, each added through a hook so it applies to *every* caller and not just
 * to our Server Actions:
 *
 *   - the sign-in lockout ledger          → `before /sign-in/email`
 *   - the password composition + history  → `before /reset-password`
 *   - trusted-device bookkeeping          → `src/features/auth/trusted-devices.ts`
 *
 * Putting the first two in hooks rather than in the Server Action matters: the
 * catch-all `/api/auth/*` route is reachable directly, so a check that lived
 * only in the action would be a check an attacker could skip.
 *
 * ## Session lifetimes
 *
 * The policy has two: an idle timeout (ساعتان) and an absolute ceiling
 * (7 أيام). Better Auth models one expiry, refreshed on activity, so the idle
 * window is `expiresIn` and the absolute ceiling is enforced against
 * `session.createdAt` in `src/features/auth/session.ts`. `updateAge` bounds how
 * often the refresh writes to the database, which means the effective idle
 * window is `sessionIdleHours` and at most `updateAge` longer — a deliberate
 * trade of precision for one write per quarter hour instead of one per request.
 */
function createAuth() {
  const env = serverEnv();
  const security = securityPolicy();
  const twoFactorSettings = twoFactorPolicy();

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    database: drizzleAdapter(db(), {
      provider: "mysql",
      schema,
      usePlural: false,
    }),

    user: {
      additionalFields: {
        /**
         * The user's role, as a foreign key into `role`. The capabilities it
         * carries are resolved from `role_permission` by
         * `src/features/access/model.ts` — this column holds no policy of its
         * own, which is the point of session 3.
         *
         * `input: false` so no request body can ever set it. A role is granted
         * by an administrator, never self-assigned, and the public sign-up
         * endpoint is shut in any case.
         */
        roleId: {
          type: "string",
          required: false,
          input: false,
        },
        passwordChangedAt: {
          type: "date",
          required: false,
          input: false,
        },
      },
    },

    emailAndPassword: {
      enabled: true,
      // The wireframe has no sign-up screen: "الدخول مقيَّد بحسابات المنظمة …
      // اطلب من مسؤول النظام إضافتك". Accounts are created by an admin
      // (session 5), so the public sign-up endpoint stays shut.
      disableSignUp: true,
      minPasswordLength: security.passwordMinLength,
      maxPasswordLength: security.passwordMaxLength,
      resetPasswordTokenExpiresIn: 60 * 60,
      // "حفظ كلمة مرور جديدة يُغلق جلساتك المفتوحة" — the reset screen's own
      // warning, so this is not optional.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetLink({ to: user.email, name: user.name, url });
      },
      onPasswordReset: async ({ user }) => {
        await onPasswordChanged(user.id);
      },
    },

    session: {
      expiresIn: security.sessionIdleHours * 60 * 60,
      updateAge: 15 * 60,
    },

    plugins: [
      twoFactor({
        issuer: "إدارة المشاريع · مجموعة نُوى",
        // The challenge outlives one code, so a user who waits out the resend
        // cooldown and asks for a fresh code is not thrown back to /login. A
        // code that dies inside a live challenge is what produces the screen's
        // distinct "expired code" state.
        twoFactorCookieMaxAge: twoFactorSettings.codeLifetimeMinutes * 60 * 2,
        trustDeviceMaxAge: twoFactorSettings.trustedDeviceDays * 24 * 60 * 60,
        // TOTP is not offered: the wireframe's 2FA method is "رمز عبر البريد
        // الإلكتروني" and the settings screen shows no authenticator option.
        totpOptions: { disable: true },
        otpOptions: {
          digits: twoFactorSettings.codeLength,
          period: twoFactorSettings.codeLifetimeMinutes,
          allowedAttempts: twoFactorSettings.codeMaxAttempts,
          // Hashed, not plain and not reversibly encrypted: a code is a
          // credential, and nothing needs to read it back.
          storeOTP: "hashed",
          sendOTP: async ({ user, otp }) => {
            await sendTwoFactorCode({ to: user.email, name: user.name, code: otp });
          },
        },
        // "بعد 5 محاولات خاطئة … إيقاف مؤقت 15 دقيقة" — the same numbers the
        // sign-in ledger uses, from the same policy.
        accountLockout: {
          enabled: true,
          maxFailedAttempts: twoFactorSettings.codeMaxAttempts,
          durationSeconds: security.loginLockoutMinutes * 60,
        },
      }),
      // Must be last: it turns the Set-Cookie headers of every endpoint into
      // Next.js cookie writes, which is what makes Server Actions work.
      nextCookies(),
    ],

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-in/email") {
          await assertSignInAllowed(ctx);
        }
        if (ctx.path === "/reset-password") {
          await assertPasswordAcceptable(ctx);
        }
      }),

      /**
       * Reaching an `after` hook means the endpoint did not throw, so a
       * sign-in that gets here had the right password — whether it ended in a
       * session or in a second-factor challenge.
       */
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-in/email") {
          await recordSignInSuccess(ctx);
        }
      }),
    },

    advanced: {
      cookiePrefix: "pm",
    },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

export function auth() {
  instance ??= createAuth();
  return instance;
}

export type Auth = ReturnType<typeof createAuth>;
