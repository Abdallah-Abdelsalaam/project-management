import { setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/shell/app-shell";
import type { RoleKey } from "@/lib/permissions";

/**
 * Everything inside the shell. Auth is wired in session 2; until then the
 * shell renders as a manager so every nav group is visible for review.
 * See docs/OPEN_QUESTIONS.md Q13.
 */
const PLACEHOLDER_ROLE: RoleKey = "manager";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AppShell role={PLACEHOLDER_ROLE}>{children}</AppShell>;
}
