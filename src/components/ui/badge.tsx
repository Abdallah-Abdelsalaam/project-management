import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — `.badge` and its tones from
 * `wireframe/assets/css/components/data.css`.
 *
 * Brand red is never a status, which is why there is an `accent` tone and a
 * `danger` tone and they are not the same colour. `accent` marks something
 * selected or current; `danger` marks something wrong or dangerous. The roles
 * screen uses `danger` for "وصول كامل" — an unrestricted role *is* the risk
 * the badge is naming.
 */
const badge = cva(
  "inline-flex items-center gap-1 rounded-data px-2 py-0.5 text-3xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunk text-text-muted",
        accent: "bg-accent-soft text-accent-text",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        outline: "border-line border bg-transparent text-text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badge>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
