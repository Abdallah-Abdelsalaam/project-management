import { asc } from "drizzle-orm";
import { unstable_cache, updateTag } from "next/cache";
import { db } from "@/db";
import { role, rolePermission } from "@/db/schema";
import {
  expandGrants,
  grantBreadth,
  grantsInclude,
  type Capability,
  type Scope,
} from "@/lib/permissions";

/**
 * The access model — every role and the grants it holds, read from the
 * database rather than from a constant in the source.
 *
 * This is the file that makes `settings/permissions.html` more than a picture.
 * Until session 3 a capability check read `ROLES`, so the matrix could be
 * rendered but not obeyed. Every check now resolves through here, which is
 * also why the acceptance criterion "granting a capability changes what that
 * role sees on the next request" is a property of the system and not of one
 * screen.
 *
 * ## Caching
 *
 * The model is small — five roles and a few dozen grant rows — but it is read
 * on **every** request, so it is cached under one tag and every mutation
 * revalidates that tag in the same action that writes. Two rules keep a cache
 * in an authorization path from becoming a security bug:
 *
 *   1. Only *revocation* is dangerous when stale, so the tag is revalidated by
 *      the writer before it returns, never on a timer.
 *   2. A failed read throws instead of returning an empty model, because
 *      `unstable_cache` stores what the function returns — an empty model
 *      cached after a database blip would lock everyone out until the tag
 *      happened to be revalidated.
 */

export const ACCESS_TAG = "access:model";

export type ResolvedRole = {
  id: string;
  key: string;
  name: string;
  scope: Scope;
  /** The wireframe's per-role wording, when it differs from the canonical. */
  scopeLabel: string | null;
  description: string | null;
  icon: string;
  isSystem: boolean;
  sortOrder: number;
  /** Literal rows from `role_permission`, wildcards included. */
  grants: string[];
};

export type AccessModel = {
  /** Every role, in display order. */
  roles: ResolvedRole[];
  byId: Record<string, ResolvedRole>;
  byKey: Record<string, ResolvedRole>;
};

async function loadAccessModel(): Promise<AccessModel> {
  const client = db();

  const [roles, grants] = await Promise.all([
    client.select().from(role).orderBy(asc(role.sortOrder), asc(role.key)),
    client.select().from(rolePermission),
  ]);

  const byRole = new Map<string, string[]>();
  for (const row of grants) {
    const list = byRole.get(row.roleId);
    if (list) list.push(row.permissionKey);
    else byRole.set(row.roleId, [row.permissionKey]);
  }

  const resolved: ResolvedRole[] = roles.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    scope: row.scope,
    scopeLabel: row.scopeLabel,
    description: row.description,
    icon: row.icon,
    isSystem: row.isSystem,
    sortOrder: row.sortOrder,
    grants: (byRole.get(row.id) ?? []).sort(),
  }));

  return {
    roles: resolved,
    byId: Object.fromEntries(resolved.map((entry) => [entry.id, entry])),
    byKey: Object.fromEntries(resolved.map((entry) => [entry.key, entry])),
  };
}

/** The cached model. Throws if the database cannot be read — see above. */
export const accessModel = unstable_cache(loadAccessModel, ["access-model"], {
  tags: [ACCESS_TAG],
});

/**
 * Drops the cached model so the next read resolves fresh rows.
 *
 * `updateTag` rather than `revalidateTag`: it expires the entry immediately
 * and gives the calling Server Action read-your-own-writes semantics, so the
 * response that saves the matrix already reflects it. `revalidateTag` schedules
 * a refresh, which would let the very request that granted a capability render
 * the old answer.
 *
 * Called by every writer, after the transaction commits.
 */
export function revalidateAccessModel(): void {
  updateTag(ACCESS_TAG);
}

/* -------------------------------------------------------------------------- */
/*  Reading the model                                                         */
/* -------------------------------------------------------------------------- */

/** Whether a resolved role holds a capability, wildcards included. */
export function roleHas(resolved: ResolvedRole | undefined, capability: Capability): boolean {
  return resolved ? grantsInclude(resolved.grants, capability) : false;
}

/** Every catalog capability a resolved role holds. */
export function roleCapabilities(resolved: ResolvedRole): Capability[] {
  return expandGrants(resolved.grants);
}

/**
 * How the roles list should describe a role's grant count — a number, "صلاحيات
 * موسّعة", or "كل الصلاحيات". The wording lives in `messages/*.json`; this
 * decides which of the three applies.
 */
export function roleBreadth(resolved: ResolvedRole): {
  kind: "all" | "wildcard" | "counted";
  count: number;
} {
  return {
    kind: grantBreadth(resolved.grants),
    count: expandGrants(resolved.grants).length,
  };
}

/**
 * The admin role, identified by its scope and its `*` grant rather than by its
 * key, so renaming it cannot quietly unlock the locked column.
 */
export function isAdminRole(resolved: ResolvedRole): boolean {
  return resolved.grants.includes("*");
}
