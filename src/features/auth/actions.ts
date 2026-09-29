"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { redirectLocale } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { securityPolicy } from "@/lib/policy";
import { lockoutFor, normaliseEmail } from "./attempts";
import { minutesUntil } from "./lockout";
import { normaliseDigits, resendCooldownSeconds } from "./challenge";
import { failedPasswordRules, type ClientPasswordRule } from "./password-policy";
import { safeNextPath } from "./session";
import { parseTrustIdentifier, recordTrustedDevice, refreshTrustedDevice } from "./trusted-devices";

/**
 * The auth Server Actions.
 *
 * Every one of them validates its input with Zod, delegates the credential work
 * to Better Auth's endpoints (so the hooks in `src/lib/auth.ts` apply), and
 * returns a *state key* rather than a message. The screens translate the key.
 * That is what keeps every user-visible string in `messages/{ar,en}.json` and
 * lets the same state be asserted in a test without matching Arabic prose.
 *
 * Two rules run through all of them:
 *
 * **Never confirm whether an account exists.** Invalid credentials, an unknown
 * address and a credential-less account all return the same `invalidCredentials`.
 * Forgot-password always returns `sent`.
 *
 * **Never return a message the client could have written.** A lockout returns
 * the minutes remaining, and nothing else.
 */

const ROLE_FALLBACK = "agent" as const;

/* -------------------------------------------------------------------------- */
/*  Schemas                                                                   */
/* -------------------------------------------------------------------------- */

const localeSchema = z.enum(routing.locales);

const signInSchema = z.object({
  locale: localeSchema,
  email: z.string().trim().min(1).max(254).email(),
  password: z.string().min(1).max(securityPolicy().passwordMaxLength),
  trustDevice: z.boolean(),
  next: z.string().max(512).optional(),
});

const verifySchema = z.object({
  locale: localeSchema,
  code: z.string().min(1).max(32),
  trustDevice: z.boolean(),
  next: z.string().max(512).optional(),
});

const resendSchema = z.object({ locale: localeSchema });

const forgotSchema = z.object({
  locale: localeSchema,
  email: z.string().trim().min(1).max(254).email(),
});

const resetSchema = z
  .object({
    locale: localeSchema,
    token: z.string().min(1).max(512),
    password: z.string().min(1).max(securityPolicy().passwordMaxLength),
    confirm: z.string().min(1).max(securityPolicy().passwordMaxLength),
  })
  .refine((value) => value.password === value.confirm, { path: ["confirm"] });

/* -------------------------------------------------------------------------- */
/*  State shapes                                                              */
/* -------------------------------------------------------------------------- */

export type SignInState =
  | { status: "idle" }
  | { status: "invalidCredentials" }
  | { status: "locked"; minutesRemaining: number }
  | { status: "invalidInput" }
  | { status: "unavailable" };

export type VerifyState =
  | { status: "idle" }
  | { status: "invalidCode" }
  | { status: "expiredCode" }
  | { status: "attemptsExhausted" }
  | { status: "locked" }
  | { status: "challengeExpired" }
  | { status: "invalidInput" }
  | { status: "unavailable" };

export type ResendState =
  | { status: "idle" }
  | { status: "sent"; sentAt: number }
  | { status: "tooSoon" }
  | { status: "challengeExpired" }
  | { status: "unavailable" };

export type ForgotState =
  { status: "idle" } | { status: "sent" } | { status: "invalidInput" } | { status: "unavailable" };

export type ResetState =
  | { status: "idle" }
  | { status: "mismatch" }
  | { status: "policy"; rules: ClientPasswordRule[] }
  | { status: "reused" }
  | { status: "invalidToken" }
  | { status: "invalidInput" }
  | { status: "unavailable" };

/* -------------------------------------------------------------------------- */
/*  Error decoding                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Better Auth throws `APIError`, whose body carries a machine-readable `code`.
 * Reading it structurally rather than with an `instanceof` keeps this working
 * across the module boundaries a bundler may duplicate.
 */
