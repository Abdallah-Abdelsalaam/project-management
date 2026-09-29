"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup } from "@/components/ui/field";
import { Alert, Note, Panel, PanelFoot, PanelHead, PanelTitle } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { PageHead } from "@/components/ui/page-head";
import { SettingsGrid } from "@/components/shell/settings-layout";
import { restoreDefaultsAction, saveMatrixAction } from "@/features/access/actions";
import type { Matrix } from "@/features/access/queries";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * The permissions screen — capabilities down, roles across.
 *
 * It owns the page header as well as the matrix, because the wireframe puts
 * **حفظ التغييرات** in both places and both must reflect the same dirty
 * state. The sub-navigation is still rendered on the server and handed in as
 * a prop, so nothing about it ships to the browser.
 *
 * ## What the client is allowed to decide
 *
 * Nothing. It collects checkbox changes and posts them; `saveMatrixAction`
 * re-checks the session, the capability, the admin column and the "you cannot
 * grant what you do not hold" rule before a row moves. The admin column's
 * missing checkbox is an affordance so nobody wastes a click, and the
 * wireframe says as much itself: "إخفاء زرّ ليس حماية".
 *
 * ## Dirty state
 *
 * Only cells that differ from what the server sent are kept, so ticking a box
 * and unticking it leaves nothing to save and the save buttons go quiet
 * again. The count in the foot is that same map, not a click tally.
 *
 * ## Search
 *
 * Filters by label **and** by key, because an administrator reading the audit
 * log sees `tasks.approve` and will type that. A group whose rows all filter
 * away hides its heading rather than leaving an empty band.
 *
 * The first column is sticky so a capability name stays visible while the
 * role columns scroll — without it, a checkbox in the fifth column at 390px
 * means nothing.
 */

type CellKey = string;

const cellKey = (roleId: string, capability: string): CellKey => `${roleId}::${capability}`;

