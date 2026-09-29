import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  int,
  mysqlTable,
  primaryKey,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { ID_LENGTH, id, ref } from "./columns";
import { SCOPES } from "@/lib/permissions";

/**
 * Roles, capabilities and the grants between them — session 3.
 *
 * The point of these three tables is that `settings/permissions.html` means
 * something. Until session 3 a role's capabilities were a constant in
 * `src/lib/permissions.ts`, so "editable by an admin" was a screenshot. Now
 * the constant is the *seed* and these rows are the authority: the server
 * resolves every capability check from `role_permission`, and the matrix
 * screen edits the same rows the check reads.
 *
 * `CAPABILITIES` in `src/lib/permissions.ts` stays the source of the *catalog*
 * — the set of strings the code is allowed to ask about — because a capability
 * the code checks but the table lacks would resolve to "denied" silently. The
 * catalog is code; who holds what is data.
 */

/* -------------------------------------------------------------------------- */
/*  Scope                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * How far a role can see. **Scope is not a capability**, and conflating them
 * is the mistake this column exists to prevent: a team leader and a department
 * head both hold `tasks.assign`, and no capability string distinguishes "the
 * tasks of my team" from "the tasks of my department". The capability decides
 * *what action*; the scope decides *over which rows*. Both are checked.
 *
 * Stored as a varchar rather than a MySQL `ENUM` so that adding a scope is a
 * data change, not an `ALTER TABLE` on the busiest table in the system. The
 * value is validated by Zod on the way in and narrowed by `enum` on the way
 * out.
 *
 * `SCOPES` itself lives in `src/lib/permissions.ts`, not here. The add-role
 * dialog is a client component and needs the four values, and importing them
 * from this module pulled the whole Drizzle schema — `node:crypto` included —
 * into the browser bundle.
 */

/* -------------------------------------------------------------------------- */
/*  Tables                                                                    */
/* -------------------------------------------------------------------------- */

export const role = mysqlTable(
  "role",
  {
    id: id(),
    /** `قائد الفريق` — user-entered, one language. See OPEN_QUESTIONS Q21. */
    name: varchar({ length: 128 }).notNull(),
    /** `lead` — immutable after creation, as the modal's help text promises. */
    key: varchar({ length: 64 }).notNull(),
    scope: varchar({ length: 8, enum: SCOPES }).notNull().default("own"),
    /**
     * The wireframe writes a seeded role's reach in its own words — "قسمه
     * بالكامل", "النظام بالكامل" — which are not the four words the create
     * modal offers. Null for a role an admin creates, which then renders the
     * canonical label for its scope.
     */
    scopeLabel: varchar({ length: 128 }),
    /** The sentence after the permission count on the roles list. */
    description: varchar({ length: 512 }),
    /** Glyph key, resolved by `src/features/access/role-icon.tsx`. */
    icon: varchar({ length: 32 }).notNull().default("badge"),
    /**
     * A system role cannot be deleted and `admin` additionally cannot be
     * edited. Seeded true for all five; a role an admin creates is false.
     */
    isSystem: boolean().notNull().default(false),
    sortOrder: int().notNull().default(0),
  },
  (table) => [
    uniqueIndex("role_key_key").on(table.key),
    index("role_sort_order_idx").on(table.sortOrder),
  ],
);

/**
 * The capability catalog, seeded from `CAPABILITIES`.
 *
 * Labels are columns rather than `messages/*.json` keys because a capability
 * is data: adding one is a seed row, and requiring a code deploy to give it a
 * name would undo that. Both locales are stored, because the matrix renders in
 * whichever one the user is reading.
 */
export const permission = mysqlTable(
  "permission",
  {
    key: varchar({ length: 64 }).primaryKey(),
    /** `tasks`, `team`, `management`, `system` — the matrix's four bands. */
    groupKey: varchar({ length: 32 }).notNull(),
    labelAr: varchar({ length: 128 }).notNull(),
    labelEn: varchar({ length: 128 }).notNull(),
    sortOrder: int().notNull(),
  },
  (table) => [index("permission_group_key_sort_order_idx").on(table.groupKey, table.sortOrder)],
);

/**
 * One row per granted cell of the matrix.
 *
 * Wildcards (`tasks.*`, `*`) are stored literally, exactly as they appear in
 * `ROLES`, and resolved at check time by `grantsInclude()`. Storing the
 * expansion instead would make "manager has everything under tasks" silently
 * stop being true the day a capability is added.
 */
export const rolePermission = mysqlTable(
  "role_permission",
  {
    roleId: ref()
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    /**
     * Not a foreign key to `permission.key`, because a wildcard grant is a
     * legal value here and is not a row there.
     */
    permissionKey: varchar({ length: ID_LENGTH }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionKey] }),
    index("role_permission_role_id_idx").on(table.roleId),
    index("role_permission_permission_key_idx").on(table.permissionKey),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Relations                                                                 */
/* -------------------------------------------------------------------------- */

export const roleRelations = relations(role, ({ many }) => ({
  permissions: many(rolePermission),
}));

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  role: one(role, { fields: [rolePermission.roleId], references: [role.id] }),
}));
