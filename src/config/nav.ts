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
  | "swatch";

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
