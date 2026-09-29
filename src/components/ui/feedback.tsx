import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Alert, Note, Panel, KeyValue, Checklist, Steps — ported from
 * `wireframe/assets/css/components/feedback.css` and `pages.css`.
 *
 * The alert's tone is carried by a 3px inline-start border plus a tinted
 * background, never by a shadow: borders, not shadows, is the first rule the
 * token set encodes.
 */

const TONES = {
  info: "border-info/30 bg-info-soft border-s-info",
  success: "border-success/30 bg-success-soft border-s-success",
  warning: "border-warning/30 bg-warning-soft border-s-warning",
  danger: "border-danger/30 bg-danger-soft border-s-danger",
} as const;

export type AlertTone = keyof typeof TONES;

/**
 * `live` makes the alert an assertive live region. Used for a state the user
 * caused and is waiting on — a rejected sign-in — and not for copy that was
 * there when the page loaded.
 */
export function Alert({
  tone = "info",
  title,
  children,
  live = false,
  className,
}: {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <div
      role={live ? "alert" : undefined}
      className={cn(
        "rounded-data flex items-start gap-3 border border-s-[3px] px-4 py-3 text-xs leading-normal",
        TONES[tone],
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        {title ? <strong className="block font-semibold">{title}</strong> : null}
        {children ? <span className="text-text-muted">{children}</span> : null}
      </span>
    </div>
  );
}

/** The quieter sibling of an alert — a dashed aside, not a state. */
export function Note({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-line-strong bg-surface-alt text-text-muted rounded-data text-2xs border border-dashed px-4 py-3 leading-normal",
        "[&_strong]:text-text",
        className,
      )}
      {...props}
    />
  );
}

export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("bg-surface border-line rounded-panel overflow-hidden border", className)}
      {...props}
    />
  );
}

export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

/**
 * The key/value list used by every explainer panel. A description list rather
 * than a stack of divs, because that is what it is.
 */
export function KeyValue({
  rows,
}: {
  rows: ReadonlyArray<{ key: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="flex flex-col">
      {rows.map((row) => (
        <div
          key={row.key}
          className="border-line-soft flex items-center justify-between gap-3 border-b py-3 text-xs last:border-b-0"
        >
          <dt className="text-text-muted shrink-0">{row.key}</dt>
          <dd className="min-w-0 text-end font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The password requirement list.
 *
 * `state` has three values, not two. A requirement the client cannot evaluate —
 * "does this match one of your last five passwords?" — is `pending`, and says
 * so, rather than claiming a pass it has not checked.
 */
export type ChecklistState = "pass" | "fail" | "pending";

export function Checklist({
  items,
  className,
  ...props
}: React.ComponentProps<"ul"> & {
  items: ReadonlyArray<{ id: string; label: React.ReactNode; state: ChecklistState }>;
}) {
  return (
    <ul className={cn("flex flex-col gap-1", className)} {...props}>
      {items.map((item) => (
        <li
          key={item.id}
          data-pass={item.state === "pass" ? "true" : item.state === "fail" ? "false" : undefined}
          className="hover:bg-surface-alt rounded-data flex items-start gap-3 px-3 py-2 text-xs"
        >
          <span
            aria-hidden="true"
            className={cn(
              "rounded-data mt-px grid size-[18px] shrink-0 place-content-center border",
              item.state === "pass" && "bg-success border-success text-white",
              item.state === "fail" && "bg-danger-soft border-danger text-danger",
              item.state === "pending" && "border-line-strong text-transparent",
            )}
          >
            {item.state === "fail" ? <X size={12} /> : <Check size={12} />}
          </span>
          <span className="min-w-0 flex-1">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** The numbered "what happens next" list on the forgot-password aside. */
export function Steps({
  items,
}: {
  items: ReadonlyArray<{ id: string; label: React.ReactNode; state?: "done" | "current" }>;
}) {
  return (
    <ol className="flex flex-col gap-1">
      {items.map((item, index) => (
        <li
          key={item.id}
          className={cn(
            "rounded-control flex items-center gap-3 px-3 py-2 text-xs",
            item.state === "current"
              ? "bg-accent-soft text-accent-text font-semibold"
              : item.state === "done"
                ? "text-text"
                : "text-text-muted",
          )}
        >
          <span
            className={cn(
              "rounded-pill text-3xs grid size-5 shrink-0 place-content-center border font-semibold tabular-nums",
              item.state === "done" && "bg-success border-success text-white",
              item.state === "current" && "border-accent text-accent-text",
              !item.state && "border-line-strong",
            )}
          >
            {index + 1}
          </span>
          <span>{item.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** The brand lockup: the mark and the two-line wordmark. */
export function BrandLockup({ name, org, mark }: { name: string; org: string; mark: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="bg-accent rounded-data grid size-7 shrink-0 place-content-center text-sm font-bold tracking-tight text-white"
      >
        {mark}
      </span>
      <span className="flex min-w-0 flex-col leading-[1.15]">
        <span className="text-sm font-semibold whitespace-nowrap">{name}</span>
        <span className="text-text-subtle text-3xs whitespace-nowrap">{org}</span>
      </span>
    </div>
  );
}