function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const body = (error as { body?: unknown }).body;
  if (typeof body === "object" && body !== null) {
    const code = (body as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function errorField(error: unknown, field: string): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  const body = (error as { body?: unknown }).body;
  if (typeof body === "object" && body !== null) {
    return (body as Record<string, unknown>)[field];
  }
  return undefined;
}

/** `Response.redirect` throws a control-flow signal that must not be swallowed. */
function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function checkbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

/* -------------------------------------------------------------------------- */
/*  Sign in                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Step one: email and password.
 *
 * Success has two shapes, and which one you get is the whole point of the
 * screen. A device inside its trust window gets a session immediately and goes
 * to its landing page; anything else gets a half-authenticated challenge, a
 * code in the inbox, and `/two-factor`.
 *
 * The lockout is *not* checked here — it is enforced in the `before` hook in
 * `src/lib/auth.ts`, so it also covers a caller that skips this action. This
 * only decodes the refusal.
 */
export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    locale: formData.get("locale"),
    email: formData.get("email"),
    password: formData.get("password"),
    trustDevice: checkbox(formData.get("trustDevice")),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) return { status: "invalidInput" };
  const { locale, email, password, trustDevice, next } = parsed.data;

  const requestHeaders = await headers();
  const trustCookieBefore = await readTrustCookie();

  let result: Awaited<ReturnType<typeof signIn>>;
  try {
    result = await signIn({ email, password, headers: requestHeaders });
  } catch (error) {
    if (isRedirect(error)) throw error;
    return decodeSignInError(error, email);
  }

  if (result.twoFactorRedirect) {
    // The challenge exists but no code has been sent: Better Auth leaves the
    // send to the caller, which is what lets the resend cooldown be ours.
    await sendCode();
    const query = new URLSearchParams();
    if (trustDevice) query.set("trust", "1");
    if (next) query.set("next", next);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    redirectLocale({ href: `/two-factor${suffix}`, locale });
  }

  // A trusted device skipped the second factor. Better Auth rotated the grant
  // identifier while doing so, so the register follows the rotation.
  const trustCookieAfter = await readTrustCookie();
  if (result.userId && trustCookieAfter) {
    await refreshTrustedDevice({
      userId: result.userId,
      previousIdentifier: parseTrustIdentifier(trustCookieBefore),
      trustIdentifier: trustCookieAfter,
      headers: requestHeaders,
    });
  }

  redirectLocale({ href: safeNextPath(next, result.role ?? ROLE_FALLBACK), locale });
}

type SignInOutcome = {
  twoFactorRedirect: boolean;
  userId: string | null;
  role: "agent" | "lead" | "head" | "manager" | "admin" | null;
};

async function signIn({
  email,
  password,
  headers: requestHeaders,
}: {
  email: string;
  password: string;
  headers: Headers;
}): Promise<SignInOutcome> {
  const response = await auth().api.signInEmail({
    body: { email: normaliseEmail(email), password },
    headers: requestHeaders,
  });

  const twoFactorRedirect =
    typeof response === "object" &&
    response !== null &&
    (response as { twoFactorRedirect?: unknown }).twoFactorRedirect === true;

  const user =
    typeof response === "object" && response !== null
      ? (response as { user?: { id?: unknown; role?: unknown } }).user
      : undefined;

  return {
    twoFactorRedirect,
    userId: typeof user?.id === "string" ? user.id : null,
    role: isRole(user?.role) ? user.role : null,
  };
}

function isRole(value: unknown): value is SignInOutcome["role"] & string {
  return (
    value === "agent" ||
    value === "lead" ||
    value === "head" ||
    value === "manager" ||
    value === "admin"
  );
}

/**
 * Every credential failure collapses to one state. The lockout is the single
 * exception, and only because the wait is already public policy — the message
 * still says nothing about whether the address is registered.
 */
function decodeSignInError(error: unknown, email: string): SignInState {
  const code = errorCode(error);

  if (code === "ACCOUNT_LOCKED") {
    const minutes = errorField(error, "minutesRemaining");
    return {
      status: "locked",
      minutesRemaining:
        typeof minutes === "number" ? minutes : securityPolicy().loginLockoutMinutes,
    };
  }

  if (
    code === "INVALID_EMAIL_OR_PASSWORD" ||
    code === "USER_NOT_FOUND" ||
    code === "CREDENTIAL_ACCOUNT_NOT_FOUND" ||
    code === "EMAIL_NOT_VERIFIED" ||
    code === "PASSWORD_TOO_SHORT" ||
    code === "PASSWORD_TOO_LONG"
  ) {
    return { status: "invalidCredentials" };
  }

  console.error(`[auth] sign-in failed for ${normaliseEmail(email)}:`, error);
  return { status: "unavailable" };
}

