import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Page header and breadcrumb — `.page-head` and `.crumbs` from
 * `wireframe/assets/css/04-layout.css` and `components/nav.css`.
 *
 * The wireframe's own note explains the one structural rule: there is no
 * eyebrow label above the heading, because the breadcrumb already says where
 * you are. Title and actions share a baseline (`items-end`), so a two-line
 * subtitle does not drag the buttons down with it.
 */

export type Crumb = {
  label: string;
  /** Locale-relative path. The current page has none and is not a link. */
  href?: string;
};

export function Crumbs({ items, label }: { items: readonly Crumb[]; label: string }) {
  return (
    <nav aria-label={label} className="text-text-subtle text-2xs flex flex-wrap items-center gap-2">
      {items.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
          {index > 0 && (
            <span aria-hidden="true" className="text-line-strong">
              /
            </span>
          )}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="text-text-muted hover:text-accent-text hover:underline hover:underline-offset-2"
            >
              {crumb.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-text font-medium">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHead({
  crumbs,
  crumbsLabel,
  title,
  sub,
  actions,
}: {
  crumbs?: readonly Crumb[];
  crumbsLabel: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {crumbs ? <Crumbs items={crumbs} label={crumbsLabel} /> : null}
        <h1 className="text-xl leading-tight font-semibold tracking-tight">{title}</h1>
        {sub ? <p className="text-text-muted max-w-[72ch] text-xs">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** The quiet count beside a panel title — `.section__note`. */
export function SectionNote({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("text-text-subtle text-2xs", className)} {...props} />;
}
