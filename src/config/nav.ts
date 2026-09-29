import type { Capability } from "@/lib/permissions";

/**
 * One source of truth for the sidebar, the command palette and nav-level
 * permission gating — ported from the wireframe's NAV in assets/js/shell.js.
 *
 * Adding a module to the application is one entry here. `messageKey` points
 * at messages/{ar,en}.json so no label is hard-coded in the UI.
 */

export type NavItem = {
  id: string;
  messageKey: string;
  /** Path WITHOUT the locale prefix; next-intl's Link adds it. */
  href: string;
  icon: NavIcon;
  perm?: Capability;
  /** Badge count. Static in the shell; wired to real counts in later sessions. */
  count?: number;
  /** Renders the badge in the alert tone. */
  alert?: boolean;
};

export type NavGroup = {
  id: string;
  messageKey: string;
  items: NavItem[];
};

export type NavIcon =
  | "grid"
  | "inbox"
  | "list"
  | "checkCircle"
  | "revert"
  | "users"
  | "team"
  | "building"
  | "org"
  | "crown"
  | "badge"
  | "chart"
  | "history"
  | "cog"
  | "swatch"
  | "shield"
  | "clock"
  | "flag"
  | "bell";

export const NAV: NavGroup[] = [
  {
    id: "overview",
    messageKey: "nav.groups.overview",
    items: [
      { id: "dashboard", messageKey: "nav.dashboard", href: "/dashboard", icon: "grid" },
      { id: "my-work", messageKey: "nav.myWork", href: "/my-work", icon: "inbox", count: 7 },
    ],
  },
  {
    id: "tasks",
    messageKey: "nav.groups.tasks",
    items: [
      { id: "tasks", messageKey: "nav.allTasks", href: "/tasks", icon: "list" },
      {
        id: "review",
        messageKey: "nav.review",
        href: "/review",
        icon: "checkCircle",
        count: 12,
        perm: "tasks.review",
      },
      {
        id: "rejected",
        messageKey: "nav.rejected",
        href: "/rejected",
        icon: "revert",
        count: 4,
        alert: true,
      },
    ],
  },
  {
    id: "people",
    messageKey: "nav.groups.people",
    items: [
      { id: "employees", messageKey: "nav.employees", href: "/employees", icon: "users" },
      { id: "teams", messageKey: "nav.teams", href: "/teams", icon: "team" },
      { id: "departments", messageKey: "nav.departments", href: "/departments", icon: "building" },
    ],
  },
  {
    id: "org",
    messageKey: "nav.groups.org",
    items: [
      {
        id: "structure",
        messageKey: "nav.structure",
        href: "/org/structure",
        icon: "org",
        perm: "org.view",
      },
      {
        id: "heads",
        messageKey: "nav.heads",
        href: "/org/heads",
        icon: "crown",
        perm: "heads.manage",
      },
      {
        id: "leaders",
        messageKey: "nav.leaders",
        href: "/org/team-leaders",
        icon: "badge",
        perm: "leads.manage",
      },
    ],
  },
  {
    id: "insights",
    messageKey: "nav.groups.insights",
    items: [
      {
        id: "reports",
        messageKey: "nav.reports",
        href: "/reports",
        icon: "chart",
        perm: "reports.view",
      },
      {
        id: "activity",
        messageKey: "nav.activity",
        href: "/activity",
        icon: "history",
        perm: "audit.view",
      },
    ],
  },
  {
    id: "system",
    messageKey: "nav.groups.system",
    items: [
      {
        id: "settings",
        messageKey: "nav.settings",
        href: "/settings/roles",
        icon: "cog",
        perm: "settings.view",
      },
    ],
  },
];

/** Every nav item, flattened — used by the command palette. */
export const NAV_ITEMS: NavItem[] = NAV.flatMap((group) => group.items);

/* -------------------------------------------------------------------------- */
/*  Settings sub-navigation                                                   */
/* -------------------------------------------------------------------------- */

export type SettingsNavGroup = {
  id: string;
  messageKey: string;
  items: Array<{ id: string; messageKey: string; href: string; icon: NavIcon }>;
};

/**
 * The list every settings screen renders down its start edge — ported from
 * `SETTINGS_NAV` in the wireframe's `assets/js/shell.js`, which exists there
 * for the same reason it exists here: "so the eight settings screens share one
 * list instead of eight copies that drift".
 *
 * Every entry is behind `settings.view`, which the routes check on the server;
 * there are no per-item capabilities, because the wireframe draws none.
 */
export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    id: "people",
    messageKey: "settings.nav.people",
    items: [
      { id: "roles", messageKey: "settings.nav.roles", href: "/settings/roles", icon: "badge" },
      {
        id: "permissions",
        messageKey: "settings.nav.permissions",
        href: "/settings/permissions",
        icon: "shield",
      },
    ],
  },
  {
    id: "security",
    messageKey: "settings.nav.security",
    items: [
      {
        id: "security",
        messageKey: "settings.nav.securitySessions",
        href: "/settings/security",
        icon: "shield",
      },
      {
        id: "two-factor",
        messageKey: "settings.nav.twoFactor",
        href: "/settings/two-factor",
        icon: "clock",
      },
      {
        id: "devices",
        messageKey: "settings.nav.devices",
        href: "/settings/trusted-devices",
        icon: "grid",
      },
    ],
  },
  {
    id: "work",
    messageKey: "settings.nav.work",
    items: [
      { id: "tasks", messageKey: "settings.nav.tasks", href: "/settings/tasks", icon: "list" },
      {
        id: "statuses",
        messageKey: "settings.nav.statuses",
        href: "/settings/statuses",
        icon: "flag",
      },
      {
        id: "departments",
        messageKey: "settings.nav.departments",
        href: "/settings/departments",
        icon: "building",
      },
      {
        id: "notifications",
        messageKey: "settings.nav.notifications",
        href: "/settings/notifications",
        icon: "bell",
      },
    ],
  },
];