/* -------------------------------------------------------------------------- */
/*  Second factor                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Step two: the emailed code.
 *
 * Better Auth distinguishes four refusals, and the screen shows each as its own
 * state rather than collapsing them into "wrong code" — a user whose code has
 * simply aged out needs to press resend, not to re-read the digits.
 */
export async function verifyCodeAction(
  _previous: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const parsed = verifySchema.safeParse({
    locale: formData.get("locale"),
    code: formData.get("code"),
    trustDevice: checkbox(formData.get("trustDevice")),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) return { status: "invalidInput" };
  const { locale, code, trustDevice, next } = parsed.data;

  // Arabic-Indic digits are normalised before the comparison; see
  // `./challenge.ts` for why that is not cosmetic.
  const digits = normaliseDigits(code).replace(/\D/g, "");
  if (digits.length === 0) return { status: "invalidInput" };

  const requestHeaders = await headers();

  try {
    const response = await auth().api.verifyTwoFactorOTP({
      body: { code: digits, trustDevice },
      headers: requestHeaders,
    });

    const verified =
      typeof response === "object" && response !== null
        ? (response as { user?: { id?: unknown; role?: unknown } }).user
        : undefined;

    const userId = typeof verified?.id === "string" ? verified.id : null;

    if (trustDevice && userId) {
      const identifier = parseTrustIdentifier(await readTrustCookie());
      if (identifier) {
        await recordTrustedDevice({ userId, trustIdentifier: identifier, headers: requestHeaders });
      }
    }

    // The role comes from the verify response, not from a fresh `getSession`.
    // The session cookie was set on the *outgoing* response a moment ago, so
    // `requestHeaders` still carries no session and a re-read would resolve to
    // nobody — sending every user to the agent landing page.
    const role = isRole(verified?.role) ? verified.role : ROLE_FALLBACK;
    redirectLocale({ href: safeNextPath(next, role), locale });
  } catch (error) {
    if (isRedirect(error)) throw error;
    return decodeVerifyError(error);
  }
}

function decodeVerifyError(error: unknown): VerifyState {
  switch (errorCode(error)) {
    case "INVALID_CODE":
    case "INVALID_BACKUP_CODE":
      return { status: "invalidCode" };
    case "OTP_HAS_EXPIRED":
      return { status: "expiredCode" };
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return { status: "attemptsExhausted" };
    case "ACCOUNT_TEMPORARILY_LOCKED":
      return { status: "locked" };
    case "INVALID_TWO_FACTOR_COOKIE":
    case "TWO_FACTOR_NOT_ENABLED":
      return { status: "challengeExpired" };
    default:
      console.error("[auth] two-factor verification failed:", error);
      return { status: "unavailable" };
  }
}

/**
 * Resend, gated by the cooldown.
 *
 * The cooldown is held in a short cookie rather than a table: it is per
 * challenge, worthless after a minute, and a row per resend would be a write
 * for something that expires before anyone could read it twice. Because the
 * cookie is `httpOnly`, the client cannot lift the gate by clearing it.
 */
export async function resendCodeAction(
  _previous: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const parsed = resendSchema.safeParse({ locale: formData.get("locale") });
  if (!parsed.success) return { status: "unavailable" };

  const cooldown = await readResendCooldown();
  if (cooldown > 0) return { status: "tooSoon" };

  try {
    await sendCode();
  } catch (error) {
    if (isRedirect(error)) throw error;
    const code = errorCode(error);
    if (code === "INVALID_TWO_FACTOR_COOKIE" || code === "TWO_FACTOR_NOT_ENABLED") {
      return { status: "challengeExpired" };
    }
    console.error("[auth] could not resend the code:", error);
    return { status: "unavailable" };
  }

  return { status: "sent", sentAt: Date.now() };
}

/* -------------------------------------------------------------------------- */
/*  Forgotten password                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Always returns `sent`.
 *
 * "لا نكشف ما إذا كان البريد مسجّلًا في النظام أو لا" — the screen says so, so
 * an unknown address, a provider outage and a delivered email are one outcome
 * here. Only a malformed address is reported, because the browser has already
 * told the user that much.
 */
export async function requestResetAction(
  _previous: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = forgotSchema.safeParse({
    locale: formData.get("locale"),
    email: formData.get("email"),
  });

  if (!parsed.success) return { status: "invalidInput" };
  const { locale, email } = parsed.data;

  try {
    await auth().api.requestPasswordReset({
      body: {
        email: normaliseEmail(email),
        redirectTo: `/${locale}/reset-password`,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (isRedirect(error)) throw error;
    // Deliberately not surfaced. See the note above.
    console.error("[auth] password reset request failed:", error);
  }

  return { status: "sent" };
}

/**
 * Spends the reset token.
 *
 * Composition and the "last five" rule are enforced by the `before` hook in
 * `src/lib/auth.ts`, so they apply to the raw endpoint too; this action decodes
 * the refusal and maps it back onto the checklist row that failed. The mismatch
 * between the two fields is checked here because it never reaches the server as
 * a policy question.
 */
export async function resetPasswordAction(
  _previous: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const raw = {
    locale: formData.get("locale"),
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  };

  const parsed = resetSchema.safeParse(raw);
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.path[0] === "confirm");
    if (mismatch) return { status: "mismatch" };
    return { status: "invalidInput" };
  }

  const { locale, token, password } = parsed.data;

  // Checked before the round trip as well as after, so the common case answers
  // without a request. The server's copy is the one that counts.
  const broken = failedPasswordRules(password);
  if (broken.length > 0) return { status: "policy", rules: broken };

  try {
    await auth().api.resetPassword({
      body: { newPassword: password, token },
      headers: await headers(),
    });
  } catch (error) {
    if (isRedirect(error)) throw error;
    return decodeResetError(error);
  }

  redirectLocale({ href: "/login?reset=1", locale });
}

function decodeResetError(error: unknown): ResetState {
  const code = errorCode(error);

  if (code === "PASSWORD_RECENTLY_USED") return { status: "reused" };

  if (code === "PASSWORD_DOES_NOT_MEET_POLICY") {
    const rules = errorField(error, "rules");
    return {
      status: "policy",
      rules: Array.isArray(rules) ? (rules as ClientPasswordRule[]) : [],
    };
  }

  if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
    return { status: "policy", rules: ["minLength"] };
  }

  if (code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED") {
    return { status: "invalidToken" };
  }

  console.error("[auth] password reset failed:", error);
  return { status: "unavailable" };
}

/* -------------------------------------------------------------------------- */
/*  Sign out                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Ends the session and returns to `/login`.
 *
 * Takes `FormData` rather than a bound locale so the topbar can post to it as a
 * plain form — which keeps sign-out a POST. A GET sign-out is a link a
 * prefetching browser or a preview crawler can follow.
 */
export async function signOutAction(formData: FormData): Promise<void> {
  const locale = localeSchema.catch(routing.defaultLocale).parse(formData.get("locale"));

  await auth()
    .api.signOut({ headers: await headers() })
    .catch(() => null);

  redirectLocale({ href: "/login", locale });
}

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

const RESEND_COOKIE = "pm.2fa_sent";

/**
 * Sends a code and arms the cooldown. The two go together — a send that did not
 * arm the cooldown would let the resend button be held down.
 */
async function sendCode(): Promise<void> {
  await auth().api.sendTwoFactorOTP({ body: {}, headers: await headers() });

  const jar = await cookies();
  jar.set(RESEND_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
}

/** Seconds still to wait before another code may be requested. */
export async function readResendCooldown(now = Date.now()): Promise<number> {
  const jar = await cookies();
  const value = jar.get(RESEND_COOKIE)?.value;
  const sentAt = value ? Number(value) : NaN;
  if (!Number.isFinite(sentAt)) return 0;
  return resendCooldownSeconds(new Date(sentAt), new Date(now));
}

/** The raw trust cookie, whatever Better Auth's prefix resolves to. */
async function readTrustCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.getAll().find((cookie) => cookie.name.includes("trust_device"))?.value;
}

/** Re-exported so the two-factor page can seed its countdown server-side. */
export async function lockoutStateFor(email: string) {
  const state = await lockoutFor(email);
  return state.locked ? { locked: true as const, minutes: minutesUntil(state.until) } : null;
}
