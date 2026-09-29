import { setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/features/auth/session";
import { assertLocale } from "@/i18n/routing";

/**
 * Everything inside the shell, and the route guard for all of it.
 *
 * One place resolves the session, and it is here: an unauthenticated request to
 * any `(app)` route is redirected to `/login` before a page renders, and the
 * resolved identity is passed down as props. No component below this decides who
 * the user is, which is why the sidebar and the topbar cannot disagree with the
 * server.
 *
 * Reading the session makes every route under `(app)` dynamic. That is the
 * unavoidable price of an authenticated shell — session 1's 61 static pages
 * were static only because nobody was signed in — and it is why
 * docs/02-ARCHITECTURE.md marks per-user pages as dynamic by design.
 *
 * The guard is *not* also in `src/proxy.ts`. A cookie-presence check there would
 * be faster but could only ever be a hint: the cookie may be expired, revoked or
 * past the absolute session ceiling, and only a database read knows. One
 * authoritative check beats a fast one plus a real one that can drift apart.
 *
 * The redirect does not carry the attempted path. Next does not expose the
 * pathname to a layout, and reconstructing it would mean rewriting the request
 * in the proxy — so a signed-out visitor lands on their role's landing page
 * rather than deep in the app. `safeNextPath` already supports a `next`
 * parameter for the callers that do have one.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: requested } = await params;
  const locale = assertLocale(requested);
  setRequestLocale(locale);

  const session = await requireSession(locale);

  return <AppShell user={session.user}>{children}</AppShell>;
}
