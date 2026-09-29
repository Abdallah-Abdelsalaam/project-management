import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — a port of `.btn` and its modifiers from
 * `wireframe/assets/css/components/buttons.css`.
 *
 * Only the variants the auth screens use are defined. The rest arrive with the
 * screens that need them rather than as speculative API.
 *
 * `primary` is the only full-saturation use of the brand red in the system, and
 * it appears once per screen — which is what keeps it meaningful. Note the dark
 * theme flips its *text* to near-black, because `#ff2e5f` with white on it
 * fails contrast.
 */
const button = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-control border",
    "transition-colors duration-fast",
    "disabled:pointer-events-none disabled:opacity-45",
    "aria-disabled:pointer-events-none aria-disabled:opacity-45",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-accent border-accent font-semibold text-white hover:bg-brand-600 hover:border-brand-600 active:bg-brand-700 active:border-brand-700 dark:text-[#1a0008]",
        secondary:
          "bg-surface border-line-strong text-text hover:bg-surface-sunk hover:border-text-subtle",
        ghost: "border-transparent text-text-muted hover:bg-surface-sunk hover:text-text",
        quiet: "border-transparent text-text-subtle hover:bg-surface-sunk hover:text-text",
      },
      size: {
        md: "min-h-9 px-4 py-2 text-sm",
        lg: "min-h-11 px-6 py-2 text-md",
        quiet: "min-h-7 px-2 text-xs",
        icon: "size-9 shrink-0 p-0",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "secondary", size: "md", block: false },
  },
);

export type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof button>;

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size, block }), className)} {...props} />;
}

export { button as buttonClass };
