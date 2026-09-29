import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db, type Executor } from "@/db";
import { permission, role, rolePermission } from "@/db/schema";
import { CAPABILITIES, CAPABILITY_META, ROLES, ROLE_KEYS, type RoleKey } from "@/lib/permissions";

/**
 * Seeds the five roles, the capability catalog and the default grants.
 *
 * `CAPABILITIES` and `ROLES` in `src/lib/permissions.ts` are the **source**;
 * these tables are the copy an administrator edits. That direction matters in
 * both places it is used:
 *
 *   - `pnpm db:seed` writes the source into an empty database.
 *   - **استعادة الافتراضي** on the permissions screen writes it again, over
 *     whatever the matrix currently holds.
 *
 * Which is why the grant writer below is exported rather than inlined: "the
 * defaults" must mean exactly one thing, or the button restores a set nobody
 * has ever seen.
 *
 * Everything here is idempotent and keyed on the stable `key` column, so
 * re-running never duplicates a row and never changes a role's id — ids are
 * referenced by `user.role_id`, and a re-seed that rotated them would detach
 * every account from its role.
 */

export type SeedCounts = { roles: number; permissions: number; grants: number };

/**
 * Replaces the capability catalog with the code's.
 *
 * Replaced wholesale rather than upserted, because the catalog is entirely
 * code-owned: a row that is no longer in `CAPABILITIES` is a capability the
 * code has stopped enforcing, and leaving it in the table would keep offering
 * an admin a switch that controls nothing. `role_permission.permission_key` is
 * deliberately not a foreign key onto this table — wildcards are legal grants
 * and are not rows here — so clearing it cannot cascade a grant away.
 */
export async function seedPermissions(client: Executor = db()): Promise<number> {
  const rows = CAPABILITIES.map((key, index) => ({
    key,
    groupKey: CAPABILITY_META[key].group,
    labelAr: CAPABILITY_META[key].labelAr,
    labelEn: CAPABILITY_META[key].labelEn,
    sortOrder: index,
  }));

  await client.delete(permission);
  await client.insert(permission).values(rows);

  return rows.length;
}

/**
 * Upserts the five roles and returns their ids by key.
 *
 * A role that already exists keeps its id and its **name, scope and
 * description are left alone** — those are the admin's to change, and a seed
 * that overwrote them would undo a rename on every deploy. Only `isSystem`
 * and `sortOrder` are re-asserted, because they are structural.
 */
export async function seedRoles(client: Executor = db()): Promise<Record<RoleKey, string>> {
  const existing = await client
    .select({ id: role.id, key: role.key })
    .from(role)
    .where(inArray(role.key, [...ROLE_KEYS]));

  const idByKey = new Map(existing.map((row) => [row.key, row.id]));
  const missing = ROLE_KEYS.filter((key) => !idByKey.has(key));

  if (missing.length > 0) {
    const rows = missing.map((key) => {
      const definition = ROLES[key];
      return {
        id: randomUUID(),
        key,
        name: definition.label,
        scope: definition.reach,
        scopeLabel: definition.scope,
        description: definition.description,
        icon: definition.icon,
        isSystem: true,
        sortOrder: ROLE_KEYS.indexOf(key),
      };
    });
    await client.insert(role).values(rows);
    for (const row of rows) idByKey.set(row.key, row.id);
  }

  return Object.fromEntries(ROLE_KEYS.map((key) => [key, idByKey.get(key)!])) as Record<
    RoleKey,
    string
  >;
}

/**
 * Replaces the grants of the given roles with the seed defaults.
 *
 * Delete-then-insert rather than a diff, because "restore" means the stored
 * set equals the default set — including the rows an admin *added*, which a
 * diff-and-upsert would leave behind. Pass a transaction when the caller needs
 * the replacement to be atomic; the permissions screen always does.
 */
export async function restoreDefaultGrants(
  idByKey: Record<RoleKey, string>,
  client: Executor = db(),
): Promise<number> {
  const ids = ROLE_KEYS.map((key) => idByKey[key]);
  await client.delete(rolePermission).where(inArray(rolePermission.roleId, ids));

  const rows = ROLE_KEYS.flatMap((key) =>
    ROLES[key].grants.map((grant) => ({ roleId: idByKey[key], permissionKey: grant })),
  );

  await client.insert(rolePermission).values(rows);
  return rows.length;
}

/**
 * The whole access model, from an empty database to a usable one.
 *
 * Grants are only written for roles that had none. A re-seed of a live system
 * must not silently revoke an administrator's edits — that is what the
 * explicit **استعادة الافتراضي** button is for, and it asks first.
 */
export async function seedAccess(client: Executor = db()): Promise<SeedCounts> {
  const permissions = await seedPermissions(client);
  const idByKey = await seedRoles(client);

  const held = await client
    .select({ roleId: rolePermission.roleId })
    .from(rolePermission)
    .where(inArray(rolePermission.roleId, Object.values(idByKey)));

  if (held.length > 0) {
    return { roles: ROLE_KEYS.length, permissions, grants: 0 };
  }

  const grants = await restoreDefaultGrants(idByKey, client);
  return { roles: ROLE_KEYS.length, permissions, grants };
}
