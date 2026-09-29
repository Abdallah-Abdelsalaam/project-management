import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { assertLocale } from "@/i18n/routing";
import { SettingsLayout } from "@/components/shell/settings-layout";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Alert, Panel, PanelBody, PanelHead, PanelTitle } from "@/components/ui/feedback";
import {
  ListRow,
  ListRowActions,
  ListRowBody,
  ListRowGlyph,
  ListRowMeta,
  ListRowTitle,
} from "@/components/ui/list-row";
import { PageHead, SectionNote } from "@/components/ui/page-head";
import { requireCapability } from "@/features/auth/session";
import { listRoles, countUsers } from "@/features/access/queries";
import { AddRoleDialog, EditRoleDialog } from "@/features/access/components/role-dialogs";
import { RoleGlyph } from "@/features/access/components/role-glyph";
import { cn } from "@/lib/utils";

/**
 * `/settings/roles` — `wireframe/pages/settings/roles.html`.
 *
 * A Server Component down to the two dialogs. The row meta line is assembled
 * from live data rather than copy: the scope, the permission count and the
 * description are three columns and a computed total, so a role an
 * administrator creates gets a correct sentence without anyone writing one.
 *
 * `requireCapability` runs **here**, not only in the nav. Hiding the settings
 * link from an agent stops them stumbling in; this stops them typing the URL.
 */

/**
 * The `<code>` tag inside the explainer's messages.
 *
 * A capability string is Latin text inside an Arabic sentence, so it needs
 * `dir="ltr"` and its own bidi isolate — without the isolate the surrounding
 * punctuation reorders around it and `tasks.*` renders as `*.tasks`.
 */
const ltr = (chunks: React.ReactNode) => (
  <span dir="ltr" className="isolate">
    {chunks}
  </span>
);

const GROUP_WILDCARDS = [
  "tasks.*",
  "team.*",
  "employee.*",
  "dept.*",
  "heads.manage",
  "leads.manage",
  "reports.*",
  "audit.view",
  "settings.view",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings.roles" });
  return { title: t("title"), description: t("sub") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = assertLocale(requested);
  setRequestLocale(locale);

  await requireCapability(locale, "settings.view");

  const t = await getTranslations("settings");
  const [roles, users] = await Promise.all([listRoles(), countUsers()]);

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        crumbsLabel={t("crumbs.label")}
        crumbs={[{ label: t("crumbs.settings") }, { label: t("roles.title") }]}
        title={t("roles.title")}
        sub={t("roles.sub")}
        actions={
          <AddRoleDialog
            locale={locale}
            label={t("roles.add")}
            baseRoles={roles
              .filter((role) => !role.isAdmin)
              .map((role) => ({ id: role.id, name: role.name }))}
          />
        }
      />

      <SettingsLayout active="roles">
        <Panel>
          <PanelHead>
            <PanelTitle>{t("roles.panelTitle")}</PanelTitle>
            <SectionNote>
              {t("roles.summary", {
                roles: t("counts.roles", { count: roles.length }),
                users: t("counts.users", { count: users }),
              })}
            </SectionNote>
          </PanelHead>

          <div className="p-0">
            {roles.map((role) => {
              const breadth =
                role.breadth.kind === "all"
                  ? t("roles.meta.all")
                  : role.breadth.kind === "wildcard"
                    ? t("roles.meta.wildcard")
                    : t("roles.meta.counted", { count: role.breadth.count });

              const meta = [
                t("roles.meta.scope", {
                  scope: role.scopeLabel ?? t(`scopes.${role.scope}`),
                }),
                breadth,
                role.description,
              ].filter(Boolean);

              return (
                <ListRow key={role.id} data-role={role.key}>
                  <ListRowGlyph>
                    <RoleGlyph name={role.icon} />
                  </ListRowGlyph>

                  <ListRowBody>
                    <ListRowTitle>
                      {role.name}
                      <Badge>{t("counts.users", { count: role.userCount })}</Badge>
                      {role.isAdmin && <Badge tone="danger">{t("roles.fullAccess")}</Badge>}
                    </ListRowTitle>
                    <ListRowMeta>{meta.join(" · ")}</ListRowMeta>
                  </ListRowBody>

                  <ListRowActions>
                    {role.isAdmin ? (
                      // The admin role has no edit affordance at all, which is
                      // the wireframe's own answer to "what does a protected
                      // row look like" — a badge, not a disabled button.
                      <Badge tone="outline">{t("roles.protected")}</Badge>
                    ) : (
                      <>
                        <Link
                          href="/settings/permissions"
                          className={cn(buttonClass({ variant: "quiet", size: "md" }))}
                        >
                          {t("roles.permissionsLink")}
                        </Link>
                        <EditRoleDialog
                          locale={locale}
                          label={t("roles.editLabel", { name: role.name })}
                          role={{
                            id: role.id,
                            name: role.name,
                            key: role.key,
                            scope: role.scope,
                            userCount: role.userCount,
                            deletable: role.deletable,
                            isSystem: role.isSystem,
                          }}
                          trigger={
                            <span
                              className={cn(
                                buttonClass({ variant: "quiet", size: "icon" }),
                                "text-base leading-none",
                              )}
                            >
                              ⋯
                            </span>
                          }
                        />
                      </>
                    )}
                  </ListRowActions>
                </ListRow>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <PanelHead>
            <PanelTitle>{t("roles.explainer.title")}</PanelTitle>
          </PanelHead>
          <PanelBody className="flex flex-col gap-4">
            <Alert tone="info" title={t("roles.explainer.stringTitle")}>
              {t.rich("roles.explainer.stringBody", { code: ltr })}
            </Alert>

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold">{t("roles.explainer.groupsTitle")}</h3>
              <div className="flex flex-wrap items-center gap-2">
                {GROUP_WILDCARDS.map((grant) => (
                  <Badge key={grant} tone="outline" dir="ltr" className="isolate">
                    {grant}
                  </Badge>
                ))}
              </div>
              <p className="text-text-subtle text-3xs">
                {t.rich("roles.explainer.groupsNote", { code: ltr })}
              </p>
            </div>

            <Alert tone="warning" title={t("roles.explainer.hideTitle")}>
              {t("roles.explainer.hideBody")}
            </Alert>
          </PanelBody>
        </Panel>
      </SettingsLayout>
    </div>
  );
}
