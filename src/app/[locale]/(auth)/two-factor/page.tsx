import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.twoFactor" });
  return { title: t("title"), description: t("sub") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <PagePlaceholder
      titleKey="pages.twoFactor.title"
      subKey="pages.twoFactor.sub"
      wireframe="wireframe/pages/auth/two-factor.html"
      session={2}
    />
  );
}
