"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { role, rolePermission, user } from "@/db/schema";
import { restoreDefaultGrants, seedRoles } from "@/db/seed-access";
import { assertLocale } from "@/i18n/routing";
import { CAPABILITIES, ROLES, SCOPES, grantsInclude, isCapability } from "@/lib/permissions";
import { requireCapability } from "@/features/auth/session";
import { auditContext, writeAudit, type AuditEntry } from "@/features/access/audit";
import { accessModel, isAdminRole, revalidateAccessModel } from "@/features/access/model";
import { applyCellChanges, type CellChange } from "@/features/access/matrix";
import { countRoleUsers, roleKeyExists } from "@/features/access/queries";

/**
 * The write path for roles and permissions.
 *
 * Every action follows the same five steps, in this order and without
 * exception: **Zod, session, capability, transaction with its audit rows,
 * revalidate.** The screens hide controls a user may not use, and that hiding
 * is worth nothing — each of these runs again on the server for a request that
 * never went near the UI.
 *
 * Three rules are enforced here and nowhere else, because here is the only
 * place a request cannot route around:
 *
 *   1. **The admin role is untouchable.** Not merely `disabled` in the DOM —
 *      a posted change naming it is refused. A system with no administrator
 *      able to repair it is unmanageable, which is the wireframe's own stated
 *      reason for locking the column.
 *   2. **Nobody grants what they do not hold.** Otherwise `settings.view` —
 *      the only capability the wireframe puts in front of this screen — is
 *      also a capability to award yourself every other one. See
 *      OPEN_QUESTIONS Q20.
 *   3. **A role in use cannot be deleted.** Checked against a live count
 *      inside the transaction, not against the cached model.
 */

/**
 * The capability that guards both screens.
 *
 * `settings.view` is the only settings capability the wireframe defines, and
 * `04-SCREENS.md` states plainly that "all settings routes require
 * settings.view". Rule 2 above is what keeps that from being a blank cheque.
 */
const SETTINGS = "settings.view" as const;

const localeSchema = z.enum(["ar", "en"]);

const createRoleSchema = z.object({
  locale: localeSchema,
  name: z.string().trim().min(1).max(128),
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    // Lower-case, underscore-separated, starting with a letter: it goes into
    // grant strings and URLs, and "المعرّف البرمجي … لا يمكن تغييره بعد
    // الإنشاء" means a loose value is permanent.
    .regex(/^[a-z][a-z0-9_]*$/),
  scope: z.enum(SCOPES),
  /** The role to copy grants from, or `""` for an empty role. */
  baseRoleId: z.string().trim().max(64).optional().default(""),
});

const updateRoleSchema = z.object({
  locale: localeSchema,
  roleId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(128),
  scope: z.enum(SCOPES),
});

const deleteRoleSchema = z.object({
  locale: localeSchema,
  roleId: z.string().trim().min(1).max(64),
});

const saveMatrixSchema = z.object({
  locale: localeSchema,
  changes: z
    .array(
      z.object({
        roleId: z.string().trim().min(1).max(64),
        capability: z.string().trim().min(1).max(64),
        granted: z.boolean(),
      }),
    )
    // A save cannot touch more cells than the matrix has.
    .max(CAPABILITIES.length * 32),
});

const restoreSchema = z.object({ locale: localeSchema });

export type ActionResult =
  | { status: "ok"; changed: number }
  | {
      status:
        | "invalid"
        | "forbidden"
        | "keyTaken"
        | "roleMissing"
        | "roleProtected"
        | "roleInUse"
        | "error";
    };

/* -------------------------------------------------------------------------- */
/*  Roles                                                                     */
/* -------------------------------------------------------------------------- */

export async function createRoleAction(input: unknown): Promise<ActionResult> {
  const parsed = createRoleSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };

  const { locale, name, key, scope, baseRoleId } = parsed.data;
  const session = await requireCapability(assertLocale(locale), SETTINGS);

  if (await roleKeyExists(key)) return { status: "keyTaken" };

  const model = await accessModel();
  const base = baseRoleId ? model.byId[baseRoleId] : undefined;
  if (baseRoleId && !base) return { status: "roleMissing" };

  // Copying a role you could not otherwise assemble is still granting what you
  // do not hold, so the copy is filtered by the actor's own reach. Copying the
  // admin role is therefore possible only for an admin, and produces explicit
  // grants rather than a second `*`.
  const grants = base ? withheldFiltered(base.grants, session.user.grants) : [];

  const roleId = crypto.randomUUID();
  const context = await auditContext(session.user.id);

  try {
    await db().transaction(async (tx) => {
      await tx.insert(role).values({
        id: roleId,
        name,
        key,
        scope,
        // Only the seeded five carry the wireframe's bespoke wording and
        // glyphs; a new role renders the canonical label for its scope.
        scopeLabel: null,
        description: null,
        icon: "badge",
        isSystem: false,
        sortOrder: model.roles.length,
      });

      if (grants.length > 0) {
        await tx
          .insert(rolePermission)
          .values(grants.map((grant) => ({ roleId, permissionKey: grant })));
      }

      await writeAudit(tx, context, [
        {
          action: "role.created",
          entityType: "role",
          entityId: roleId,
          valueTo: { name, key, scope, grants },
        },
      ]);
    });
  } catch (error) {
    console.error("[access] could not create the role:", error);
    return { status: "error" };
  }

  revalidateAccessModel();
  return { status: "ok", changed: 1 };
}

