import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { assertLocale } from "@/i18n/routing";
import { Alert, BrandLockup, KeyValue, Panel, PanelBody } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { AuthPane } from "@/features/auth/components/auth-pane";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { securityPolicy } from "@/lib/policy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = assertLocale(requested);
  const t = await getTranslations({ locale, namespace: "pages.resetPassword" });
  return { title: t("title"), description: t("sub"), robots: { index: false, follow: false } };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { locale: requested } = await params;
  const locale = assertLocale(requested);
  const { token, error } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "auth" });
  const app = await getTranslations({ locale, namespace: "app" });
  const policy = securityPolicy();

  // Better Auth appends `?error=INVALID_TOKEN` when the link has already been
  // spent or has aged out. Without a usable token there is no form to render —
  // only the way back.
  const unusable = !token || error;

  return (
    <>
      <AuthPane>
        <div className="flex flex-col gap-6">
          <BrandLockup name={app("name")} org={app("org")} mark={app("mark")} />

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">{t("reset.title")}</h1>
            <p className="text-text-muted text-xs">{t("reset.lede")}</p>
          </div>

          {unusable ? (
            <>
              <Alert tone="danger" title={t("reset.invalidToken.title")}>
                {t("reset.invalidToken.body")}
              </Alert>
              <Link href="/forgot-password">
                <Button variant="primary" size="lg" block>
                  {t("reset.requestAgain")}
                </Button>
              </Link>
            </>
          ) : (
            <>
              <ResetPasswordForm
                locale={locale}
                token={token}
                minLength={policy.passwordMinLength}
                historyDepth={policy.passwordHistoryDepth}
              />

              <Alert tone="warning" title={t("reset.warning.title")}>
                {t("reset.warning.body")}
              </Alert>
            </>
          )}
        </div>
      </AuthPane>

      <AuthPane aside>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t("reset.storage.title")}</h2>
            <p className="text-text-muted text-xs">{t("reset.storage.body")}</p>
          </div>

          <Panel>
            <PanelBody>
              <KeyValue
                rows={[
                  { key: t("reset.storage.rows.linkLife"), value: t("units.oneHour") },
                  { key: t("reset.storage.rows.uses"), value: t("units.onceOnly") },
                  {
                    key: t("reset.storage.rows.history"),
                    value: t("reset.storage.rows.historyValue", {
                      count: policy.passwordHistoryDepth,
                    }),
                  },
                  {
                    key: t("reset.storage.rows.effect"),
                    value: t("reset.storage.rows.effectValue"),
                  },
                ]}
              />
            </PanelBody>
          </Panel>
        </div>
      </AuthPane>
    </>
  );
}
