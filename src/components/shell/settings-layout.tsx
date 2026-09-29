import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SETTINGS_NAV } from "@/config/nav";
import { NavIcon } from "@/components/shell/nav-icon";
import { cn } from "@/lib/utils";

/**
 * The settings shell — a sticky sub-navigation beside the content,
 * `.settings` and `.subnav` from `wireframe/assets/css/components/pages.css`.
 *
 * Below 900px the grid collapses to one column and the sub-nav becomes a
 * horizontally scrolling strip with its group labels hidden and its current
 * marker moved from the inline-start edge to the block-end edge — all three
 * changes are the wireframe's, not inventions, and they are why the screen
 * works at 390px without a separate mobile design.
 *
 * Split into a nav and a grid because the permissions screen's save buttons
 * live in the *page header*, above this layout, and share state with the
 * matrix inside it. The client component that owns that state therefore wraps
 * both, and takes the server-rendered `<SettingsSubnav>` as a prop — which
 * keeps the sub-nav free of client JavaScript either way.
 */

/** The sub-navigation. A Server Component: the active item is a prop. */
export async function SettingsSubnav({ active }: { active: string }) {
  const t = await getTranslations();

  return (
    <nav
      aria-label={t("settings.nav.label")}
      className={cn(
        "flex gap-1",
        "max-[899px]:border-line max-[899px]:flex-row max-[899px]:overflow-x-auto max-[899px]:border-b max-[899px]:pb-2",
        "max-[899px]:[scrollbar-width:none] max-[899px]:[&::-webkit-scrollbar]:hidden",
        "min-[900px]:sticky min-[900px]:top-4 min-[900px]:flex-col",
      )}
    >
      {SETTINGS_NAV.map((group, index) => (
        <div key={group.id} className="contents">
          {index > 0 && (
            <span aria-hidden="true" className="bg-line-soft mx-3 my-2 h-px max-[899px]:hidden" />
          )}
          <p className="text-text-subtle text-3xs px-3 pb-1 font-medium max-[899px]:hidden">
            {t(group.messageKey)}
          </p>
          {group.items.map((item) => {
            const current = item.id === active;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={current ? "page" : undefined}
                data-settings-nav={item.id}
                className={cn(
                  "rounded-control duration-fast relative flex min-h-[34px] flex-none items-center gap-3 px-3 text-xs font-medium transition-colors",
                  "max-[899px]:whitespace-nowrap",
                  current
                    ? "bg-accent-soft text-accent-text font-semibold"
                    : "text-text-muted hover:bg-surface-sunk hover:text-text",
                  // The current marker: a 3px bar on the inline-start edge on
                  // desktop, a 2px underline once the list turns horizontal.
                  current && [
                    "before:bg-accent before:rounded-pill before:absolute before:content-['']",
                    "min-[900px]:before:inset-y-1.5 min-[900px]:before:start-0 min-[900px]:before:w-[3px]",
                    "max-[899px]:before:inset-x-0 max-[899px]:before:bottom-0 max-[899px]:before:h-0.5",
                  ],
                )}
              >
                <NavIcon name={item.icon} className="shrink-0" />
                <span>{t(item.messageKey)}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * The two-column grid. No server-only APIs, so a client component can render
 * it around a server-rendered `nav`.
 */
export function SettingsGrid({
  nav,
  children,
}: {
  nav: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-start gap-6 min-[900px]:grid-cols-[232px_minmax(0,1fr)]">
      {nav}
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </div>
  );
}

/** The common case: a server page that needs no shared state with the head. */
export async function SettingsLayout({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  return <SettingsGrid nav={await SettingsSubnav({ active })}>{children}</SettingsGrid>;
}
