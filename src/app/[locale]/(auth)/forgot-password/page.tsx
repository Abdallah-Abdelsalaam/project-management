import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { assertLocale } from "@/i18n/routing";
import { Note, Steps } from "@/components/ui/feedback";
import { AuthPane } from "@/features/auth/components/auth-pane";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = assertLocale(requested);
  const t = await getTranslations({ locale, namespace: "pages.forgotPassword" });
  return { title: t("title"), description: t("sub"), robots: { index: false, follow: false } };
}

const STEPS = ["enter", "receive", "choose", "revoke", "signIn"] as const;

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = assertLocale(requested);
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <>
      <AuthPane>
        <div className="flex flex-col gap-6">
          <Link
            href="/login"
            className="text-text-muted hover:text-text flex items-center gap-2 text-xs"
          >
            {/* "Back" is a direction, not a side: it points left in LTR and
                right in RTL — the wireframe's `.icon--dir` rule. */}
            <ArrowLeft size={16} aria-hidden="true" className="rtl:-scale-x-100" />
            {t("code.back")}
          </Link>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">{t("forgot.title")}</h1>
            <p className="text-text-muted text-xs">{t("forgot.lede")}</p>
          </div>

          <ForgotPasswordForm locale={locale} />

          <p className="text-text-subtle text-3xs">{t("forgot.auditNote")}</p>
        </div>
      </AuthPane>

      <AuthPane aside>
        <div className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold">{t("forgot.after.title")}</h2>

          <Steps
            items={STEPS.map((step, index) => ({
              id: step,
              label: t(`forgot.after.${step}`),
              // Step 1 is behind the visitor the moment they are on this page;
              // step 2 is what they are waiting for.
              state: index === 0 ? "done" : index === 1 ? "current" : undefined,
            }))}
          />

          <Note>
            <strong>{t("forgot.after.noteLabel")}</strong> {t("forgot.after.note")}
          </Note>
        </div>
      </AuthPane>
    </>
  );
}
