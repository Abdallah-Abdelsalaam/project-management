import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandLockup, Alert } from "@/components/ui/feedback";
import { AuthPane } from "@/features/auth/components/auth-pane";
import { LoginForm } from "@/features/auth/components/login-form";
import { WorkflowAside } from "@/features/auth/components/workflow-aside";
import { currentSession, landingPathFor } from "@/features/auth/session";
import { redirectLocale } from "@/i18n/navigation";
import { assertLocale } from "@/i18n/routing";
import { twoFactorPolicy } from "@/lib/policy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = assertLocale(requested);
  const t = await getTranslations({ locale, namespace: "pages.login" });
  return {
    title: t("title"),
    description: t("sub"),
    // Every auth screen is noindex in the wireframe, and there is nothing here
    // a search engine should hold.
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { locale: requested } = await params;
  const locale = assertLocale(requested);
  const { next, reset } = await searchParams;
  setRequestLocale(locale);

  // Someone already signed in has no business on the sign-in screen; send them
  // where they were going.
  const session = await currentSession();
  if (session) {
    redirectLocale({ href: landingPathFor(session.user.role), locale });
  }

  const t = await getTranslations({ locale, namespace: "auth" });
  const app = await getTranslations({ locale, namespace: "app" });
  const policy = twoFactorPolicy();

  return (
    <>
      <AuthPane>
        <div className="flex flex-col gap-6">
          <BrandLockup name={app("name")} org={app("org")} mark={app("mark")} />

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
            <p className="text-text-muted text-xs">{t("login.lede")}</p>
          </div>

          <LoginForm
            locale={locale}
            trustDays={policy.trustedDeviceDays}
            next={next}
            justReset={reset === "1"}
          />

          <Alert tone="info" title={t("login.restricted.title")}>
            {t("login.restricted.body")}
          </Alert>

          <p className="text-text-subtle text-3xs">{t("login.auditNote")}</p>
        </div>
      </AuthPane>

      <AuthPane aside>
        <WorkflowAside locale={locale} />
      </AuthPane>
    </>
  );
}
