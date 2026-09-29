import { describe, expect, it } from "vitest";
import {
  codeExpiry,
  isCodeExpired,
  normaliseDigits,
  parsePastedCode,
  resendAvailableAt,
  resendCooldownSeconds,
} from "./challenge";
import { twoFactorPolicy } from "@/lib/policy";

const POLICY = twoFactorPolicy();
const NOW = new Date("2026-09-29T12:00:00.000Z");

describe("code lifetime", () => {
  it("expires a code after the configured number of minutes", () => {
    expect(codeExpiry(NOW, POLICY)).toEqual(
      new Date(NOW.getTime() + POLICY.codeLifetimeMinutes * 60_000),
    );
  });

  it("treats a code as live one second before its expiry", () => {
    const expiresAt = codeExpiry(NOW, POLICY);
    expect(isCodeExpired(expiresAt, new Date(expiresAt.getTime() - 1000))).toBe(false);
  });

  it("treats a code as expired at its expiry instant, not after it", () => {
    const expiresAt = codeExpiry(NOW, POLICY);
    expect(isCodeExpired(expiresAt, expiresAt)).toBe(true);
  });

  it("expires a code whose window has fully passed", () => {
    const expiresAt = codeExpiry(NOW, POLICY);
    expect(isCodeExpired(expiresAt, new Date(expiresAt.getTime() + 60_000))).toBe(true);
  });
});

describe("resend cooldown", () => {
  it("reports the full wait immediately after sending", () => {
    expect(resendCooldownSeconds(NOW, NOW, POLICY)).toBe(POLICY.resendWaitSeconds);
  });

  it("counts down as the wait elapses", () => {
    const tenSecondsLater = new Date(NOW.getTime() + 10_000);
    expect(resendCooldownSeconds(NOW, tenSecondsLater, POLICY)).toBe(POLICY.resendWaitSeconds - 10);
  });

  it("rounds up, so the button never enables early", () => {
    const halfSecondLeft = new Date(resendAvailableAt(NOW, POLICY).getTime() - 500);
    expect(resendCooldownSeconds(NOW, halfSecondLeft, POLICY)).toBe(1);
  });

  it("allows a resend exactly when the wait is over", () => {
    expect(resendCooldownSeconds(NOW, resendAvailableAt(NOW, POLICY), POLICY)).toBe(0);
  });

  it("allows a resend when nothing has been sent yet", () => {
    expect(resendCooldownSeconds(null, NOW, POLICY)).toBe(0);
  });
});

describe("parsePastedCode", () => {
  it("accepts a bare code", () => {
    expect(parsePastedCode("123456", POLICY)).toBe("123456");
  });

  it("strips the prose an email client copies along with the code", () => {
    expect(parsePastedCode("Your code: 123 456\n", POLICY)).toBe("123456");
  });

  it("truncates to the configured code length", () => {
    expect(parsePastedCode("1234567890", POLICY)).toBe("123456");
  });

  it("accepts Arabic-Indic digits, which an Arabic mail client may produce", () => {
    expect(parsePastedCode("٠١٢٣٤٥", POLICY)).toBe("012345");
  });

  it("accepts Extended Arabic-Indic digits", () => {
    expect(parsePastedCode("۹۸۷۶۵۴", POLICY)).toBe("987654");
  });

  it("returns empty for a paste with no digits at all", () => {
    expect(parsePastedCode("لا يوجد رمز", POLICY)).toBe("");
  });
});

describe("normaliseDigits", () => {
  it("leaves ASCII digits untouched", () => {
    expect(normaliseDigits("0123456789")).toBe("0123456789");
  });

  it("converts both Arabic digit ranges", () => {
    expect(normaliseDigits("٠٩ ۰۹")).toBe("09 09");
  });

  it("leaves surrounding Arabic text alone", () => {
    expect(normaliseDigits("الرمز ٤٢")).toBe("الرمز 42");
  });
});
