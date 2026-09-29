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
  /** Arabic description of the access scope, in the wireframe's own words. */
  scope: string;
  /** Which rows the role may see. Not a capability — see `access.ts`. */
  reach: Scope;
  /** The sentence after the permission count on the roles list. */
  description: string;
  /** Glyph key for the roles list, matching the wireframe's per-role SVG. */
  icon: RoleIcon;
  grants: readonly Grant[];
};

/** Reach, mirroring `SCOPES` in `src/db/schema/access.ts`. */
export type Scope = "own" | "team" | "dept" | "all";

export type RoleIcon = "user" | "medal" | "crown" | "bank" | "shieldCheck" | "badge";

/**
 * Seed roles. From session 3 these live in the database (they are
 * runtime-creatable in the wireframe) and this map becomes the seed fixture.
 */
export const ROLES: Record<RoleKey, RoleDefinition> = {
  agent: {
    key: "agent",
    label: "موظف",
    scope: "مهامه فقط",
    reach: "own",
    description: "يستطيع إنشاء المهام وتقديمها، وتغيير حالتها إن سمح قائد الفريق",
    icon: "user",
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
    reach: "team",
    description: "يُسند المهام ويراجعها ويضبط صلاحية تغيير الحالة لكل موظف",
    icon: "medal",
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
    reach: "dept",
    description: "يوزّع الموظفين على قادة الفرق وينقلهم ويرى إحصاءات القسم",
    icon: "crown",
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
    reach: "all",
    description: "يعيّن رؤساء الأقسام ويزيلهم ويرى التقارير والسجل",
    icon: "bank",
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
    reach: "all",
    description: "لا يمكن تقييد هذا الدور، لكن كل إجراءاته تُسجَّل في سجل التدقيق",
    icon: "shieldCheck",
    grants: ["*"],
  },
};

/* -------------------------------------------------------------------------- */
/*  The capability catalog                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The four bands of the matrix, in the wireframe's order. The group keys are
 * stable identifiers; their headings come from `messages/*.json`.
 */
export const CAPABILITY_GROUPS = ["tasks", "team", "management", "system"] as const;
export type CapabilityGroup = (typeof CAPABILITY_GROUPS)[number];

export type CapabilityMeta = {
  group: CapabilityGroup;
  labelAr: string;
  labelEn: string;
};

/**
 * One entry per capability, carrying its band and its name in both locales.
 *
 * The Arabic labels of the 22 capabilities the permissions wireframe lists are
 * transcribed from it verbatim. The other eight — `tasks.comment`,
 * `tasks.reassign`, `tasks.submit`, `team.view`, `dept.view` and the three
 * `profile.view.*` — are not on that screen, but the server checks them, and a
 * capability the code enforces while the admin cannot see it is exactly the
 * kind of invisible rule this screen exists to abolish. They are shown, with
 * labels written in the wireframe's register. See OPEN_QUESTIONS Q19.
 */
