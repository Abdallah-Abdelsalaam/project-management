import { cn } from "@/lib/utils";

/**
 * The generic list row — `.lrow` from
 * `wireframe/assets/css/components/pages.css`.
 *
 * The wireframe's own comment names its remit: "devices, sessions, team
 * members, statuses, notification channels — any list of named things with
 * meta and an action". The roles list is the first of those to be built, so
 * this lands as a shared primitive rather than inside the roles feature.
 *
 * `flex-wrap` plus a `240px` flex-basis on the body is what makes it work at
 * 390px without a separate mobile layout: the actions wrap beneath the text
 * instead of squeezing it.
 */

export function ListRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-line-soft hover:bg-surface-alt flex flex-wrap items-center gap-4 border-b px-5 py-4 last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function ListRowGlyph({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-surface-sunk text-text-muted rounded-control grid size-[34px] flex-none place-content-center",
        className,
      )}
      {...props}
    />
  );
}

export function ListRowBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex min-w-0 flex-[1_1_240px] flex-col gap-0.5", className)} {...props} />
  );
}

export function ListRowTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("flex flex-wrap items-center gap-2 text-sm font-medium", className)}
      {...props}
    />
  );
}

export function ListRowMeta({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-text-muted text-2xs leading-snug", className)} {...props} />;
}

export function ListRowActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-none items-center gap-2", className)} {...props} />;
}
