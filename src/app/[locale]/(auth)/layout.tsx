import { setRequestLocale } from "next-intl/server";

/**
 * Authentication pages sit outside the shell: no sidebar, no topbar, no
 * task-creation dock. A single centred column on the sunken surface.
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
    <div className="bg-surface-sunk grid min-h-dvh place-items-center p-4">
      <main id="main" className="w-full max-w-sm">
        {children}
      </main>
    </div>
  );
}
