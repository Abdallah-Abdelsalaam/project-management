import { describe, expect, it } from "vitest";
import { APIError } from "better-auth/api";
import { evaluateLockout, minutesUntil, type AttemptRecord } from "./lockout";
import { signInSucceeded } from "./attempts";
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

describe("signInSucceeded — the guard on the after hook", () => {
  /**
   * The bug this function exists for: Better Auth runs `after` hooks even when
   * the endpoint threw, so an unguarded `after` hook cleared the failure ledger
   * on every failed sign-in and the lockout could never fire. Found by probing
   * the deployed app in session 3; these are the cases that keep it fixed.
   */
  it("treats the endpoint's body as success", () => {
    expect(signInSucceeded({ context: { returned: { token: "t", user: { id: "u" } } } })).toBe(
      true,
    );
  });

  it("treats the 2FA branch as success — the password was still right", () => {
    expect(
      signInSucceeded({
        context: { returned: { twoFactorRedirect: true, twoFactorMethods: ["otp"] } },
      }),
    ).toBe(true);
  });

  it("treats a real APIError as failure", () => {
    const error = new APIError("UNAUTHORIZED", {
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: "Invalid email or password",
    });
    expect(signInSucceeded({ context: { returned: error } })).toBe(false);
  });

  it("treats an error-shaped object as failure even without the class", () => {
    // The class identity is not guaranteed across module instances, so the
    // shape is checked too.
    expect(signInSucceeded({ context: { returned: { statusCode: 401, code: "X" } } })).toBe(false);
    expect(signInSucceeded({ context: { returned: { status: 403, code: "X" } } })).toBe(false);
    expect(
      signInSucceeded({ context: { returned: { status: "UNAUTHORIZED", code: "INVALID" } } }),
    ).toBe(false);
  });

  it("treats a missing context as success, so a shape change cannot lock real users out", () => {
    expect(signInSucceeded({})).toBe(true);
    expect(signInSucceeded({ context: {} })).toBe(true);
    expect(signInSucceeded({ context: { returned: undefined } })).toBe(true);
  });
});
