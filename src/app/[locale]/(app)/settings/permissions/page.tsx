import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { assertLocale } from "@/i18n/routing";
import { SettingsSubnav } from "@/components/shell/settings-layout";
import { requireCapability } from "@/features/auth/session";
import { lastMatrixChange, loadMatrix } from "@/features/access/queries";
import { PermissionMatrix } from "@/features/access/components/permission-matrix";
import { CAPABILITIES, grantsInclude } from "@/lib/permissions";

/**
 * `/settings/permissions` — `wireframe/pages/settings/permissions.html`.
 *
 * The page resolves everything and the client component renders it. Three
 * things are decided here rather than in the browser, each because the
 * browser is the wrong place for it:
 *
 *   - **The capability check.** Server-side, before a byte of the matrix is
 *     computed, so an agent who types the URL gets nothing to look at.
 *   - **`canRestore`.** Restoring writes `*` back onto the admin role, so
 *     only someone who already holds every capability may press it. The
 *     action re-checks; this only greys the button.
 *   - **The "last changed" date.** Formatted with `Intl` on the server so it
 *     is rendered once, in the request's locale and calendar, instead of
 *     hydrating differently to how it was sent.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings.permissions" });
  return { title: t("title"), description: t("sub") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = assertLocale(requested);
  setRequestLocale(locale);

  const session = await requireCapability(locale, "settings.view");

  const [matrix, change, format] = await Promise.all([
    loadMatrix(locale),
    lastMatrixChange(),
    getFormatter({ locale }),
  ]);

  const canRestore = CAPABILITIES.every((capability) =>
    grantsInclude(session.user.grants, capability),
  );

  return (
    <PermissionMatrix
      locale={locale}
      matrix={matrix}
      canRestore={canRestore}
      lastChange={
        change
          ? {
              at: format.dateTime(change.at, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
              actor: change.actor,
            }
          : null
      }
      nav={<SettingsSubnav active="permissions" />}
    />
  );
}
