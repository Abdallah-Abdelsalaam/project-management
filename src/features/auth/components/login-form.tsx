"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, FieldLabel, Input } from "@/components/ui/field";
import { signInAction, type SignInState } from "@/features/auth/actions";
import { PasswordInput } from "./password-input";

/**
 * The sign-in form.
 *
 * A Server Action rather than a fetch: the form works before hydration, and
 * the only client state is the reveal toggle and the pending flag. The
 * `useActionState` result is a *state key*, never a message — the strings live
 * in `messages/{ar,en}.json` and are chosen here.
 *
 * Note what is **not** branched on: whether the address exists. Every
 * credential failure renders the same alert, which is the whole reason the
 * action collapses them into one state.
 */
export function LoginForm({
  locale,
  trustDays,
  next,
  justReset,
}: {
  locale: string;
  /** From `twoFactorPolicy()`, passed in rather than imported: the policy is a
   *  stored setting from session 20 and must stay a server concern. */
  trustDays: number;
  next?: string;
  justReset?: boolean;
}) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState<SignInState, FormData>(signInAction, {
    status: "idle",
  });

  const failed = state.status === "invalidCredentials" || state.status === "locked";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {justReset ? (
        <Alert tone="success" title={t("login.resetDone.title")}>
          {t("login.resetDone.body")}
        </Alert>
      ) : null}

      {state.status === "invalidCredentials" ? (
        <Alert tone="danger" live title={t("login.invalid.title")}>
          {t("login.invalid.body")}
        </Alert>
      ) : null}

      {state.status === "locked" ? (
        <Alert tone="warning" live title={t("login.locked.title")}>
          {t("login.locked.body", { minutes: state.minutesRemaining })}
        </Alert>
      ) : null}

      {state.status === "unavailable" ? (
        <Alert tone="danger" live title={t("unavailable.title")}>
          {t("unavailable.body")}
        </Alert>
      ) : null}

      <Field>
        <FieldLabel htmlFor="email">{t("fields.email")}</FieldLabel>
        {/* dir="ltr" on the input alone: an address is Latin text inside an
            Arabic page, and typing it right-to-left puts the @ in the wrong
            place. */}
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="name@nuwa.sa"
          required
          dir="ltr"
          aria-invalid={failed || undefined}
        />
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor="password">{t("fields.password")}</FieldLabel>
          <Link href="/forgot-password" className="text-accent-text text-2xs hover:underline">
            {t("login.forgot")}
          </Link>
        </div>
        <PasswordInput id="password" name="password" invalid={failed} />
      </Field>

      <Checkbox
        name="trustDevice"
        label={t("trust.label")}
        hint={t("trust.hint", { days: trustDays })}
      />

      <SubmitButton label={t("login.submit")} pendingLabel={t("login.submitting")} />
    </form>
  );
}

/**
 * Split out because `useFormStatus` only reports the status of the form it is
 * rendered *inside*. Reading it in `LoginForm` would always return idle.
 */
function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="primary" size="lg" block disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
