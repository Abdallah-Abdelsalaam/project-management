import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { ID_LENGTH, id, ref, ts, tsNow } from "./columns";
import { role } from "./access";

/**
 * Authentication tables.
 *
 * The first five are Better Auth's own contract (`user`, `session`, `account`,
 * `verification`, `two_factor`) — their column names are dictated by the
 * adapter, so they are transcribed rather than designed. `casing:
 * "snake_case"` in `src/db/index.ts` maps its camelCase field names onto these
 * columns.
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
 *
 * Column types follow `./columns.ts`; the reasoning for the lengths and the
 * `DATETIME(3)`-in-UTC convention lives there.
 */

/* -------------------------------------------------------------------------- */
/*  Better Auth core                                                          */
/* -------------------------------------------------------------------------- */

/**
 * `role_id` is a foreign key, as of session 3. It was a text role key through
 * session 2, while the role tables did not yet exist; the capabilities a user
 * holds are now resolved from `role_permission` rather than from a constant in
 * the source, which is what makes the permission matrix screen mean anything.
 */
export const user = mysqlTable(
  "user",
  {
    id: id(),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    roleId: ref()
      .notNull()
      .references(() => role.id, { onDelete: "restrict" }),
    twoFactorEnabled: boolean().notNull().default(false),
    /** Set on every successful password change; drives the 90-day expiry. */
    passwordChangedAt: ts(),
    createdAt: tsNow(),
    updatedAt: tsNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("user_email_key").on(table.email),
    index("user_role_id_idx").on(table.roleId),
  ],
);

export const session = mysqlTable(
  "session",
  {
    id: id(),
    token: varchar({ length: 255 }).notNull(),
    userId: ref()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: ts().notNull(),
    ipAddress: varchar({ length: 64 }),
    userAgent: text(),
    createdAt: tsNow(),
    updatedAt: tsNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("session_token_key").on(table.token),
    index("session_user_id_idx").on(table.userId),
    // /settings/security lists a user's active sessions newest first.
    index("session_user_id_expires_at_idx").on(table.userId, table.expiresAt),
  ],
);

export const account = mysqlTable(
  "account",
  {
    id: id(),
    userId: ref()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: varchar({ length: ID_LENGTH }).notNull(),
    providerId: varchar({ length: 64 }).notNull(),
    accessToken: text(),
    refreshToken: text(),
    accessTokenExpiresAt: ts(),
    refreshTokenExpiresAt: ts(),
    scope: text(),
    idToken: text(),
    /** `salt:hash`, hex, from Better Auth's own scrypt. Never a plaintext. */
    password: varchar({ length: 255 }),
    createdAt: tsNow(),
    updatedAt: tsNow().$onUpdateFn(() => new Date()),
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
export const verification = mysqlTable(
  "verification",
  {
    id: id(),
    identifier: varchar({ length: 255 }).notNull(),
    value: text().notNull(),
    expiresAt: ts().notNull(),
    createdAt: tsNow(),
    updatedAt: tsNow().$onUpdateFn(() => new Date()),
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
export const twoFactor = mysqlTable(
  "two_factor",
  {
    id: id(),
    userId: ref()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    secret: text().notNull(),
    backupCodes: text().notNull(),
    verified: boolean().notNull().default(true),
    failedVerificationCount: int().notNull().default(0),
    lockedUntil: ts(),
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
export const trustedDevice = mysqlTable(
  "trusted_device",
  {
    id: id(),
    userId: ref()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Better Auth's `verification.identifier` for this grant. */
    trustIdentifier: varchar({ length: 255 }).notNull(),
    /** "Windows 11 · Chrome" — what the list shows as the row title. */
    label: varchar({ length: 255 }).notNull(),
    os: varchar({ length: 64 }).notNull(),
    browser: varchar({ length: 64 }).notNull(),
    kind: varchar({ length: 16, enum: DEVICE_KINDS }).notNull().default("unknown"),
    ipAddress: varchar({ length: 64 }),
    lastSeenAt: tsNow(),
    expiresAt: ts().notNull(),
    createdAt: tsNow(),
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
export const loginAttempt = mysqlTable(
  "login_attempt",
  {
    id: id(),
    email: varchar({ length: 255 }).notNull(),
    ipAddress: varchar({ length: 64 }),
    userAgent: text(),
    succeeded: boolean().notNull().default(false),
    attemptedAt: tsNow(),
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
export const passwordHistory = mysqlTable(
  "password_history",
  {
    id: id(),
    userId: ref()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    passwordHash: varchar({ length: 255 }).notNull(),
    createdAt: tsNow(),
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

export const userRelations = relations(user, ({ one, many }) => ({
  role: one(role, { fields: [user.roleId], references: [role.id] }),
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
