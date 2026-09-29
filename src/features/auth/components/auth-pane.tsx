import { cn } from "@/lib/utils";

/**
 * One half of the auth screen — `.auth__pane` and `.auth__aside`.
 *
 * The aside is the only place in the system with a tinted full-bleed surface,
 * which is why the wireframe scopes it to the auth pages rather than putting it
 * in a component file no other page would use. Same reasoning here.
 */
export function AuthPane({
  aside = false,
  className,
  children,
}: {
  aside?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-center px-5 py-8 min-[480px]:px-10 min-[480px]:py-12",
        aside && "bg-surface border-line hidden border-s min-[960px]:flex",
        className,
      )}
    >
      <div className={cn("mx-auto w-full", aside ? "max-w-[420px]" : "max-w-[400px]")}>
        {children}
      </div>
    </div>
  );
}