export async function updateRoleAction(input: unknown): Promise<ActionResult> {
  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };

  const { locale, roleId, name, scope } = parsed.data;
  const session = await requireCapability(assertLocale(locale), SETTINGS);

  const existing = (await accessModel()).byId[roleId];
  if (!existing) return { status: "roleMissing" };
  if (isAdminRole(existing)) return { status: "roleProtected" };

  const fields: AuditEntry[] = [];
  if (existing.name !== name) {
    fields.push({
      action: "role.updated",
      entityType: "role",
      entityId: roleId,
      field: "name",
      valueFrom: existing.name,
      valueTo: name,
    });
  }
  if (existing.scope !== scope) {
    fields.push({
      action: "role.updated",
      entityType: "role",
      entityId: roleId,
      field: "scope",
      valueFrom: existing.scope,
      valueTo: scope,
    });
  }

  if (fields.length === 0) return { status: "ok", changed: 0 };

  const context = await auditContext(session.user.id);

  try {
    await db().transaction(async (tx) => {
      await tx.update(role).set({ name, scope }).where(eq(role.id, roleId));
      await writeAudit(tx, context, fields);
    });
  } catch (error) {
    console.error("[access] could not update the role:", error);
    return { status: "error" };
  }

  revalidateAccessModel();
  return { status: "ok", changed: fields.length };
}

/**
 * Deletes a role, but only one that is neither a system role nor held by
 * anybody.
 *
 * The count is re-read here rather than taken from the list the admin was
 * looking at, because `user.role_id` is a `RESTRICT` foreign key and the
 * database would refuse the delete anyway — a friendly refusal beats a
 * constraint violation, and the two must agree.
 */
export async function deleteRoleAction(input: unknown): Promise<ActionResult> {
  const parsed = deleteRoleSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };

  const { locale, roleId } = parsed.data;
  const session = await requireCapability(assertLocale(locale), SETTINGS);

  const existing = (await accessModel()).byId[roleId];
  if (!existing) return { status: "roleMissing" };
  if (existing.isSystem || isAdminRole(existing)) return { status: "roleProtected" };
  if ((await countRoleUsers(roleId)) > 0) return { status: "roleInUse" };

  const context = await auditContext(session.user.id);

  try {
    await db().transaction(async (tx) => {
      // Re-checked inside the transaction: between the count above and this
      // statement someone may have been given the role.
      const [stillHeld] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.roleId, roleId))
        .limit(1);
      if (stillHeld) throw new RoleInUseError();

      await tx.delete(rolePermission).where(eq(rolePermission.roleId, roleId));
      await tx.delete(role).where(eq(role.id, roleId));

      await writeAudit(tx, context, [
        {
          action: "role.deleted",
          entityType: "role",
          entityId: roleId,
          valueFrom: { name: existing.name, key: existing.key, grants: existing.grants },
        },
      ]);
    });
  } catch (error) {
    if (error instanceof RoleInUseError) return { status: "roleInUse" };
    console.error("[access] could not delete the role:", error);
    return { status: "error" };
  }

  revalidateAccessModel();
  return { status: "ok", changed: 1 };
}

class RoleInUseError extends Error {}

/* -------------------------------------------------------------------------- */
/*  The matrix                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Saves the checkbox changes, one audit row per cell that actually moved.
 *
 * The whole save is one transaction. A partially applied permission change is
 * worse than a rejected one: it leaves a role holding a set nobody chose.
 */
