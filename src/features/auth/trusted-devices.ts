import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { trustedDevice, verification } from "@/db/schema";
import { twoFactorPolicy } from "@/lib/policy";
import { clientIp, describeDevice, isTrustWindowOpen, trustExpiry } from "./device";

/**
 * The trusted-device register.
 *
 * ## Two tables, one authority
 *
 * Better Auth decides whether a device is trusted, from a signed cookie plus a
 * `verification` row under `trust-device-<random>`. This register is keyed by
 * that same identifier and adds only description: the label, OS, browser, IP
 * and last-seen time that `pages/auth/trusted-devices.html` lists.
 *
 * The authority is never duplicated. A row here does not make a device trusted
 * and cannot un-trust one; to revoke, the `verification` row goes too — see
 * `revokeTrustedDevice` and `revokeAllTrustedDevices` in `./password-history.ts`.
 * The alternative (this table deciding) would mean two sources that can
 * disagree about who is allowed in, which is the one thing an auth system
 * cannot afford.
 *
 * ## The per-user cap
 *
 * "أقصى عدد أجهزة موثوقة لكل مستخدم: 5". Enforced by evicting the
 * least-recently-used grant when a new one would exceed it, rather than by
 * refusing the new device: a user signing in from a new laptop should not be
 * told to go and clean up a list first.
 */

export const TRUST_COOKIE_SUFFIX = "trust_device";

/** The prefix Better Auth gives every trust grant's verification identifier. */
const TRUST_IDENTIFIER_PREFIX = "trust-device-";

/**
 * Pulls the grant identifier out the trust cookie Better Auth just set.
 *
 * The cookie value is `<hmac>!<identifier>`, and Next's cookie jar may hand it
 * back still signed as `<value>.<signature>`. Both shapes are handled here
 * because this is the one place that knows the format, and it is covered by
 * unit tests for exactly that reason.
 */
export function parseTrustIdentifier(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;

  // Strip a cookie signature if one is still attached.
  const unsigned = cookieValue.includes(".")
    ? cookieValue.slice(0, cookieValue.lastIndexOf("."))
    : cookieValue;

  const identifier = unsigned.split("!")[1];
  if (!identifier?.startsWith(TRUST_IDENTIFIER_PREFIX)) return null;
  return identifier;
}

/**
 * Records the device behind a freshly granted trust, or refreshes the row when
 * the same device signs in again.
 *
 * Never throws: failing to describe a device must not fail a sign-in that has
 * already succeeded. A missing row costs the user a line in a settings list;
 * a thrown error would cost them the session they just earned.
 */
export async function recordTrustedDevice({
  userId,
  trustIdentifier,
  headers,
  now = new Date(),
}: {
  userId: string;
  trustIdentifier: string;
  headers: Headers;
  now?: Date;
}): Promise<void> {
  try {
    const device = describeDevice(headers.get("user-agent"));
    const expiresAt = trustExpiry(now);

    await db()
      .insert(trustedDevice)
      .values({
        id: randomUUID(),
        userId,
        trustIdentifier,
        label: device.label,
        os: device.os,
        browser: device.browser,
        kind: device.kind,
        ipAddress: clientIp(headers),
        lastSeenAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: trustedDevice.trustIdentifier,
        set: { lastSeenAt: now, expiresAt, ipAddress: clientIp(headers) },
      });

    await enforceDeviceCap(userId);
  } catch (error) {
    console.error("[auth/trusted-devices] could not record the device:", error);
  }
}

/**
 * Marks a trusted device as used. Better Auth rotates the grant identifier on
 * every sign-in through a trusted device, so the register follows the rotation
 * rather than accumulating one dead row per sign-in.
 */
export async function refreshTrustedDevice({
  userId,
  previousIdentifier,
  trustIdentifier,
  headers,
  now = new Date(),
}: {
  userId: string;
  previousIdentifier: string | null;
  trustIdentifier: string;
  headers: Headers;
  now?: Date;
}): Promise<void> {
  try {
    if (previousIdentifier && previousIdentifier !== trustIdentifier) {
      const updated = await db()
        .update(trustedDevice)
        .set({
          trustIdentifier,
          lastSeenAt: now,
          expiresAt: trustExpiry(now),
          ipAddress: clientIp(headers),
        })
        .where(
          and(
            eq(trustedDevice.userId, userId),
            eq(trustedDevice.trustIdentifier, previousIdentifier),
          ),
        )
        .returning({ id: trustedDevice.id });

      if (updated.length > 0) return;
    }

    await recordTrustedDevice({ userId, trustIdentifier, headers, now });
  } catch (error) {
    console.error("[auth/trusted-devices] could not refresh the device:", error);
  }
}

/**
 * The devices to show on `/settings/trusted-devices` (session 20): live grants
 * only, most recently used first — "مرتبة بآخر استخدام".
 */
export async function listTrustedDevices(userId: string, now = new Date()) {
  const rows = await db()
    .select()
    .from(trustedDevice)
    .where(and(eq(trustedDevice.userId, userId), gt(trustedDevice.expiresAt, now)))
    .orderBy(desc(trustedDevice.lastSeenAt));

  // The absolute re-verification ceiling can close a window the row's own
  // expiry has not reached, so the list filters on the same predicate the
  // sign-in path uses rather than on `expiresAt` alone.
  return rows.filter((row) => isTrustWindowOpen(row, now));
}

/** Revokes one grant: the register row and the authority behind it. */
export async function revokeTrustedDevice({
  userId,
  trustIdentifier,
}: {
  userId: string;
  trustIdentifier: string;
}): Promise<void> {
  await db()
    .delete(trustedDevice)
    .where(
      and(eq(trustedDevice.userId, userId), eq(trustedDevice.trustIdentifier, trustIdentifier)),
    );

  await db().delete(verification).where(eq(verification.identifier, trustIdentifier));
}

/**
 * Evicts the least-recently-used grants beyond the per-user cap. Unlimited
 * (`null`) is a valid policy value and short-circuits.
 */
async function enforceDeviceCap(userId: string): Promise<void> {
  const cap = twoFactorPolicy().maxTrustedDevicesPerUser;
  if (cap === null) return;

  const rows = await db()
    .select({ trustIdentifier: trustedDevice.trustIdentifier })
    .from(trustedDevice)
    .where(eq(trustedDevice.userId, userId))
    .orderBy(asc(trustedDevice.lastSeenAt));

  const excess = rows.length - cap;
  if (excess <= 0) return;

  for (const row of rows.slice(0, excess)) {
    await revokeTrustedDevice({ userId, trustIdentifier: row.trustIdentifier });
  }
}
