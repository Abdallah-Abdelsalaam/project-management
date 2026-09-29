/**
 * Capability engine — ported from the wireframe's assets/js/role.js.
 *
 * The permission model is capability strings, never role checks. Code asks
 * `can(session, "tasks.assign")`, never `if (role === "manager")`. Adding a
 * role is adding a row to the role/permission tables (session 3), not a
 * restructure.
 *
 * Wildcards match at any depth: "tasks.*" grants every capability under
 * tasks, "*" grants everything.
 *
 * This module is the single source of truth for BOTH the server check and the
 * UI gating. Hiding a control in the DOM is a usability affordance, never a
 * security boundary — every gated Server Action re-checks with `can()`.
 */

export const CAPABILITIES = [
  // tasks
  "tasks.view.own",
  "tasks.view.team",
  "tasks.view.dept",
  "tasks.create",
  "tasks.comment",
  "tasks.assign",
  "tasks.reassign",
  "tasks.status.own",
  "tasks.status.any",
  "tasks.submit",
  "tasks.review",
  "tasks.approve",
  "tasks.reject",
  "tasks.bulk",
  // teams and people
  "team.view",
  "team.settings",
  "team.assign",
  "employee.move",
  "employee.perf.view",
  "profile.view.own",
  "profile.view.team",
  "profile.view.dept",
  // management
  "leads.manage",
  "heads.manage",
  "dept.view",
  "dept.manage",
  "org.view",
  // reports and system
  "reports.view",
  "audit.view",
  "settings.view",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** A granted entry may be an exact capability or a wildcard such as "tasks.*". */
export type Grant = Capability | `${string}.*` | "*";

/**
 * The five seed roles, in ascending order of reach. Declared as a tuple
 * because the `user.role` column enumerates it — the database and the
 * capability engine cannot drift apart.
 */
export const ROLE_KEYS = ["agent", "lead", "head", "manager", "admin"] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export type RoleDefinition = {
  key: RoleKey;
  /** Arabic label shown in the user chip. */
  label: string;
  /** Arabic description of the access scope. */
  scope: string;
  grants: readonly Grant[];
};

/**
 * Seed roles. From session 3 these live in the database (they are
 * runtime-creatable in the wireframe) and this map becomes the seed fixture.
 */
export const ROLES: Record<RoleKey, RoleDefinition> = {
  agent: {
    key: "agent",
    label: "موظف",
    scope: "مهامه فقط",
    grants: [
      "tasks.view.own",
      "tasks.create",
      "tasks.comment",
      "tasks.status.own",
      "tasks.submit",
      "profile.view.own",
    ],
  },
  lead: {
    key: "lead",
    label: "قائد الفريق",
    scope: "فريقه",
    grants: [
      "tasks.view.team",
      "tasks.create",
      "tasks.comment",
      "tasks.assign",
      "tasks.reassign",
      "tasks.review",
      "tasks.approve",
      "tasks.reject",
      "tasks.status.any",
      "tasks.bulk",
      "team.view",
      "team.settings",
      "employee.perf.view",
      "profile.view.own",
      "profile.view.team",
      "reports.view",
    ],
  },
  head: {
    key: "head",
    label: "رئيس القسم",
    scope: "قسمه بالكامل",
    grants: [
      "tasks.view.dept",
      "tasks.create",
      "tasks.comment",
      "tasks.assign",
      "tasks.reassign",
      "tasks.review",
      "tasks.approve",
      "tasks.reject",
      "tasks.status.any",
      "tasks.bulk",
      "team.view",
      "team.settings",
      "team.assign",
      "employee.move",
      "employee.perf.view",
      "leads.manage",
      "dept.view",
      "profile.view.own",
      "profile.view.dept",
      "reports.view",
      "org.view",
    ],
  },
  manager: {
    key: "manager",
    label: "مدير",
    scope: "كل الأقسام",
    grants: [
      "tasks.*",
      "team.*",
      "employee.*",
      "leads.manage",
      "heads.manage",
      "dept.*",
      "org.view",
      "profile.*",
      "reports.*",
      "audit.view",
      "settings.view",
    ],
  },
  admin: {
    key: "admin",
    label: "مسؤول النظام",
    scope: "النظام بالكامل",
    grants: ["*"],
  },
};

/** True when `grants` covers `capability`, exactly or through a wildcard. */
export function grantsInclude(grants: readonly Grant[], capability: Capability): boolean {
  return grants.some((grant) => {
    if (grant === "*" || grant === capability) return true;
    if (grant.endsWith(".*")) return capability.startsWith(grant.slice(0, -1));
    return false;
  });
}

export function can(role: RoleKey, capability: Capability): boolean {
  return grantsInclude(ROLES[role].grants, capability);
}

export function canAny(role: RoleKey, capabilities: readonly Capability[]): boolean {
  return capabilities.some((capability) => can(role, capability));
}

export function canAll(role: RoleKey, capabilities: readonly Capability[]): boolean {
  return capabilities.every((capability) => can(role, capability));
}
