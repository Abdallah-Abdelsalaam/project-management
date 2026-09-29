import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.leaders" });
  return { title: t("title"), description: t("sub") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <PagePlaceholder
      titleKey="pages.leaders.title"
      subKey="pages.leaders.sub"
      wireframe="wireframe/pages/org/team-leaders.html"
      session={16}
    />
  );
}
