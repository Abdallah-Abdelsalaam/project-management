import { cn } from "@/lib/utils";

/**
 * Field primitives — `.field`, `.field__label`, `.field__help`, `.field__error`
 * from `wireframe/assets/css/components/forms.css`.
 *
 * One structural decision worth naming: help text sits **between** the label and
 * the input, as the wireframe's own comment insists — "so it is read before the
 * field is filled rather than after".
 */

export function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 flex-col gap-2", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-text flex items-center gap-2 text-xs font-medium", className)}
      {...props}
    />
  );
}

export function FieldHelp({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-text-muted text-2xs max-w-[60ch] leading-snug", className)} {...props} />
  );
}

/**
 * The inline error for one field. `role="alert"` so a screen reader announces
 * it when it appears after a failed submit, rather than leaving the user to
 * discover it by moving focus.
 */
export function FieldError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      role="alert"
      className={cn(
        "text-danger text-2xs flex items-start gap-2 leading-snug font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "bg-surface border-line-strong text-text rounded-control min-h-[38px] w-full border px-3 py-2 text-sm",
        "placeholder:text-text-subtle",
        "duration-fast transition-[border-color,box-shadow]",
        "hover:border-text-subtle",
        "focus:border-accent focus:outline-none",
        "disabled:bg-surface-sunk disabled:text-text-subtle",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The bordered wrapper that lets a control sit beside an input — the password
 * reveal button. The border and focus ring move to the group, and the input
 * inside loses its own, so the pair reads as one control.
 */
export function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-surface border-line-strong rounded-control flex items-center gap-2 border px-3",
        "duration-fast transition-[border-color,box-shadow]",
        "focus-within:border-accent",
        "[&>input]:min-h-[38px] [&>input]:w-full [&>input]:border-0 [&>input]:bg-transparent [&>input]:px-0 [&>input]:py-2 [&>input]:text-sm [&>input]:outline-none",
        "[&>input]:placeholder:text-text-subtle",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Checkbox with a label and an optional hint underneath — `.check`.
 *
 * The native input is styled rather than replaced, so it keeps its keyboard
 * behaviour, its indeterminate state and its participation in form data.
 */
export function Checkbox({
  label,
  hint,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-sm", className)}>
      <input
        type="checkbox"
        className={cn(
          "border-line-strong bg-surface rounded-data mt-px size-[18px] shrink-0 cursor-pointer appearance-none border-[1.5px]",
          "duration-fast grid place-content-center transition-colors",
          "hover:not-checked:border-text-subtle",
          "checked:bg-accent checked:border-accent",
          "before:duration-fast before:size-2.5 before:scale-0 before:bg-white before:transition-transform",
          "before:[clip-path:polygon(14%_44%,0_65%,43%_100%,100%_16%,82%_0%,39%_70%)]",
          "checked:before:scale-100",
        )}
        {...props}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>{label}</span>
        {hint ? <span className="text-text-muted text-2xs leading-snug">{hint}</span> : null}
      </span>
    </label>
  );
}
