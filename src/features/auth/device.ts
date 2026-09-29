import { twoFactorPolicy, type TwoFactorPolicy } from "@/lib/policy";
import type { DeviceKind } from "@/db/schema";

/**
 * Describing a device from its request headers.
 *
 * `wireframe/pages/auth/trusted-devices.html` shows rows titled "Windows 11 ·
 * Chrome" and "iPhone 15 · Safari", so a label, an OS and a browser have to
 * come from somewhere. That somewhere is the User-Agent string, which is
 * self-reported and therefore never a security input — it is a description
 * shown to a human deciding whether they recognise a device. The trust decision
 * rests on the signed cookie, not on this.
 *
 * Deliberately hand-rolled rather than a UA-parsing dependency: five families
 * of OS and five of browser is the whole requirement, and a parser library is
 * a monthly-updated regex database we would have to keep current for no gain.
 */

export type DeviceDescription = {
  label: string;
  os: string;
  browser: string;
  kind: DeviceKind;
};

const UNKNOWN = "غير معروف";

/** Order matters: Edge and Opera both claim to be Chrome, so they come first. */
const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\b(?:OPR|Opera)\//, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

/** Likewise: iPadOS advertises "Mac OS X", so the iPad test precedes macOS. */
const OPERATING_SYSTEMS: ReadonlyArray<[RegExp, string, DeviceKind]> = [
  [/Windows NT 10\.0/, "Windows", "desktop"],
  [/Windows NT/, "Windows", "desktop"],
  [/\biPad\b/, "iPadOS", "tablet"],
  [/\biPhone\b|\biPod\b/, "iOS", "mobile"],
  [/\bAndroid\b/, "Android", "mobile"],
  [/Mac OS X|Macintosh/, "macOS", "desktop"],
  [/\bCrOS\b/, "ChromeOS", "desktop"],
  [/\bLinux\b|\bX11\b/, "Linux", "desktop"],
];

function match(userAgent: string, table: ReadonlyArray<[RegExp, string]>): string | null {
  for (const [pattern, name] of table) {
    if (pattern.test(userAgent)) return name;
  }
  return null;
}

export function describeDevice(userAgent: string | null | undefined): DeviceDescription {
  const ua = userAgent ?? "";

  const browser = match(ua, BROWSERS) ?? UNKNOWN;

  let os = UNKNOWN;
  let kind: DeviceKind = "unknown";
  for (const [pattern, name, deviceKind] of OPERATING_SYSTEMS) {
    if (pattern.test(ua)) {
      os = name;
      kind = deviceKind;
      break;
    }
  }

  // "Android · Chrome" reads better than "Android Chrome", and matches the
  // wireframe's separator exactly.
  const label = os === UNKNOWN && browser === UNKNOWN ? UNKNOWN : `${os} · ${browser}`;

  return { label, os, browser, kind };
}

/**
 * The client IP, from the proxy headers Vercel sets. `x-forwarded-for` may be a
 * chain; the left-most entry is the original client. Returns `null` rather than
 * a guess when there is no header, because a wrong IP in a security list is
 * worse than a blank one.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? null;
}

/** When a trust grant created now would expire. */
export function trustExpiry(
  now: Date = new Date(),
  policy: TwoFactorPolicy = twoFactorPolicy(),
): Date {
  return new Date(now.getTime() + policy.trustedDeviceDays * 24 * 60 * 60 * 1000);
}

/**
 * Whether a trust grant is still inside its window.
 *
 * Two ceilings apply, and the tighter one wins: the per-grant expiry, and the
 * organisation's absolute re-verification interval — "إعادة تحقق قصوى بصرف
 * النظر عن أي إعداد آخر". A trust window longer than that ceiling would
 * silently defeat it, so the grant's creation date is checked too.
 */
export function isTrustWindowOpen(
  grant: { createdAt: Date; expiresAt: Date },
  now: Date = new Date(),
  policy: TwoFactorPolicy = twoFactorPolicy(),
): boolean {
  if (grant.expiresAt.getTime() <= now.getTime()) return false;
  const hardCeiling = grant.createdAt.getTime() + policy.forceReverifyDays * 24 * 60 * 60 * 1000;
  return now.getTime() < hardCeiling;
}
