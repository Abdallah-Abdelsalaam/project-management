import { securityPolicy, type SecurityPolicy } from "@/lib/policy";

/**
 * The password requirements, one per line of the reset screen's checklist.
 *
 * `wireframe/pages/auth/reset-password.html` lists five, each reporting its own
 * state rather than a single strength bar. The keys are the message keys under
 * `auth.password.rule.*`, so the checklist renders from this list and cannot
 * drift from what the server enforces.
 *
 * Four of the five are decidable from the password alone, and those four make up
 * `CLIENT_PASSWORD_RULES` — the list the browser ticks live as the user types.
 * `notReused` is deliberately absent from it: answering that needs the account's
 * password history, which the browser does not have and must not be given. The
 * reset form renders that row as pending until the server answers.
 * See docs/OPEN_QUESTIONS.md Q16.
 */
export const PASSWORD_RULES = ["minLength", "mixedCase", "digit", "symbol", "notReused"] as const;

export type PasswordRule = (typeof PASSWORD_RULES)[number];

/** The rules a browser can evaluate without asking the server. */
export const CLIENT_PASSWORD_RULES = ["minLength", "mixedCase", "digit", "symbol"] as const;

export type ClientPasswordRule = (typeof CLIENT_PASSWORD_RULES)[number];

/**
 * Anything that is not a letter, a digit or whitespace counts as a symbol.
 * Defining it as a deny-list rather than a hand-written allow-list matters for
 * an Arabic-language product: a user typing `؟` or `،` must not be told their
 * password has no special character.
 */
const SYMBOL = /[^\p{L}\p{N}\s]/u;
const LOWER = /\p{Ll}/u;
const UPPER = /\p{Lu}/u;
const DIGIT = /\p{Nd}/u;

/**
 * Which client-side rules a candidate password satisfies. Pure, so the same
 * function drives the live checklist and the server's verdict.
 */
export function checkClientPasswordRules(
  password: string,
  policy: SecurityPolicy = securityPolicy(),
): Record<ClientPasswordRule, boolean> {
  return {
    minLength:
      password.length >= policy.passwordMinLength && password.length <= policy.passwordMaxLength,
    // Arabic has no case, so a password written only in Arabic can never pass
    // this rule. That is the policy's own consequence, not a bug here — and the
    // rule is why the checklist states it up front.
    mixedCase: LOWER.test(password) && UPPER.test(password),
    digit: DIGIT.test(password),
    symbol: SYMBOL.test(password),
  };
}

/** The rules a candidate password fails, in checklist order. */
export function failedPasswordRules(
  password: string,
  policy: SecurityPolicy = securityPolicy(),
): ClientPasswordRule[] {
  const results = checkClientPasswordRules(password, policy);
  return CLIENT_PASSWORD_RULES.filter((rule) => !results[rule]);
}

export function passwordMeetsPolicy(
  password: string,
  policy: SecurityPolicy = securityPolicy(),
): boolean {
  return failedPasswordRules(password, policy).length === 0;
}

/**
 * Whether a password set at `changedAt` has aged out. A user who has never set
 * one (an invited account that never completed the flow) counts as expired, so
 * the system fails closed.
 */
export function passwordHasExpired(
  changedAt: Date | null,
  now: Date = new Date(),
  policy: SecurityPolicy = securityPolicy(),
): boolean {
  if (policy.passwordMaxAgeDays === null) return false;
  if (!changedAt) return true;
  const ageMs = now.getTime() - changedAt.getTime();
  return ageMs >= policy.passwordMaxAgeDays * 24 * 60 * 60 * 1000;
}
