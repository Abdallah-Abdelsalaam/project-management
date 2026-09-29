import { describe, expect, it } from "vitest";
import { clientIp, describeDevice, isTrustWindowOpen, trustExpiry } from "./device";
import { twoFactorPolicy } from "@/lib/policy";

const POLICY = twoFactorPolicy();
const NOW = new Date("2026-09-29T12:00:00.000Z");

const AGENTS = {
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipadSafari:
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/604.1",
  macFirefox:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
} as const;

describe("describeDevice", () => {
  it("produces the wireframe's label format", () => {
    expect(describeDevice(AGENTS.windowsChrome)).toEqual({
      label: "Windows · Chrome",
      os: "Windows",
      browser: "Chrome",
      kind: "desktop",
    });
  });

  it("recognises Edge rather than the Chrome it also claims to be", () => {
    expect(describeDevice(AGENTS.windowsEdge).browser).toBe("Edge");
  });

  it("recognises Safari on iPhone and marks it mobile", () => {
    expect(describeDevice(AGENTS.iphoneSafari)).toMatchObject({
      os: "iOS",
      browser: "Safari",
      kind: "mobile",
    });
  });

  it("distinguishes an iPad from the macOS it advertises", () => {
    expect(describeDevice(AGENTS.ipadSafari)).toMatchObject({ os: "iPadOS", kind: "tablet" });
  });

  it("recognises Firefox on macOS", () => {
    expect(describeDevice(AGENTS.macFirefox)).toMatchObject({ os: "macOS", browser: "Firefox" });
  });

  it("prefers Android over the Linux it also reports", () => {
    expect(describeDevice(AGENTS.androidChrome)).toMatchObject({
      os: "Android",
      browser: "Chrome",
      kind: "mobile",
    });
  });

  it("degrades to a single unknown label rather than half a description", () => {
    expect(describeDevice("")).toEqual({
      label: "غير معروف",
      os: "غير معروف",
      browser: "غير معروف",
      kind: "unknown",
    });
  });

  it("treats a missing header the same as an empty one", () => {
    expect(describeDevice(null).kind).toBe("unknown");
  });
});

describe("clientIp", () => {
  it("takes the left-most entry of a forwarded chain", () => {
    const headers = new Headers({ "x-forwarded-for": "156.203.44.18, 10.0.0.1, 10.0.0.2" });
    expect(clientIp(headers)).toBe("156.203.44.18");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(new Headers({ "x-real-ip": "41.68.112.9" }))).toBe("41.68.112.9");
  });

  it("returns null rather than a guess when no proxy header is present", () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("trust window", () => {
  it("expires a grant after the configured number of days", () => {
    expect(trustExpiry(NOW, POLICY)).toEqual(
      new Date(NOW.getTime() + POLICY.trustedDeviceDays * 24 * 60 * 60 * 1000),
    );
  });

  it("is open the day before expiry", () => {
    const grant = { createdAt: NOW, expiresAt: trustExpiry(NOW, POLICY) };
    const dayBefore = new Date(grant.expiresAt.getTime() - 24 * 60 * 60 * 1000);
    expect(isTrustWindowOpen(grant, dayBefore, POLICY)).toBe(true);
  });

  it("is closed at the expiry instant", () => {
    const grant = { createdAt: NOW, expiresAt: trustExpiry(NOW, POLICY) };
    expect(isTrustWindowOpen(grant, grant.expiresAt, POLICY)).toBe(false);
  });

  it("is closed after the expiry, so the second factor is required again", () => {
    const grant = { createdAt: NOW, expiresAt: trustExpiry(NOW, POLICY) };
    const after = new Date(grant.expiresAt.getTime() + 1000);
    expect(isTrustWindowOpen(grant, after, POLICY)).toBe(false);
  });

  it("closes at the absolute re-verification ceiling even if the grant says otherwise", () => {
    // A grant whose expiry was extended past the organisation's hard ceiling.
    const grant = {
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 365 * 24 * 60 * 60 * 1000),
    };
    const pastCeiling = new Date(
      NOW.getTime() + (POLICY.forceReverifyDays + 1) * 24 * 60 * 60 * 1000,
    );
    expect(isTrustWindowOpen(grant, pastCeiling, POLICY)).toBe(false);
  });

  it("stays open inside the ceiling", () => {
    const grant = {
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 365 * 24 * 60 * 60 * 1000),
    };
    const insideCeiling = new Date(
      NOW.getTime() + (POLICY.forceReverifyDays - 1) * 24 * 60 * 60 * 1000,
    );
    expect(isTrustWindowOpen(grant, insideCeiling, POLICY)).toBe(true);
  });
});
