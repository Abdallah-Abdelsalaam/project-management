/**
 * Organisation security policy.
 *
 * Every value here is a *stored setting* in the finished system — the
 * wireframe's own words: "هذه القيم قابلة للتعديل من إعدادات المصادقة
 * الثنائية، ولا يحتاج تغييرها إلى تعديل النظام". The screens that write them
 * (`/settings/security`, `/settings/two-factor`) ship in session 20.
 *
 * So the values are read through an accessor rather than referenced as
 * constants. Session 20 replaces the body of `securityPolicy()` and
 * `twoFactorPolicy()` with a cached database read and nothing that consumes
 * them has to change.
 *
 * The defaults are not invented. Each one is the option marked `selected` on
 * the corresponding wireframe settings screen:
 *
 *   wireframe/pages/settings/security.html
 *     إنهاء الجلسة بعد خمول        ساعتان
 *     أقصى عمر للجلسة              7 أيام
 *     أقل طول                      12 حرفًا
 *     صلاحية كلمة المرور            90 يومًا
 *     أقصى محاولات فاشلة            5
 *     مدة الإيقاف المؤقت            15 دقيقة
 *
 *   wireframe/pages/settings/two-factor.html
 *     صلاحية الرمز                 10 دقائق
 *     طول الرمز                    6 أرقام
 *     مدة الجهاز الموثوق            30 يومًا
 *     أقصى عدد أجهزة موثوقة         5
 *     إعادة تحقق قصوى               كل 60 يومًا
 *     أقصى محاولات خاطئة            5
 *     مدة الانتظار قبل إعادة الإرسال 45 ثانية
 */

export type SecurityPolicy = {
  /** Minimum password length. */
  passwordMinLength: number;
  /** Upper bound, so a pathological input cannot become a hashing DoS. */
  passwordMaxLength: number;
  /** Days before a password must be changed. `null` means never. */
  passwordMaxAgeDays: number | null;
  /** How many previous passwords may not be reused. */
  passwordHistoryDepth: number;
  /** Consecutive failed sign-ins before the account is locked. */
  loginMaxFailedAttempts: number;
  /** How long the lock lasts. */
  loginLockoutMinutes: number;
  /** Idle timeout — a session not touched for this long ends. */
  sessionIdleHours: number;
  /** Absolute session lifetime regardless of activity. */
  sessionMaxAgeDays: number;
};

export type TwoFactorPolicy = {
  /** Digits in the emailed code. */
  codeLength: number;
  /** How long a code stays valid. */
  codeLifetimeMinutes: number;
  /** Wrong codes allowed per challenge before it is spent. */
  codeMaxAttempts: number;
  /** How long before a new code may be requested. */
  resendWaitSeconds: number;
  /** How long a trusted device skips the second factor. */
  trustedDeviceDays: number;
  /** Trusted devices one user may hold. `null` means unlimited. */
  maxTrustedDevicesPerUser: number | null;
  /** Hard ceiling: re-verify at least this often, whatever else is set. */
  forceReverifyDays: number;
};

const SECURITY_DEFAULTS: SecurityPolicy = {
  passwordMinLength: 12,
  passwordMaxLength: 128,
  passwordMaxAgeDays: 90,
  passwordHistoryDepth: 5,
  loginMaxFailedAttempts: 5,
  loginLockoutMinutes: 15,
  sessionIdleHours: 2,
  sessionMaxAgeDays: 7,
};

const TWO_FACTOR_DEFAULTS: TwoFactorPolicy = {
  codeLength: 6,
  codeLifetimeMinutes: 10,
  codeMaxAttempts: 5,
  resendWaitSeconds: 45,
  trustedDeviceDays: 30,
  maxTrustedDevicesPerUser: 5,
  forceReverifyDays: 60,
};

export function securityPolicy(): SecurityPolicy {
  return SECURITY_DEFAULTS;
}

export function twoFactorPolicy(): TwoFactorPolicy {
  return TWO_FACTOR_DEFAULTS;
}
