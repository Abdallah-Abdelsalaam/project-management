import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PagePlaceholder } from "@/components/shell/page-placeholder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.departmentDetail" });
  return { title: t("title"), description: t("sub") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <PagePlaceholder
      titleKey="pages.departmentDetail.title"
      subKey="pages.departmentDetail.sub"
      wireframe="wireframe/pages/org/department-detail.html"
      session={4}
    />
  );
}
