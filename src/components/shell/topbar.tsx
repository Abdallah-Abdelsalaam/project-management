"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bell, LogOut, Menu, Moon, Rows3, Search, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ROLES, type RoleKey } from "@/lib/permissions";
import type { SignedInUser } from "@/features/auth/session";
import { signOutAction } from "@/features/auth/actions";

/**
 * Reads an attribute off <html> reactively. The theme and density toggles
 * write there (that is where the token overrides live), so the DOM is the
 * source of truth and React just subscribes to it — no effect, no cascading
 * render, and no disagreement with the inline boot script.
 */
function useHtmlAttribute(name: string, serverValue = "") {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: [name] });
      return () => observer.disconnect();
    },
    () => document.documentElement.getAttribute(name) ?? "",
    () => serverValue,
  );
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the toggle still works for this page.
  }
}

/**
 * Topbar.
 *
 * The wireframe's prototype-only role switcher is deliberately not ported —
 * see docs/DECISIONS.md ADR-004.
 */
export function Topbar({
  role,
  user,
  onOpenNav,
  unreadCount = 3,
}: {
  role: RoleKey;
  user: SignedInUser;
  onOpenNav: () => void;
  unreadCount?: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const density = useHtmlAttribute("data-density", "comfortable");
  const compact = density === "compact";

  function toggleTheme() {
    const root = document.documentElement;
    const current =
      root.getAttribute("data-theme") ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    persist("pm.theme", next);
  }

  function toggleDensity() {
    const next = compact ? "comfortable" : "compact";
    document.documentElement.setAttribute("data-density", next);
    persist("pm.density", next);
  }

  return (
    <header className="border-line bg-surface h-topbar sticky top-0 z-30 flex items-center gap-3 border-b px-4">
      {/* Mobile only: the inline sidebar collapses from its own foot. */}
      <button
        type="button"
        onClick={onOpenNav}
        aria-label={t("nav.openMenu")}
        className="hover:bg-surface-sunk rounded-control grid size-9 place-items-center md:hidden"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="border-line bg-surface-sunk text-text-subtle hover:border-line-strong rounded-control flex h-9 w-full max-w-md items-center gap-2 border px-3 text-start text-xs"
        >
          <Search size={15} aria-hidden="true" />
          <span className="flex-1 truncate">{t("topbar.searchPlaceholder")}</span>
          {/* A keyboard hint is meaningless on a touch device, and at 390px it
              squeezes the label down to a single letter. Hidden below sm. */}
          <kbd
            dir="ltr"
            className="border-line bg-surface rounded-data text-3xs hidden border px-1.5 py-0.5 sm:block"
          >
            {t("topbar.searchHint")}
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("topbar.notificationsUnread", { count: unreadCount })}
          className="hover:bg-surface-sunk rounded-control relative grid size-9 place-items-center"
        >
          <Bell size={18} aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="bg-accent rounded-pill absolute end-2 top-2 size-1.5"
            />
          )}
        </button>

        <button
          type="button"
          onClick={toggleDensity}
          aria-label={t("topbar.toggleDensity")}
          title={t("topbar.density")}
          aria-pressed={compact}
          className="hover:bg-surface-sunk rounded-control grid size-9 place-items-center"
        >
          <Rows3 size={18} aria-hidden="true" />
        </button>

        {/* Which icon shows is a CSS concern, so it is correct on first paint
            whether the theme came from storage or the system preference. */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t("topbar.toggleTheme")}
          title={t("topbar.theme")}
          className="hover:bg-surface-sunk rounded-control grid size-9 place-items-center"
        >
          <Moon size={18} aria-hidden="true" className="dark:hidden" />
          <Sun size={18} aria-hidden="true" className="hidden dark:block" />
        </button>

        <span aria-hidden="true" className="bg-line mx-1 h-5 w-px" />

        {/* The signed-in user, resolved by the (app) layout. The role label
            comes from ROLES rather than from the session, so one rename changes
            it everywhere. */}
        <div className="rounded-control flex items-center gap-2 px-2 py-1">
          <span
            aria-hidden="true"
            className="bg-dept-seo rounded-pill text-3xs grid size-8 shrink-0 place-items-center font-semibold text-white"
          >
            {user.initials}
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-xs font-semibold">{user.name}</span>
            <span className="text-text-subtle text-3xs">{ROLES[role].label}</span>
          </span>
        </div>

        {/* Sign out is a form, not a link: it changes server state, and a
            prefetching browser must never be able to end someone's session by
            looking at it. */}
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            aria-label={t("topbar.signOut")}
            title={t("topbar.signOut")}
            className="hover:bg-surface-sunk rounded-control grid size-9 place-items-center"
          >
            <LogOut size={18} aria-hidden="true" className="rtl:-scale-x-100" />
          </button>
        </form>
      </div>
    </header>
  );
}
