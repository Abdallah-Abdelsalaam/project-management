import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

/** Locale-aware replacements for next/link and next/navigation. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

/**
 * `redirect` with an explicitly declared `never` return.
 *
 * next-intl's `redirect` is already typed `never`, but TypeScript only uses a
 * `never` return for reachability analysis when the callee is a *declared*
 * function with an explicit annotation — not an imported const whose type came
 * out of a generic call. Without this wrapper every function that ends in a
 * redirect needs an unreachable `return` to satisfy the compiler.
 */
export function redirectLocale(args: Parameters<typeof redirect>[0]): never {
  return redirect(args);
}