export const CAPABILITY_META: Record<Capability, CapabilityMeta> = {
  "tasks.view.own": { group: "tasks", labelAr: "عرض مهامه", labelEn: "View own tasks" },
  "tasks.view.team": { group: "tasks", labelAr: "عرض مهام الفريق", labelEn: "View team tasks" },
  "tasks.view.dept": {
    group: "tasks",
    labelAr: "عرض مهام القسم",
    labelEn: "View department tasks",
  },
  "tasks.create": { group: "tasks", labelAr: "إنشاء مهمة", labelEn: "Create a task" },
  "tasks.comment": { group: "tasks", labelAr: "التعليق على المهام", labelEn: "Comment on tasks" },
  "tasks.assign": { group: "tasks", labelAr: "إسناد المهام", labelEn: "Assign tasks" },
  "tasks.reassign": { group: "tasks", labelAr: "إعادة إسناد المهام", labelEn: "Reassign tasks" },
  "tasks.status.own": {
    group: "tasks",
    labelAr: "تغيير حالة مهامه",
    labelEn: "Change own task status",
  },
  "tasks.status.any": {
    group: "tasks",
    labelAr: "تغيير حالة أي مهمة",
    labelEn: "Change any task status",
  },
  "tasks.submit": { group: "tasks", labelAr: "تقديم العمل للمراجعة", labelEn: "Submit work" },
  "tasks.review": { group: "tasks", labelAr: "مراجعة التسليمات", labelEn: "Review deliverables" },
  "tasks.approve": { group: "tasks", labelAr: "اعتماد المهام", labelEn: "Approve tasks" },
  "tasks.reject": {
    group: "tasks",
    labelAr: "رفض وطلب تعديل",
    labelEn: "Reject and request changes",
  },
  "tasks.bulk": { group: "tasks", labelAr: "إجراءات جماعية", labelEn: "Bulk actions" },
  "team.view": { group: "team", labelAr: "عرض الفرق", labelEn: "View teams" },
  "team.settings": {
    group: "team",
    labelAr: "ضبط صلاحيات الفريق",
    labelEn: "Configure team permissions",
  },
  "team.assign": {
    group: "team",
    labelAr: "إسناد موظفين للفرق",
    labelEn: "Assign employees to teams",
  },
  "employee.move": {
    group: "team",
    labelAr: "نقل الموظفين بين الفرق",
    labelEn: "Move employees between teams",
  },
  "employee.perf.view": {
    group: "team",
    labelAr: "عرض أداء الموظفين",
    labelEn: "View employee performance",
  },
  "profile.view.own": { group: "team", labelAr: "عرض ملفه الشخصي", labelEn: "View own profile" },
  "profile.view.team": {
    group: "team",
    labelAr: "عرض ملفات الفريق",
    labelEn: "View team profiles",
  },
  "profile.view.dept": {
    group: "team",
    labelAr: "عرض ملفات القسم",
    labelEn: "View department profiles",
  },
  "leads.manage": {
    group: "management",
    labelAr: "إدارة قادة الفرق",
    labelEn: "Manage team leaders",
  },
  "heads.manage": {
    group: "management",
    labelAr: "إدارة رؤساء الأقسام",
    labelEn: "Manage department heads",
  },
  "dept.view": { group: "management", labelAr: "عرض الأقسام", labelEn: "View departments" },
  "dept.manage": { group: "management", labelAr: "إدارة الأقسام", labelEn: "Manage departments" },
  "org.view": {
    group: "management",
    labelAr: "عرض الهيكل التنظيمي",
    labelEn: "View the org chart",
  },
  "reports.view": { group: "system", labelAr: "عرض التقارير", labelEn: "View reports" },
  "audit.view": { group: "system", labelAr: "عرض سجل التدقيق", labelEn: "View the audit log" },
  "settings.view": { group: "system", labelAr: "الوصول إلى الإعدادات", labelEn: "Access settings" },
};

export function isCapability(value: unknown): value is Capability {
  return typeof value === "string" && (CAPABILITIES as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/*  Resolution                                                                */
/* -------------------------------------------------------------------------- */

/**
 * True when `grants` covers `capability`, exactly or through a wildcard.
 *
 * Takes `readonly string[]` rather than `readonly Grant[]` because at runtime
 * the grants come out of `role_permission` as plain strings. Narrowing them
 * first would mean either trusting the database's contents to be well typed or
 * throwing on a row that is merely stale — neither of which is better than
 * simply not matching.
 */
export function grantsInclude(grants: readonly string[], capability: string): boolean {
  return grants.some((grant) => {
    if (grant === "*" || grant === capability) return true;
    if (grant.endsWith(".*")) return capability.startsWith(grant.slice(0, -1));
    return false;
  });
}

/** Every capability in the catalog that `grants` covers. */
export function expandGrants(grants: readonly string[]): Capability[] {
  return CAPABILITIES.filter((capability) => grantsInclude(grants, capability));
}

/**
 * How the roles list describes the size of a grant set.
 *
 * The wireframe writes a number for the three explicit roles, "صلاحيات موسّعة"
 * for the manager and "كل الصلاحيات" for the admin — which is not decoration:
 * a wildcard is open-ended, so printing a count for it would state a number
 * that stops being true the day a capability is added.
 */
export function grantBreadth(grants: readonly string[]): "all" | "wildcard" | "counted" {
  if (grants.includes("*")) return "all";
  if (grants.some((grant) => grant.endsWith(".*"))) return "wildcard";
  return "counted";
}

/**
 * The seed answer to "may this role do this?", read from `ROLES`.
 *
 * From session 3 the **authority** is `role_permission`, resolved by
 * `src/features/access/model.ts`. This function survives because the seed is
 * still what the database is seeded from and what "استعادة الافتراضي"
 * restores to, so it needs to stay testable on its own.
 */
export function can(role: RoleKey, capability: Capability): boolean {
  return grantsInclude(ROLES[role].grants, capability);
}

export function canAny(role: RoleKey, capabilities: readonly Capability[]): boolean {
  return capabilities.some((capability) => can(role, capability));
}

export function canAll(role: RoleKey, capabilities: readonly Capability[]): boolean {
  return capabilities.every((capability) => can(role, capability));
}
