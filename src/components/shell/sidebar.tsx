"use client";

import { useTranslations } from "next-intl";
import { ChevronsLeft } from "lucide-react";
import { usePathname, Link } from "@/i18n/navigation";
import { NAV } from "@/config/nav";
import { NavIcon } from "@/components/shell/nav-icon";
import { grantsInclude } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * The navigation list. Shared by the inline desktop sidebar and the
 * off-canvas mobile drawer so there is exactly one nav implementation.
 *
 * Gating takes the grants the server resolved, not a role key, so the nav
 * reflects whatever the permission matrix currently says. It remains a
 * usability affordance and not a boundary — the routes re-check on the
 * server.
 */
function NavList({
  grants,
  collapsed,
  onNavigate,
}: {
  grants: readonly string[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav aria-label={t("nav.mainLabel")} className="flex-1 overflow-y-auto px-2 py-3">
      {NAV.map((group) => {
        const items = group.items.filter((item) => !item.perm || grantsInclude(grants, item.perm));
        // A group whose every item is gated away must not leave an orphan heading.
        if (items.length === 0) return null;

        return (
          <div key={group.id} className="mb-4">
            {!collapsed && (
              <p className="text-text-subtle text-3xs px-3 pb-1 font-semibold tracking-wide uppercase">
                {t(group.messageKey)}
              </p>
            )}
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={t(item.messageKey)}
                  data-nav={item.id}
                  className={cn(
                    "rounded-control mb-0.5 flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                    "hover:bg-surface-sunk",
                    active
                      ? "bg-accent-soft text-accent-text font-semibold"
                      : "text-text-muted font-medium",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <NavIcon name={item.icon} className="shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{t(item.messageKey)}</span>
                      {item.count ? (
                        <span
                          className={cn(
                            "rounded-pill text-3xs px-1.5 py-0.5 font-semibold tabular-nums",
                            item.alert
                              ? "bg-danger-soft text-danger"
                              : "bg-surface-sunk text-text-muted",
                          )}
                        >
                          {item.count}
                        </span>
                      ) : null}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const t = useTranslations();

  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="border-line h-topbar flex shrink-0 items-center gap-3 border-b px-4"
    >
      <span
        aria-hidden="true"
        className="bg-accent text-text-invert rounded-control text-2xs grid size-8 shrink-0 place-items-center font-bold"
      >
        {t("app.mark")}
      </span>
      {!collapsed && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">{t("app.name")}</span>
          <span className="text-text-subtle text-2xs truncate">{t("app.org")}</span>
        </span>
      )}
    </Link>
  );
}

/** Inline sidebar, ≥768px. Collapses to a 68px icon rail from its own foot. */
export function Sidebar({
  grants,
  collapsed,
  onToggleCollapse,
}: {
  grants: readonly string[];
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const t = useTranslations();

  return (
    <aside
      className={cn(
        "border-line bg-surface hidden shrink-0 flex-col border-e md:flex",
        collapsed ? "w-rail" : "w-sidebar",
      )}
      data-collapsed={collapsed}
    >
      <Brand collapsed={collapsed} />
      <NavList grants={grants} collapsed={collapsed} />

      <div className="border-line shrink-0 border-t p-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          title={collapsed ? t("nav.expand") : t("nav.collapse")}
          className={cn(
            "text-text-muted hover:bg-surface-sunk rounded-control flex w-full items-center gap-3 px-3 py-2 text-sm font-medium",
            collapsed && "justify-center px-0",
          )}
        >
          <ChevronsLeft
            size={18}
            aria-hidden="true"
            className={cn(
              "shrink-0 transition-transform rtl:-scale-x-100",
              collapsed && "rotate-180",
            )}
          />
          {!collapsed && <span className="truncate">{t("nav.collapse")}</span>}
        </button>
      </div>
    </aside>
  );
}

/** Off-canvas drawer, <768px. Rendered only while open. */
export function SidebarDrawer({
  grants,
  onClose,
}: {
  grants: readonly string[];
  onClose: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={t("nav.collapse")}
        onClick={onClose}
        className="fixed inset-0 z-60 bg-black/40"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.mainLabel")}
        className="border-line bg-surface w-sidebar shadow-modal fixed inset-y-0 start-0 z-70 flex flex-col border-e"
      >
        <Brand collapsed={false} onNavigate={onClose} />
        <NavList grants={grants} collapsed={false} onNavigate={onClose} />
      </aside>
    </div>
  );
}
