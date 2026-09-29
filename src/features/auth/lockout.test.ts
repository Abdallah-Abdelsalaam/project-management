import { describe, expect, it } from "vitest";
import { evaluateLockout, minutesUntil, type AttemptRecord } from "./lockout";
import { securityPolicy } from "@/lib/policy";

const POLICY = securityPolicy();
const NOW = new Date("2026-09-29T12:00:00.000Z");

/** Newest first, matching the order the query returns. */
function failures(count: number, minutesAgoOfNewest = 0): AttemptRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    succeeded: false,
    attemptedAt: new Date(NOW.getTime() - (minutesAgoOfNewest + index) * 60_000),
  }));
}

describe("evaluateLockout", () => {
  it("leaves a clean account unlocked with the full budget", () => {
    const state = evaluateLockout([], NOW, POLICY);
    expect(state.locked).toBe(false);
    expect(state).toMatchObject({ attemptsRemaining: POLICY.loginMaxFailedAttempts });
  });

  it("counts down the remaining attempts as failures accumulate", () => {
    const state = evaluateLockout(failures(2), NOW, POLICY);
    expect(state).toEqual({
      locked: false,
      failuresSoFar: 2,
      attemptsRemaining: POLICY.loginMaxFailedAttempts - 2,
    });
  });

  it("does not lock on the attempt before the limit", () => {
    const state = evaluateLockout(failures(POLICY.loginMaxFailedAttempts - 1), NOW, POLICY);
    expect(state.locked).toBe(false);
  });

  it("locks exactly at the configured number of failures", () => {
    const state = evaluateLockout(failures(POLICY.loginMaxFailedAttempts), NOW, POLICY);
    expect(state.locked).toBe(true);
  });

  it("dates the lock from the failure that tripped it, not the newest one", () => {
    // Five failures, the oldest of which is the tripping one. The newest is
    // now; the fifth is four minutes ago.
    const state = evaluateLockout(failures(POLICY.loginMaxFailedAttempts), NOW, POLICY);
    if (!state.locked) throw new Error("expected locked");

    const tripping = new Date(NOW.getTime() - (POLICY.loginMaxFailedAttempts - 1) * 60_000);
    expect(state.until).toEqual(new Date(tripping.getTime() + POLICY.loginLockoutMinutes * 60_000));
  });

  it("cannot have its lock extended by further guessing", () => {
    // An attacker keeps guessing after the lock trips. The tripping failure is
    // the same one, so the release time does not move.
    const tripped = evaluateLockout(failures(POLICY.loginMaxFailedAttempts), NOW, POLICY);
    const stillGuessing = evaluateLockout(
      failures(POLICY.loginMaxFailedAttempts + 20),
      NOW,
      POLICY,
    );

    if (!tripped.locked || !stillGuessing.locked) throw new Error("expected locked");
    expect(stillGuessing.until.getTime()).toBeLessThanOrEqual(tripped.until.getTime());
  });

  it("releases the account once the lockout duration has passed", () => {
    // The tripping failure is older than the lockout window.
    const past = failures(POLICY.loginMaxFailedAttempts, POLICY.loginLockoutMinutes + 1);
    const state = evaluateLockout(past, NOW, POLICY);
    expect(state).toEqual({
      locked: false,
      failuresSoFar: 0,
      attemptsRemaining: POLICY.loginMaxFailedAttempts,
    });
  });

  it("counts only consecutive failures — a success clears the budget", () => {
    const attempts: AttemptRecord[] = [
      ...failures(3),
      { succeeded: true, attemptedAt: new Date(NOW.getTime() - 10 * 60_000) },
      ...failures(POLICY.loginMaxFailedAttempts, 20),
    ];

    const state = evaluateLockout(attempts, NOW, POLICY);
    expect(state).toMatchObject({ locked: false, failuresSoFar: 3 });
  });

  it("locks an account whose older failures were already cleared by a success", () => {
    const attempts: AttemptRecord[] = [
      ...failures(POLICY.loginMaxFailedAttempts),
      { succeeded: true, attemptedAt: new Date(NOW.getTime() - 60 * 60_000) },
    ];
    expect(evaluateLockout(attempts, NOW, POLICY).locked).toBe(true);
  });
});

describe("minutesUntil", () => {
  it("rounds up, so a lock is never reported as over early", () => {
    expect(minutesUntil(new Date(NOW.getTime() + 61_000), NOW)).toBe(2);
  });

  it("never reports less than one minute while still locked", () => {
    expect(minutesUntil(new Date(NOW.getTime() + 500), NOW)).toBe(1);
  });
});