export async function saveMatrixAction(input: unknown): Promise<ActionResult> {
  const parsed = saveMatrixSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };

  const { locale, changes } = parsed.data;
  const session = await requireCapability(assertLocale(locale), SETTINGS);

  if (changes.length === 0) return { status: "ok", changed: 0 };

  // A capability that is not in the catalog cannot be granted at all — the
  // column would be a switch attached to nothing.
  if (!changes.every((change) => isCapability(change.capability))) return { status: "invalid" };

  const model = await accessModel();

  for (const change of changes) {
    const target = model.byId[change.roleId];
    if (!target) return { status: "roleMissing" };
    // Rule 1: the admin column is locked on the server, so a crafted POST
    // naming it is refused rather than quietly applied.
    if (isAdminRole(target)) return { status: "roleProtected" };
    // Rule 2: granting is bounded by what the actor holds.
    if (change.granted && !grantsInclude(session.user.grants, change.capability)) {
      return { status: "forbidden" };
    }
  }

  const byRole = new Map<string, CellChange[]>();
  for (const change of changes) {
    const list = byRole.get(change.roleId) ?? [];
    list.push({
      capability: change.capability as (typeof CAPABILITIES)[number],
      granted: change.granted,
    });
    byRole.set(change.roleId, list);
  }

  const context = await auditContext(session.user.id);
  let applied = 0;

  try {
    await db().transaction(async (tx) => {
      const entries: AuditEntry[] = [];

      for (const [roleId, cells] of byRole) {
        const target = model.byId[roleId]!;
        const update = applyCellChanges(target.grants, cells);
        if (update.applied.length === 0) continue;

        if (update.removed.length > 0) {
          await tx
            .delete(rolePermission)
            .where(
              and(
                eq(rolePermission.roleId, roleId),
                inArray(rolePermission.permissionKey, update.removed),
              ),
            );
        }

        if (update.added.length > 0) {
          await tx
            .insert(rolePermission)
            .values(update.added.map((grant) => ({ roleId, permissionKey: grant })));
        }

        for (const cell of update.applied) {
          entries.push({
            action: cell.granted ? "permission.granted" : "permission.revoked",
            entityType: "role",
            entityId: roleId,
            field: cell.capability,
            valueFrom: !cell.granted,
            valueTo: cell.granted,
          });
        }

        applied += update.applied.length;
      }

      await writeAudit(tx, context, entries);
    });
  } catch (error) {
    console.error("[access] could not save the matrix:", error);
    return { status: "error" };
  }

  revalidateAccessModel();
  return { status: "ok", changed: applied };
}

/**
 * **استعادة الافتراضي** — rewrites the five seed roles' grants from `ROLES`.
 *
 * Only the five. A role an administrator created has no default to restore
 * to, and silently emptying it would be a destructive reading of a button
 * labelled "restore".
 *
 * One audit row per role rather than per cell: the defaults are a single
 * named state, and thirty rows saying "back to default" would bury the one
 * fact worth recording.
 */
export async function restoreDefaultsAction(input: unknown): Promise<ActionResult> {
  const parsed = restoreSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };

  const session = await requireCapability(assertLocale(parsed.data.locale), SETTINGS);

  // Restoring writes `*` back onto the admin role and the manager's wildcards,
  // so only someone who already holds everything may do it.
  if (!CAPABILITIES.every((capability) => grantsInclude(session.user.grants, capability))) {
    return { status: "forbidden" };
  }

  const model = await accessModel();
  const context = await auditContext(session.user.id);

  try {
    await db().transaction(async (tx) => {
      const idByKey = await seedRoles(tx);
      await restoreDefaultGrants(idByKey, tx);

      await writeAudit(
        tx,
        context,
        Object.entries(idByKey).map(([key, roleId]) => ({
          action: "permission.restored",
          entityType: "role",
          entityId: roleId,
          field: "grants",
          valueFrom: model.byId[roleId]?.grants ?? null,
          valueTo: [...ROLES[key as keyof typeof ROLES].grants],
        })),
      );
    });
  } catch (error) {
    console.error("[access] could not restore the defaults:", error);
    return { status: "error" };
  }

  revalidateAccessModel();
  return { status: "ok", changed: Object.keys(ROLES).length };
}

/* -------------------------------------------------------------------------- */

/**
 * The subset of `grants` that `actorGrants` also covers.
 *
 * A wildcard survives only if the actor holds it too; otherwise it is expanded
 * to the concrete capabilities the actor can actually pass on. Copying a role
 * therefore never hands out more than the person copying it has.
 */
function withheldFiltered(grants: readonly string[], actorGrants: readonly string[]): string[] {
  const kept = new Set<string>();

  for (const grant of grants) {
    if (grantsInclude(actorGrants, grant)) {
      kept.add(grant);
      continue;
    }
    for (const capability of CAPABILITIES) {
      if (grantsInclude([grant], capability) && grantsInclude(actorGrants, capability)) {
        kept.add(capability);
      }
    }
  }

  return [...kept].sort();
}
