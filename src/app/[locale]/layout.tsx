import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { localeDirection, routing, type Locale } from "@/i18n/routing";
import "@/app/globals.css";

/**
 * One family for the whole product: IBM Plex Sans Arabic. It is legible at
 * 12px, has genuine Arabic design intent, and reads as engineered rather than
 * friendly — correct for an operations tool.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });

  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("org"),
  };
}

/**
 * Applies the stored theme and density before first paint, so a dark-mode
 * user never sees a light flash. Wrapped in try/catch: blocked storage must
 * not break rendering.
 */
const BOOT_SCRIPT = `try{var t=localStorage.getItem("pm.theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);var d=localStorage.getItem("pm.density");if(d)document.documentElement.setAttribute("data-density",d);}catch(e){}`;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "app" });

  return (
    <html lang={locale} dir={localeDirection[locale as Locale]} suppressHydrationWarning>
      <body className={`${plexArabic.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <a className="skip-link" href="#main">
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
