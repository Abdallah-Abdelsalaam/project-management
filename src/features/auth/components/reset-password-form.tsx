"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Alert, Checklist, type ChecklistState } from "@/components/ui/feedback";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { resetPasswordAction, type ResetState } from "@/features/auth/actions";
import {
  CLIENT_PASSWORD_RULES,
  checkClientPasswordRules,
  PASSWORD_RULES,
} from "@/features/auth/password-policy";
import { PasswordInput } from "./password-input";

/**
 * Choose a new password.
 *
 * The requirement list is the point of this screen. The wireframe's own comment
 * says why: requirements are listed up front and each reports its own state,
 * "rather than a single strength bar that says 'weak' without saying why".
 *
 * Each row has three states, not two. Before anything is typed a rule is
 * `pending`, not failing — showing five red crosses to someone who has not
 * started is a scolding, not feedback. And `notReused` stays `pending` until the
 * server answers, because the browser cannot know your last five passwords.
 */
export function ResetPasswordForm({
  locale,
  token,
  minLength,
  historyDepth,
}: {
  locale: string;
  token: string;
  minLength: number;
  historyDepth: number;
}) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState<ResetState, FormData>(resetPasswordAction, {
    status: "idle",
  });

  const [password, setPassword] = useState("");
  const touched = password.length > 0;
  const live = checkClientPasswordRules(password);

  const serverRejected = state.status === "policy" ? state.rules : [];
  const reused = state.status === "reused";

  // The two rules that quote a number take it from the policy, so the
  // checklist cannot claim a limit the server does not enforce.
  const counts: Partial<Record<(typeof PASSWORD_RULES)[number], number>> = {
    minLength,
    notReused: historyDepth,
  };

  const items = PASSWORD_RULES.map((rule) => ({
    id: rule,
    label: t(`password.rule.${rule}`, { count: counts[rule] ?? 0 }),
    state: ruleState(rule),
  }));

  function ruleState(rule: (typeof PASSWORD_RULES)[number]): ChecklistState {
    if (rule === "notReused") {
      if (reused) return "fail";
      // Only the server can answer this one; it is never claimed as a pass
      // from the client. See docs/OPEN_QUESTIONS.md Q16.
      return "pending";
    }

    const clientRule = rule as (typeof CLIENT_PASSWORD_RULES)[number];
    if (serverRejected.includes(clientRule)) return "fail";
    if (!touched) return "pending";
    return live[clientRule] ? "pass" : "fail";
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />

      {state.status === "invalidToken" ? (
        <Alert tone="danger" live title={t("reset.invalidToken.title")}>
          {t("reset.invalidToken.body")}
        </Alert>
      ) : null}

      {reused ? (
        <Alert tone="warning" live title={t("reset.reused.title")}>
          {t("reset.reused.body")}
        </Alert>
      ) : null}

      {state.status === "unavailable" ? (
        <Alert tone="danger" live title={t("unavailable.title")}>
          {t("unavailable.body")}
        </Alert>
      ) : null}

      <Field>
        <FieldLabel htmlFor="password">{t("reset.newPassword")}</FieldLabel>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          invalid={state.status === "policy"}
          describedBy="password-rules"
          onValueChange={setPassword}
        />
        <Checklist id="password-rules" items={items} className="mt-2" />
      </Field>

      <Field>
        <FieldLabel htmlFor="confirm">{t("reset.confirm")}</FieldLabel>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          invalid={state.status === "mismatch"}
          describedBy={state.status === "mismatch" ? "confirm-error" : undefined}
        />
        {state.status === "mismatch" ? (
          <FieldError id="confirm-error">{t("reset.mismatch")}</FieldError>
        ) : null}
      </Field>

      <SubmitButton label={t("reset.submit")} pendingLabel={t("reset.submitting")} />
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
