"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldHelp, FieldLabel, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { SCOPES, type Scope } from "@/lib/permissions";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "@/features/access/actions";
import type { ActionResult } from "@/features/access/actions";
import type { Locale } from "@/i18n/routing";

/**
 * The add-role and edit-role dialogs.
 *
 * Both post to a Server Action and both get back a **state key**, never a
 * message — the same contract session 2 established for auth. The screen owns
 * the strings, so `messages/{ar,en}.json` stays the only place a user-visible
 * sentence lives and a test can assert on `keyTaken` instead of on Arabic
 * prose.
 *
 * `router.refresh()` after a success rather than optimistic local state: the
 * list shows counts and derived permission totals that only the server can
 * compute, and showing a guess that the next load contradicts is worse than a
 * brief wait.
 */

export type RoleOption = { id: string; name: string };

function errorKey(result: ActionResult): string | null {
  return result.status === "ok" ? null : result.status;
}

/* -------------------------------------------------------------------------- */

export function AddRoleDialog({
  locale,
  baseRoles,
  label,
}: {
  locale: Locale;
  /** Roles offered under "ابدأ من". The admin role is not among them. */
  baseRoles: RoleOption[];
  label: string;
}) {
  const t = useTranslations("settings.roles");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createRoleAction({
        locale,
        name: String(formData.get("name") ?? ""),
        key: String(formData.get("key") ?? ""),
        scope: String(formData.get("scope") ?? "own"),
        baseRoleId: String(formData.get("baseRoleId") ?? ""),
      });

      const failure = errorKey(result);
      if (failure) {
        setError(failure);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="primary" size="quiet" onClick={() => setOpen(true)}>
        {label}
      </Button>

      {open && (
        <Modal
          title={t("create.title")}
          sub={t("create.sub")}
          onClose={() => setOpen(false)}
          closeLabel={t("create.cancel")}
        >
          <form id="add-role" action={submit} className="flex flex-col gap-4">
            {error ? (
              <Alert tone="danger" live>
                {t(`errors.${error}`)}
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="ar-name">
                {t("create.name")}
                <RequiredMark />
              </FieldLabel>
              <Input
                id="ar-name"
                name="name"
                required
                maxLength={128}
                placeholder={t("create.namePlaceholder")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="ar-key">
                {t("create.key")}
                <RequiredMark />
              </FieldLabel>
              <FieldHelp>{t("create.keyHelp")}</FieldHelp>
              <Input
                id="ar-key"
                name="key"
                required
                dir="ltr"
                maxLength={64}
                pattern="[a-z][a-z0-9_]*"
                title={t("errors.keyFormat")}
                placeholder={t("create.keyPlaceholder")}
                className="text-start"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="ar-base">{t("create.base")}</FieldLabel>
              <Select id="ar-base" name="baseRoleId" defaultValue="">
                <option value="">{t("create.baseEmpty")}</option>
                {baseRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>

            <ScopeField id="ar-scope" defaultValue="team" />
          </form>

          <ModalActions
            cancel={t("create.cancel")}
            submit={pending ? t("create.submitting") : t("create.submit")}
            form="add-role"
            pending={pending}
            onCancel={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

export function EditRoleDialog({
  locale,
  role,
  label,
  trigger,
}: {
  locale: Locale;
  role: {
    id: string;
    name: string;
    key: string;
    scope: Scope;
    userCount: number;
    deletable: boolean;
    isSystem: boolean;
  };
  label: string;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("settings.roles");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setConfirmingDelete(false);
    setError(null);
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateRoleAction({
        locale,
        roleId: role.id,
        name: String(formData.get("name") ?? ""),
        scope: String(formData.get("scope") ?? role.scope),
      });

      const failure = errorKey(result);
      if (failure) {
        setError(failure);
        return;
      }

      close();
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRoleAction({ locale, roleId: role.id });

      const failure = errorKey(result);
      if (failure) {
        setError(failure);
        return;
      }

      close();
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" aria-label={label} onClick={() => setOpen(true)} className="contents">
        {trigger}
      </button>

      {open && (
        <Modal
          title={confirmingDelete ? t("delete.action") : t("edit.title")}
          sub={confirmingDelete ? t("delete.confirm", { name: role.name }) : t("edit.sub")}
          onClose={close}
          closeLabel={t("edit.cancel")}
        >
          {error ? (
            <Alert tone="danger" live>
              {t(`errors.${error}`)}
            </Alert>
          ) : null}

          {confirmingDelete ? (
            <>
              <p className="text-text-muted text-xs">{t("edit.keyLocked", { key: role.key })}</p>
              <ModalActions
                cancel={t("edit.cancel")}
                submit={pending ? t("delete.submitting") : t("delete.submit")}
                pending={pending}
                danger
                onCancel={() => setConfirmingDelete(false)}
                onSubmit={remove}
              />
            </>
          ) : (
            <>
              <form id={`edit-role-${role.id}`} action={submit} className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor={`er-name-${role.id}`}>
                    {t("create.name")}
                    <RequiredMark />
                  </FieldLabel>
                  <FieldHelp>{t("edit.keyLocked", { key: role.key })}</FieldHelp>
                  <Input
                    id={`er-name-${role.id}`}
                    name="name"
                    required
                    maxLength={128}
                    defaultValue={role.name}
                  />
                </Field>

                <ScopeField id={`er-scope-${role.id}`} defaultValue={role.scope} />
              </form>

              <div className="border-line-soft flex flex-col gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="quiet"
                  size="quiet"
                  disabled={!role.deletable}
                  onClick={() => setConfirmingDelete(true)}
                  className="text-danger hover:bg-danger-soft self-start"
                >
                  {t("delete.action")}
                </Button>
                {role.isSystem ? (
                  <FieldError>{t("delete.blockedSystem")}</FieldError>
                ) : role.userCount > 0 ? (
                  <FieldError>
                    {t("delete.blockedInUse", {
                      count: role.userCount,
                    })}
                  </FieldError>
                ) : null}
              </div>

              <ModalActions
                cancel={t("edit.cancel")}
                submit={pending ? t("edit.submitting") : t("edit.submit")}
                form={`edit-role-${role.id}`}
                pending={pending}
                onCancel={close}
              />
            </>
          )}
        </Modal>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function ScopeField({ id, defaultValue }: { id: string; defaultValue: Scope }) {
  const t = useTranslations("settings");

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("roles.create.scope")}</FieldLabel>
      <FieldHelp>{t("roles.create.scopeHelp")}</FieldHelp>
      <Select id={id} name="scope" defaultValue={defaultValue}>
        {SCOPES.map((scope) => (
          <option key={scope} value={scope}>
            {t(`scopes.${scope}`)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-accent-text">
      *
    </span>
  );
}

/**
 * The dialog's footer. Rendered inside the body rather than through the
 * `footer` slot because the delete confirmation swaps it, and two footers
 * that differ only in their handler are harder to read than one component
 * with two callers.
 */
function ModalActions({
  cancel,
  submit,
  form,
  pending,
  danger = false,
  onCancel,
  onSubmit,
}: {
  cancel: string;
  submit: string;
  form?: string;
  pending: boolean;
  danger?: boolean;
  onCancel: () => void;
  onSubmit?: () => void;
}) {
  return (
    <div className="border-line-soft mt-auto flex flex-wrap items-center justify-end gap-3 border-t pt-4">
      <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
        {cancel}
      </Button>
      <Button
        type={form ? "submit" : "button"}
        form={form}
        variant="primary"
        disabled={pending}
        onClick={onSubmit}
        className={
          danger ? "bg-danger border-danger hover:bg-danger hover:border-danger" : undefined
        }
      >
        {submit}
      </Button>
    </div>
  );
}
