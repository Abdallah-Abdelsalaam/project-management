"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Sidebar, SidebarDrawer } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { can, type RoleKey } from "@/lib/permissions";
import type { SignedInUser } from "@/features/auth/session";

/**
 * The application shell: sidebar + topbar + the fixed task-creation dock.
 *
 * Two navigation modes, as the quality floor requires: an inline sidebar that
 * collapses to an icon rail at ≥768px, and an off-canvas drawer below it.
 * One button drives both — which one depends on the viewport.
 *
 * The role and the user are resolved on the server by the `(app)` layout and
 * passed down; nothing here decides who the user is.
 */
export function AppShell({
  role,
  user,
  children,
}: {
  role: RoleKey;
  user: SignedInUser;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Escape closes the drawer, and a resize past the breakpoint dismisses it so
  // it can never be left open behind the inline sidebar.
  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    const wide = window.matchMedia("(min-width: 768px)");

    document.addEventListener("keydown", onKeyDown);
    wide.addEventListener("change", closeDrawer);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      wide.removeEventListener("change", closeDrawer);
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        role={role}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
      />
      {drawerOpen && <SidebarDrawer role={role} onClose={closeDrawer} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar role={role} user={user} onOpenNav={() => setDrawerOpen(true)} />

        <main id="main" className="max-w-content mx-auto w-full flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>

      {can(role, "tasks.create") && (
        <div className="fixed start-5 bottom-5 z-40 flex flex-col gap-2">
          <Link
            href="/tasks/new/programming"
            className="bg-dept-prog rounded-pill shadow-overlay px-4 py-2.5 text-xs font-semibold text-white"
          >
            <span aria-hidden="true" className="me-1">
              +
            </span>
            {t("fab.programming")}
          </Link>
          <Link
            href="/tasks/new/uiux"
            className="bg-dept-uiux rounded-pill shadow-overlay px-4 py-2.5 text-xs font-semibold text-white"
          >
            <span aria-hidden="true" className="me-1">
              +
            </span>
            {t("fab.uiux")}
          </Link>
        </div>
      )}
    </div>
  );
}
