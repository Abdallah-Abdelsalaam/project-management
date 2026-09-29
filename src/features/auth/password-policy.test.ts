import { describe, expect, it } from "vitest";
import {
  CLIENT_PASSWORD_RULES,
  checkClientPasswordRules,
  failedPasswordRules,
  passwordHasExpired,
  passwordMeetsPolicy,
} from "./password-policy";
import { securityPolicy } from "@/lib/policy";

const POLICY = securityPolicy();
const NOW = new Date("2026-09-29T12:00:00.000Z");

/** Satisfies every client-side rule: 12+ chars, mixed case, digit, symbol. */
const VALID = "Nuwa!Ops2026x";

describe("checkClientPasswordRules", () => {
  it("passes a password that satisfies the whole policy", () => {
    expect(checkClientPasswordRules(VALID, POLICY)).toEqual({
      minLength: true,
      mixedCase: true,
      digit: true,
      symbol: true,
    });
  });

  it("reports each requirement separately rather than one verdict", () => {
    expect(Object.keys(checkClientPasswordRules("a", POLICY)).sort()).toEqual(
      [...CLIENT_PASSWORD_RULES].sort(),
    );
  });

  it("fails a password one character short of the minimum", () => {
    const short = "Ab3!" + "x".repeat(POLICY.passwordMinLength - 5);
    expect(short).toHaveLength(POLICY.passwordMinLength - 1);
    expect(checkClientPasswordRules(short, POLICY).minLength).toBe(false);
  });

  it("passes a password exactly at the minimum", () => {
    const exact = "Ab3!" + "x".repeat(POLICY.passwordMinLength - 4);
    expect(exact).toHaveLength(POLICY.passwordMinLength);
    expect(checkClientPasswordRules(exact, POLICY).minLength).toBe(true);
  });

  it("rejects a password beyond the maximum, so hashing cannot be a DoS", () => {
    const huge = VALID + "x".repeat(POLICY.passwordMaxLength);
    expect(checkClientPasswordRules(huge, POLICY).minLength).toBe(false);
  });

  it("requires both cases, not merely one", () => {
    expect(checkClientPasswordRules("nuwa!ops2026x", POLICY).mixedCase).toBe(false);
    expect(checkClientPasswordRules("NUWA!OPS2026X", POLICY).mixedCase).toBe(false);
  });

  it("requires a digit", () => {
    expect(checkClientPasswordRules("Nuwa!Operations", POLICY).digit).toBe(false);
  });

  it("requires a symbol", () => {
    expect(checkClientPasswordRules("NuwaOps2026xyz", POLICY).symbol).toBe(false);
  });

  it("accepts Arabic punctuation as a symbol — the product language is Arabic", () => {
    expect(checkClientPasswordRules("NuwaOps2026؟x", POLICY).symbol).toBe(true);
  });

  it("does not mistake Arabic letters for a symbol", () => {
    expect(checkClientPasswordRules("NuwaOps2026نص", POLICY).symbol).toBe(false);
  });

  it("counts an Arabic-Indic digit as a digit", () => {
    expect(checkClientPasswordRules("NuwaOps!x٤٢٧ab", POLICY).digit).toBe(true);
  });

  it("does not count a space as a symbol", () => {
    expect(checkClientPasswordRules("Nuwa Ops 2026x", POLICY).symbol).toBe(false);
  });
});

describe("failedPasswordRules", () => {
  it("is empty for a valid password", () => {
    expect(failedPasswordRules(VALID, POLICY)).toEqual([]);
  });

  it("lists every failure, in checklist order", () => {
    expect(failedPasswordRules("abc", POLICY)).toEqual([
      "minLength",
      "mixedCase",
      "digit",
      "symbol",
    ]);
  });
});

describe("passwordMeetsPolicy", () => {
  it("accepts a compliant password", () => {
    expect(passwordMeetsPolicy(VALID, POLICY)).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(passwordMeetsPolicy("", POLICY)).toBe(false);
  });
});

describe("passwordHasExpired", () => {
  it("treats a password changed today as current", () => {
    expect(passwordHasExpired(NOW, NOW, POLICY)).toBe(false);
  });

  it("treats a password one day short of the limit as current", () => {
    const age = (POLICY.passwordMaxAgeDays! - 1) * 24 * 60 * 60 * 1000;
    expect(passwordHasExpired(new Date(NOW.getTime() - age), NOW, POLICY)).toBe(false);
  });

  it("expires a password exactly at the configured age", () => {
    const age = POLICY.passwordMaxAgeDays! * 24 * 60 * 60 * 1000;
    expect(passwordHasExpired(new Date(NOW.getTime() - age), NOW, POLICY)).toBe(true);
  });

  it("fails closed for an account that never set a password", () => {
    expect(passwordHasExpired(null, NOW, POLICY)).toBe(true);
  });

  it("never expires when the policy says passwords do not expire", () => {
    const noExpiry = { ...POLICY, passwordMaxAgeDays: null };
    expect(passwordHasExpired(null, NOW, noExpiry)).toBe(false);
  });
});
