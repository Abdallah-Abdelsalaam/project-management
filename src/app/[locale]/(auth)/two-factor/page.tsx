import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirectLocale } from "@/i18n/navigation";
import { assertLocale } from "@/i18n/routing";
import { Alert, KeyValue, Panel, PanelBody } from "@/components/ui/feedback";
import { AuthPane } from "@/features/auth/components/auth-pane";
import { TwoFactorForm } from "@/features/auth/components/two-factor-form";
import { readResendCooldown } from "@/features/auth/actions";
import { pendingChallenge } from "@/features/auth/pending-challenge";
import { securityPolicy, twoFactorPolicy } from "@/lib/policy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = assertLocale(requested);
  const t = await getTranslations({ locale, namespace: "pages.twoFactor" });
  return { title: t("title"), description: t("sub"), robots: { index: false, follow: false } };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; trust?: string }>;
}) {
  const { locale: requested } = await params;
  const locale = assertLocale(requested);
  const { next, trust } = await searchParams;
  setRequestLocale(locale);

  // This screen only exists for a live challenge. Without one there is nothing
  // to verify, and rendering six empty boxes that can never succeed is worse
  // than sending the visitor back to the start.
  const challenge = await pendingChallenge();
  if (!challenge) {
    redirectLocale({ href: "/login", locale });
  }

  const t = await getTranslations({ locale, namespace: "auth" });
  const policy = twoFactorPolicy();
  const security = securityPolicy();
  const cooldown = await readResendCooldown();

  return (
    <>
      <AuthPane>
        <div className="flex flex-col gap-6">
          <Link
            href="/login"
            className="text-text-muted hover:text-text flex items-center gap-2 text-xs"
          >
            {/* "Back" is a direction, not a side: it points left in LTR and
                right in RTL. One icon mirrored, which is exactly what the
                wireframe's `.icon--dir` rule does. */}
            <ArrowLeft size={16} aria-hidden="true" className="rtl:-scale-x-100" />
            {t("code.back")}
          </Link>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">{t("code.title")}</h1>
            <p className="text-text-muted text-xs">
              {t("code.lede", { minutes: policy.codeLifetimeMinutes })}{" "}
              <strong dir="ltr" className="font-semibold">
                {challenge.email}
              </strong>
            </p>
          </div>

          <TwoFactorForm
            locale={locale}
            codeLength={policy.codeLength}
            trustByDefault={trust === "1"}
            next={next}
            initialCooldown={cooldown}
            resendWaitSeconds={policy.resendWaitSeconds}
            trustDays={policy.trustedDeviceDays}
            maxAttempts={policy.codeMaxAttempts}
            lockMinutes={security.loginLockoutMinutes}
          />

          <Alert tone="info" title={t("code.noAccess.title")}>
            {t("code.noAccess.body")}
          </Alert>
        </div>
      </AuthPane>

      <AuthPane aside>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t("why.title")}</h2>
            <p className="text-text-muted text-xs">{t("why.body")}</p>
          </div>

          <Panel>
            <PanelBody className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="bg-success-soft text-success rounded-data text-3xs inline-flex items-center px-2 py-0.5 font-medium">
                  {t("why.enabled")}
                </span>
                <span className="text-xs">{t("why.method")}</span>
              </div>

              <KeyValue
                rows={[
                  {
                    key: t("why.rows.codeLife"),
                    value: t("units.minutes", { count: policy.codeLifetimeMinutes }),
                  },
                  {
                    key: t("why.rows.trustWindow"),
                    value: t("units.days", { count: policy.trustedDeviceDays }),
                  },
                  { key: t("why.rows.forced"), value: t("why.rows.forcedValue") },
                  {
                    key: t("why.rows.maxAttempts"),
                    value: t("why.rows.maxAttemptsValue", {
                      attempts: policy.codeMaxAttempts,
                      minutes: security.loginLockoutMinutes,
                    }),
                  },
                ]}
              />

              <p className="text-text-subtle text-3xs">{t("why.configurable")}</p>
            </PanelBody>
          </Panel>
        </div>
      </AuthPane>
    </>
  );
}
