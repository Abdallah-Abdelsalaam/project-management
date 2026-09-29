import { securityPolicy, type SecurityPolicy } from "@/lib/policy";

/**
 * The lockout rule, as a pure function of an attempt ledger.
 *
 * `wireframe/pages/settings/security.html` states the policy: after N failed
 * sign-ins the account is suspended for a fixed duration. Two properties matter
 * and are the reason this is separated from its storage:
 *
 *   1. Only *consecutive* failures count. A success clears the budget — so the
 *      window is measured from the most recent success, not from a fixed clock
 *      window. Without that, a user who mistypes twice a day for a week gets
 *      locked out for no reason.
 *   2. The lock expires on its own. There is no unlock job; the check is
 *      evaluated against `now` on each attempt.
 */

export type AttemptRecord = {
  succeeded: boolean;
  attemptedAt: Date;
};

export type LockoutState =
  | { locked: false; failuresSoFar: number; attemptsRemaining: number }
  | { locked: true; until: Date; failuresSoFar: number };

/**
 * `attempts` must be ordered newest first — the order the index
 * `login_attempt_email_attempted_at_idx` serves them in.
 */
export function evaluateLockout(
  attempts: readonly AttemptRecord[],
  now: Date = new Date(),
  policy: SecurityPolicy = securityPolicy(),
): LockoutState {
  const consecutiveFailures: AttemptRecord[] = [];
  for (const attempt of attempts) {
    if (attempt.succeeded) break;
    consecutiveFailures.push(attempt);
  }

  const failuresSoFar = consecutiveFailures.length;

  if (failuresSoFar < policy.loginMaxFailedAttempts) {
    return {
      locked: false,
      failuresSoFar,
      attemptsRemaining: policy.loginMaxFailedAttempts - failuresSoFar,
    };
  }

  // The lock runs from the failure that tripped it: the Nth most recent one.
  // Counting from the newest failure instead would let an attacker extend
  // someone else's lock indefinitely by continuing to guess.
  const tripping = consecutiveFailures[policy.loginMaxFailedAttempts - 1];
  const until = new Date(tripping.attemptedAt.getTime() + policy.loginLockoutMinutes * 60 * 1000);

  if (until.getTime() <= now.getTime()) {
    // The lock has expired. The stale failures no longer count against the
    // budget, so the next attempt starts from a clean slate.
    return { locked: false, failuresSoFar: 0, attemptsRemaining: policy.loginMaxFailedAttempts };
  }

  return { locked: true, until, failuresSoFar };
}

/** Whole minutes remaining on a lock, rounded up, for the user-facing message. */
export function minutesUntil(until: Date, now: Date = new Date()): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
}
