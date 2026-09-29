import { asc, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, permission, role, user } from "@/db/schema";
import { accessModel, isAdminRole, roleBreadth, type ResolvedRole } from "@/features/access/model";
import { CAPABILITY_GROUPS, grantsInclude, type CapabilityGroup } from "@/lib/permissions";
import type { Locale } from "@/i18n/routing";

/**
 * Reads for the two settings screens.
 *
 * Neither is cached. The access *model* is — it is on the hot path of every
 * request — but these are admin screens read a handful of times a day, and
 * both show numbers that must be current: a role's user count decides whether
 * it can be deleted, and a stale matrix would let an administrator save a diff
 * computed against someone else's edit.
 */

export type RoleListEntry = ResolvedRole & {
  userCount: number;
  /** `all` | `wildcard` | `counted` — which of the three phrasings to use. */
  breadth: ReturnType<typeof roleBreadth>;
  /** Protected: no delete, no rename, and its matrix column is locked. */
  isAdmin: boolean;
  /** Deletable only when it is neither a system role nor in use. */
  deletable: boolean;
};

/** The roles list, with the user count the wireframe shows in each row. */
export async function listRoles(): Promise<RoleListEntry[]> {
  const model = await accessModel();

  const counts = await db()
    .select({ roleId: user.roleId, total: count() })
    .from(user)
    .groupBy(user.roleId);

  const countByRole = new Map(counts.map((row) => [row.roleId, Number(row.total)]));

  return model.roles.map((resolved) => {
    const userCount = countByRole.get(resolved.id) ?? 0;
    return {
      ...resolved,
      userCount,
      breadth: roleBreadth(resolved),
      isAdmin: isAdminRole(resolved),
      deletable: !resolved.isSystem && userCount === 0,
    };
  });
}

/** Total users across all roles — the "26 مستخدمًا" beside the panel title. */
export async function countUsers(): Promise<number> {
  const [row] = await db().select({ total: count() }).from(user);
  return Number(row?.total ?? 0);
}

export type PermissionRow = {
  key: string;
  group: CapabilityGroup;
  label: string;
  sortOrder: number;
};

export type MatrixGroup = {
  group: CapabilityGroup;
  permissions: PermissionRow[];
};

export type MatrixRole = {
  id: string;
  name: string;
  isAdmin: boolean;
  /** Effective state of every capability, wildcards already resolved. */
  granted: Record<string, boolean>;
};

export type Matrix = {
  groups: MatrixGroup[];
  roles: MatrixRole[];
  total: number;
};

/**
 * The permission matrix.
 *
 * The catalog is read from `permission` rather than from `CAPABILITIES`, even
 * though the seed writes one from the other: the screen must show what the
 * database holds, or "restore defaults" would have nothing visible to restore
 * *to* and a drifted table would be invisible.
 *
 * Every cell is an **effective** state — a manager's `tasks.*` renders as
 * fourteen ticked boxes, not one. What the admin sees is what the server will
 * answer, which is the only version of this screen worth having.
 */
export async function loadMatrix(locale: Locale): Promise<Matrix> {
  const [model, catalog] = await Promise.all([
    accessModel(),
    db().select().from(permission).orderBy(asc(permission.sortOrder)),
  ]);

  const rows: PermissionRow[] = catalog.map((row) => ({
    key: row.key,
    group: (CAPABILITY_GROUPS as readonly string[]).includes(row.groupKey)
      ? (row.groupKey as CapabilityGroup)
      : "system",
    label: locale === "ar" ? row.labelAr : row.labelEn,
    sortOrder: row.sortOrder,
  }));

  const groups: MatrixGroup[] = CAPABILITY_GROUPS.map((group) => ({
    group,
    permissions: rows.filter((row) => row.group === group),
  })).filter((entry) => entry.permissions.length > 0);

  const roles: MatrixRole[] = model.roles.map((resolved) => ({
    id: resolved.id,
    name: resolved.name,
    isAdmin: isAdminRole(resolved),
    granted: Object.fromEntries(
      rows.map((row) => [row.key, grantsInclude(resolved.grants, row.key)]),
    ),
  }));

  return { groups, roles, total: rows.length };
}

/**
 * When the matrix was last changed, and by whom — the panel foot's "آخر
 * تعديل: اليوم 09:42 بواسطة دانة المهنا".
 *
 * Read from the audit log rather than from a column on `role`, because the
 * audit log is already the record of who changed what and a second copy could
 * disagree with it.
 */
const MATRIX_ACTIONS = ["permission.granted", "permission.revoked", "permission.restored"];

export async function lastMatrixChange(): Promise<{ at: Date; actor: string | null } | null> {
  const [row] = await db()
    .select({ at: auditLog.createdAt, actor: user.name })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorId, user.id))
    .where(inArray(auditLog.action, MATRIX_ACTIONS))
    .orderBy(desc(auditLog.createdAt))
    .limit(1);

  if (!row) return null;
  return { at: row.at, actor: row.actor };
}

/** One role by id, or undefined. */
export async function findRole(roleId: string): Promise<ResolvedRole | undefined> {
  return (await accessModel()).byId[roleId];
}

/** How many users hold a role — the delete guard reads this, not a cache. */
export async function countRoleUsers(roleId: string): Promise<number> {
  const [row] = await db().select({ total: count() }).from(user).where(eq(user.roleId, roleId));
  return Number(row?.total ?? 0);
}

/** Whether a role key is already taken. */
export async function roleKeyExists(key: string): Promise<boolean> {
  const [row] = await db().select({ id: role.id }).from(role).where(eq(role.key, key)).limit(1);
  return Boolean(row);
}
