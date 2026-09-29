import { setRequestLocale } from "next-intl/server";

/**
 * The authentication shell: two equal panes, the form on the inline-start side
 * and an explainer aside on the other — `.auth` in
 * `wireframe/assets/css/04-layout.css`.
 *
 * No sidebar, no topbar, no task-creation dock.
 *
 * The aside is *removed* below 960px rather than stacked. That is the
 * wireframe's own rule and it is the right one: the aside is context, and
 * pushing the sign-in form below a screenful of it on a phone would bury the
 * only thing the visitor came for. 960px is not a Tailwind breakpoint, so it is
 * written out — matching the wireframe matters more than matching the scale.
 *
 * Each page supplies both panes, because the aside differs per screen: the
 * workflow map on login, "لماذا خطوة إضافية" on two-factor.
 */
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main
      id="main"
      className="grid min-h-dvh grid-cols-[minmax(0,1fr)] min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      {children}
    </main>
  );
}