export function PermissionMatrix({
  locale,
  matrix,
  lastChange,
  canRestore,
  nav,
}: {
  locale: Locale;
  matrix: Matrix;
  /** Pre-formatted on the server, so `Intl` runs with the request's locale. */
  lastChange: { at: string; actor: string | null } | null;
  /** Only someone who holds every capability may rewrite the defaults. */
  canRestore: boolean;
  nav: React.ReactNode;
}) {
  const t = useTranslations("settings.permissions");
  const ts = useTranslations("settings");
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [changes, setChanges] = useState<Map<CellKey, boolean>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return matrix.groups;

    return matrix.groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter(
          (row) =>
            row.label.toLowerCase().includes(needle) || row.key.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [matrix.groups, query]);

  const visible = groups.reduce((total, group) => total + group.permissions.length, 0);
  const dirty = changes.size > 0;

  function toggle(roleId: string, capability: string, stored: boolean, next: boolean) {
    setSaved(false);
    setChanges((current) => {
      const updated = new Map(current);
      const key = cellKey(roleId, capability);
      // Back to what the server holds is not a change; dropping it is what
      // makes the count mean "unsaved differences".
      if (next === stored) updated.delete(key);
      else updated.set(key, next);
      return updated;
    });
  }

  function discard() {
    setChanges(new Map());
    setError(null);
    setSaved(false);
  }

  function save() {
    if (!dirty) return;
    setError(null);
    setSaved(false);

    const payload = [...changes.entries()].map(([key, granted]) => {
      const separator = key.lastIndexOf("::");
      return {
        roleId: key.slice(0, separator),
        capability: key.slice(separator + 2),
        granted,
      };
    });

    startTransition(async () => {
      const result = await saveMatrixAction({ locale, changes: payload });
      if (result.status !== "ok") {
        setError(result.status);
        return;
      }
      setChanges(new Map());
      setSaved(true);
      router.refresh();
    });
  }

  function restore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreDefaultsAction({ locale });
      if (result.status !== "ok") {
        setError(result.status);
        return;
      }
      setRestoring(false);
      setChanges(new Map());
      setSaved(true);
      router.refresh();
    });
  }

  const saveButtons = (size: "quiet" | "md") => (
    <>
      <Button
        type="button"
        variant="secondary"
        size={size}
        disabled={!dirty || pending}
        onClick={discard}
      >
        {t("cancel")}
      </Button>
      <Button
        type="button"
        variant="primary"
        size={size}
        disabled={!dirty || pending}
        onClick={save}
        data-save-matrix
      >
        {pending ? t("saving") : t("save")}
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        crumbsLabel={ts("crumbs.label")}
        crumbs={[{ label: ts("crumbs.settings"), href: "/settings/roles" }, { label: t("title") }]}
        title={t("title")}
        sub={t("sub")}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="quiet"
              disabled={!canRestore || pending}
              onClick={() => setRestoring(true)}
            >
              {t("restore")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="quiet"
              disabled={!dirty || pending}
              onClick={save}
            >
              {pending ? t("saving") : t("save")}
            </Button>
          </>
        }
      />

      <SettingsGrid nav={nav}>
        {error ? <Alert tone="danger" live title={t(`errors.${error}`)} /> : null}
        {!error && saved ? <Alert tone="success" live title={t("saved")} /> : null}

        <Alert tone="info" title={t("lockedTitle")}>
          {t("lockedBody")}
        </Alert>

        <Panel>
          <PanelHead className="flex-wrap gap-3">
            <PanelTitle>{t("matrixTitle")}</PanelTitle>
            <InputGroup className="min-w-[220px]">
              <Search size={16} aria-hidden="true" className="text-text-subtle shrink-0" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
              />
            </InputGroup>
          </PanelHead>

          <div className="overflow-x-auto">
            {visible === 0 ? (
              <p className="text-text-muted p-5 text-xs">{t("noResults")}</p>
            ) : (
              <table className="w-full min-w-[720px] text-xs">
                <caption className="sr-only">{t("tableCaption")}</caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="bg-surface-alt border-line text-text-muted text-3xs sticky start-0 top-0 z-30 min-w-[240px] border-b p-3 text-start font-semibold whitespace-nowrap"
                    >
                      {t("columnCapability")}
                    </th>
                    {matrix.roles.map((role) => (
                      <th
                        key={role.id}
                        scope="col"
                        className="bg-surface-alt border-line text-text-muted text-3xs sticky top-0 z-20 border-b p-3 text-center font-semibold whitespace-nowrap"
                      >
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <Fragment key={group.group}>
                      <tr>
                        <th
                          colSpan={matrix.roles.length + 1}
                          scope="colgroup"
                          className="bg-surface-sunk text-text text-2xs border-line-soft border-b px-3 py-2 text-start font-semibold"
                        >
                          {t(`groups.${group.group}`)}
                        </th>
                      </tr>

                      {group.permissions.map((row) => (
                        <tr key={row.key} className="group">
                          <th
                            scope="row"
                            className="bg-surface border-line-soft group-hover:bg-surface-alt sticky start-0 z-10 min-w-[240px] border-e border-b px-3 py-2 text-start font-normal"
                          >
                            <span className="flex flex-col gap-px">
                              <span>{row.label}</span>
                              <span dir="ltr" className="text-text-subtle text-3xs isolate">
                                {row.key}
                              </span>
                            </span>
                          </th>

                          {matrix.roles.map((role) => {
                            const stored = role.granted[row.key] ?? false;
                            const key = cellKey(role.id, row.key);
                            const checked = changes.get(key) ?? stored;

                            return role.isAdmin ? (
                              <td
                                key={role.id}
                                aria-label={t("alwaysGranted", { role: role.name })}
                                className="border-line-soft group-hover:bg-surface-alt text-success border-b p-2 text-center"
                              >
                                <Check size={14} aria-hidden="true" className="mx-auto" />
                              </td>
                            ) : (
                              <td
                                key={role.id}
                                className="border-line-soft group-hover:bg-surface-alt border-b p-2 text-center"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={pending}
                                  onChange={(event) =>
                                    toggle(role.id, row.key, stored, event.target.checked)
                                  }
                                  data-cell={key}
                                  aria-label={t("cellLabel", {
                                    role: role.name,
                                    capability: row.label,
                                  })}
                                  className={cn(
                                    "border-line-strong bg-surface rounded-data size-[18px] cursor-pointer appearance-none border-[1.5px]",
                                    "duration-fast grid place-content-center align-middle transition-colors",
                                    "hover:not-checked:border-text-subtle",
                                    "checked:bg-accent checked:border-accent",
                                    "disabled:cursor-not-allowed disabled:opacity-50",
                                    "before:duration-fast before:size-2.5 before:scale-0 before:bg-white before:transition-transform",
                                    "before:[clip-path:polygon(14%_44%,0_65%,43%_100%,100%_16%,82%_0%,39%_70%)]",
                                    "checked:before:scale-100",
                                    // An unsaved cell is ringed, so "what have
                                    // I changed" is answerable without
                                    // remembering.
                                    changes.has(key) && "ring-accent ring-2 ring-offset-1",
                                  )}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <PanelFoot>
            <p className="text-text-subtle text-3xs">
              {t("foot", {
                permissions: ts("counts.permissions", { count: matrix.total }),
                groups: ts("counts.groups", { count: matrix.groups.length }),
              })}
              {" · "}
              {lastChange
                ? lastChange.actor
                  ? t("lastChange", { when: lastChange.at, actor: lastChange.actor })
                  : t("lastChangeUnknown", { when: lastChange.at })
                : t("neverChanged")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {dirty ? (
                <span className="text-accent-text text-3xs font-semibold" data-dirty-count>
                  {t("dirty", { changes: ts("counts.changes", { count: changes.size }) })}
                </span>
              ) : null}
              {saveButtons("quiet")}
            </div>
          </PanelFoot>
        </Panel>

        <Note>
          {t.rich("note", {
            strong: (chunks) => <strong>{chunks}</strong>,
            code: (chunks) => (
              <span dir="ltr" className="isolate">
                {chunks}
              </span>
            ),
          })}
        </Note>
      </SettingsGrid>

      {restoring && (
        <Modal
          title={t("restoreTitle")}
          sub={t("restoreConfirm")}
          onClose={() => setRestoring(false)}
          closeLabel={t("cancel")}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRestoring(false)}
                disabled={pending}
              >
                {t("cancel")}
              </Button>
              <Button type="button" variant="primary" onClick={restore} disabled={pending}>
                {pending ? t("restoring") : t("restoreSubmit")}
              </Button>
            </>
          }
        >
          <p className="text-text-muted text-xs">{t("lockedBody")}</p>
        </Modal>
      )}
    </div>
  );
}
