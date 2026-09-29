"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, FieldLabel, Input } from "@/components/ui/field";
import { requestResetAction, type ForgotState } from "@/features/auth/actions";

/**
 * Request a reset link.
 *
 * The confirmation is identical whether or not the address exists — the screen
 * says as much out loud: "لا نكشف ما إذا كان البريد مسجّلًا في النظام أو لا".
 * That is why there is no error state here beyond a malformed address: the
 * action has only one success, and it is unconditional.
 *
 * The form is replaced by the confirmation rather than sitting beneath it, so a
 * user cannot mistake a delivered link for a failed one and send five more.
 */
export function ForgotPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState<ForgotState, FormData>(requestResetAction, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <Alert tone="success" live title={t("forgot.sent.title")}>
        {t("forgot.sent.body")}
      </Alert>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      {state.status === "invalidInput" ? (
        <Alert tone="danger" live title={t("forgot.invalid.title")}>
          {t("forgot.invalid.body")}
        </Alert>
      ) : null}

      {state.status === "unavailable" ? (
        <Alert tone="danger" live title={t("unavailable.title")}>
          {t("unavailable.body")}
        </Alert>
      ) : null}

      <Field>
        <FieldLabel htmlFor="email">{t("fields.email")}</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="name@nuwa.sa"
          required
          dir="ltr"
        />
      </Field>

      <SubmitButton label={t("forgot.submit")} pendingLabel={t("forgot.submitting")} />
    </form>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="primary" size="lg" block disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
