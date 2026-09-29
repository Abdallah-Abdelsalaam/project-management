import type { ReactNode } from "react";

/**
 * The real document shell lives in src/app/[locale]/layout.tsx, because
 * `lang` and `dir` depend on the locale. This root layout only exists to
 * satisfy Next's requirement for one at the top of the tree.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
