import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { ROLE_KEYS, type RoleKey } from "@/lib/permissions";

/**
 * Authentication tables.
 *
 * The first five are Better Auth's own contract (`user`, `session`, `account`,
 * `verification`, `two_factor`) — their column names and types are dictated by
 * the adapter, so they are transcribed rather than designed. Better Auth's
 * `casing: "snake_case"` in `src/db/index.ts` maps its camelCase field names
 * onto these columns.
 *
 * The last three are this project's, and each exists because the wireframe
 * promises something Better Auth does not model:
 *
 *   trusted_device    pages/auth/trusted-devices.html lists a device by
 *                     label, OS, browser, IP and last use. Better Auth's trust
 *                     is a signed cookie plus a `verification` row and carries
 *                     no such metadata.
 *   login_attempt     pages/settings/security.html promises lockout after N
 *                     failed sign-ins for a configured duration. Better Auth
 *                     has no password-attempt ledger.
 *   password_history  pages/auth/reset-password.html promises "لا تطابق آخر
 *                     خمس كلمات مرور استخدمتها" — the last five, as hashes.
 */

/* -------------------------------------------------------------------------- */
/*  Better Auth core                                                          */
/* -------------------------------------------------------------------------- */

/**
 * `role` is a plain key here, not a foreign key. The role and permission
 * tables land in session 3; until then this column carries one of
 * `ROLE_KEYS` and `src/lib/permissions.ts` resolves its capabilities. Session
 * 3 migrates it to a `role_id` reference.
 */
export const user = pgTable(
  "user",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    role: text({ enum: ROLE_KEYS }).notNull().default("agent").$type<RoleKey>(),
    twoFactorEnabled: boolean().notNull().default(false),
    /** Set on every successful password change; drives the 90-day expiry. */
    passwordChangedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("user_email_key").on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    token: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("session_token_key").on(table.token),
    index("session_user_id_idx").on(table.userId),
    // /settings/security lists a user's active sessions newest first.
    index("session_user_id_expires_at_idx").on(table.userId, table.expiresAt),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    idToken: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_key").on(table.providerId, table.accountId),
  ],
);

/**
 * Better Auth's single-use token store. It holds the password-reset token, the
 * half-authenticated 2FA challenge, the emailed code, the per-challenge
 * attempt counter and the trusted-device grant — all keyed by `identifier`,
 * which is what every lookup filters on.
 */
export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier),
    // Expired rows are swept by identifier prefix and date.
    index("verification_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * Better Auth's `twoFactor` table. The emailed code lives in `verification`,
 * not here; this row exists so the plugin has somewhere to keep the
 * account-level failure budget (`failedVerificationCount`, `lockedUntil`) that
 * enforces "بعد 5 محاولات خاطئة … إيقاف مؤقت 15 دقيقة".
 */
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    secret: text().notNull(),
    backupCodes: text().notNull(),
    verified: boolean().notNull().default(true),
    failedVerificationCount: integer().notNull().default(0),
    lockedUntil: timestamp({ withTimezone: true }),
  },
  (table) => [index("two_factor_user_id_idx").on(table.userId)],
);

/* -------------------------------------------------------------------------- */
/*  Project tables                                                            */
/* -------------------------------------------------------------------------- */

export const DEVICE_KINDS = ["desktop", "mobile", "tablet", "unknown"] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

/**
 * The human-readable register of trusted devices.
 *
 * The *authority* on whether a device is trusted stays with Better Auth: a
 * signed cookie plus a `verification` row under `trust-device-<random>`. This
 * table is keyed by that same identifier and carries the description the
 * wireframe's list needs. Keeping one authority avoids the failure mode where
 * a row here says trusted and the cookie says otherwise.
 */
export const trustedDevice = pgTable(
  "trusted_device",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Better Auth's `verification.identifier` for this grant. */
    trustIdentifier: text().notNull(),
    /** "Windows 11 · Chrome" — what the list shows as the row title. */
    label: text().notNull(),
    os: text().notNull(),
    browser: text().notNull(),
    kind: text({ enum: DEVICE_KINDS }).notNull().default("unknown").$type<DeviceKind>(),
    ipAddress: text(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trusted_device_trust_identifier_key").on(table.trustIdentifier),
    index("trusted_device_user_id_idx").on(table.userId),
    // The list is "مرتبة بآخر استخدام", and the per-user cap counts live rows.
    index("trusted_device_user_id_last_seen_at_idx").on(table.userId, table.lastSeenAt),
    index("trusted_device_user_id_expires_at_idx").on(table.userId, table.expiresAt),
  ],
);

/**
 * The sign-in attempt ledger behind the lockout policy.
 *
 * Keyed by lower-cased email rather than `user_id`, deliberately: an attempt
 * against an address with no account must be counted too, or the ledger
 * becomes an account-existence oracle. There is no foreign key for the same
 * reason.
 */
export const loginAttempt = pgTable(
  "login_attempt",
  {
    id: text().primaryKey(),
    email: text().notNull(),
    ipAddress: text(),
    userAgent: text(),
    succeeded: boolean().notNull().default(false),
    attemptedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The lockout check counts failures for one email inside a time window.
    index("login_attempt_email_attempted_at_idx").on(table.email, table.attemptedAt),
  ],
);

/**
 * Hashes of previously used passwords, so a reset cannot reuse one of the last
 * five. Only hashes — the plaintext is never stored, as the reset screen's
 * "كيف تُخزَّن كلمة المرور" panel states.
 */
export const passwordHistory = pgTable(
  "password_history",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    passwordHash: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("password_history_user_id_idx").on(table.userId),
    // "the last five" is a per-user ordered read.
    index("password_history_user_id_created_at_idx").on(table.userId, table.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Relations                                                                 */
/* -------------------------------------------------------------------------- */

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  trustedDevices: many(trustedDevice),
  passwordHistory: many(passwordHistory),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const trustedDeviceRelations = relations(trustedDevice, ({ one }) => ({
  user: one(user, { fields: [trustedDevice.userId], references: [user.id] }),
}));

export const passwordHistoryRelations = relations(passwordHistory, ({ one }) => ({
  user: one(user, { fields: [passwordHistory.userId], references: [user.id] }),
}));
