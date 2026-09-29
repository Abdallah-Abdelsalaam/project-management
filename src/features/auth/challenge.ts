import { twoFactorPolicy, type TwoFactorPolicy } from "@/lib/policy";

/**
 * The second-factor code's lifetime and its resend cooldown.
 *
 * Better Auth owns the code itself — it generates it, stores it hashed under a
 * `verification` row and expires it. These functions own the two things the
 * *screen* has to know: when a code dies ("الرمز صالح لمدة 10 دقائق") and when
 * the resend button comes back ("يمكن إعادة الإرسال بعد 45 ثانية").
 *
 * Pure, because the cooldown is computed in three places — the server rejecting
 * an early resend, the server rendering the initial button state, and the client
 * counting down — and all three must agree.
 */

export function codeExpiry(now: Date = new Date(), policy: TwoFactorPolicy = twoFactorPolicy()) {
  return new Date(now.getTime() + policy.codeLifetimeMinutes * 60 * 1000);
}

export function isCodeExpired(
  expiresAt: Date,
  now: Date = new Date(),
  /** Tolerance for clock skew between the app server and the database. */
  skewMs = 0,
): boolean {
  return expiresAt.getTime() + skewMs <= now.getTime();
}

/** When the resend button becomes usable again after a code was sent. */
export function resendAvailableAt(sentAt: Date, policy: TwoFactorPolicy = twoFactorPolicy()): Date {
  return new Date(sentAt.getTime() + policy.resendWaitSeconds * 1000);
}

/**
 * Seconds still to wait before a resend is allowed; `0` when it is allowed now.
 * Rounded up, so the button never enables a fraction of a second early.
 */
export function resendCooldownSeconds(
  sentAt: Date | null,
  now: Date = new Date(),
  policy: TwoFactorPolicy = twoFactorPolicy(),
): number {
  if (!sentAt) return 0;
  const remainingMs = resendAvailableAt(sentAt, policy).getTime() - now.getTime();
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / 1000);
}

/**
 * Pulls a six-digit code out of whatever the user pasted into the first box.
 *
 * The screen promises "يمكنك لصق الرمز كاملًا في أول خانة", and what actually
 * arrives on the clipboard from an email is rarely clean: "Your code: 123 456",
 * a trailing newline, or Arabic-Indic digits if the mail client localised them.
 * All of those have to work.
 */
export function parsePastedCode(
  pasted: string,
  policy: TwoFactorPolicy = twoFactorPolicy(),
): string {
  return normaliseDigits(pasted).replace(/\D/g, "").slice(0, policy.codeLength);
}

/**
 * Maps Arabic-Indic (٠١٢) and Extended Arabic-Indic (۰۱۲) digits onto ASCII.
 * The code is compared as a string, so a user whose keyboard or mail client
 * produces Arabic numerals would otherwise be unable to sign in at all.
 */
export function normaliseDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.codePointAt(0) ?? 0;
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}
