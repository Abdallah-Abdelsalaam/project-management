"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, FieldHelp, FieldLabel } from "@/components/ui/field";
import {
  resendCodeAction,
  verifyCodeAction,
  type ResendState,
  type VerifyState,
} from "@/features/auth/actions";
import { CodeInput } from "./code-input";

/**
 * The second-factor form.
 *
 * Four refusals, four states, four messages — a user whose code has aged out
 * needs to press resend, and one whose attempts are spent needs a new code
 * altogether. Collapsing them into "wrong code" would send both back to
 * re-reading digits that were never the problem.
 *
 * `challengeExpired` is the fifth, and the only one that is not about the code:
 * the half-authenticated session itself has gone, so the only way forward is
 * back to `/login`.
 */
export function TwoFactorForm({
  locale,
  codeLength,
  trustByDefault,
  next,
  initialCooldown,
  resendWaitSeconds,
  trustDays,
  maxAttempts,
  lockMinutes,
}: {
  locale: string;
  codeLength: number;
  trustByDefault: boolean;
  next?: string;
  initialCooldown: number;
  resendWaitSeconds: number;
  trustDays: number;
  maxAttempts: number;
  lockMinutes: number;
}) {
  const t = useTranslations("auth");

  const [state, formAction] = useActionState<VerifyState, FormData>(verifyCodeAction, {
    status: "idle",
  });
  const [resend, resendAction] = useActionState<ResendState, FormData>(resendCodeAction, {
    status: "idle",
  });

  const cooldown = useCountdown(initialCooldown, resend, resendWaitSeconds);

  const codeRejected =
    state.status === "invalidCode" ||
    state.status === "expiredCode" ||
    state.status === "attemptsExhausted";

  return (
    <div className="flex flex-col gap-5">
      {state.status === "invalidCode" ? (
        <Alert tone="danger" live title={t("code.invalid.title")}>
          {t("code.invalid.body")}
        </Alert>
      ) : null}

      {state.status === "expiredCode" ? (
        <Alert tone="warning" live title={t("code.expired.title")}>
          {t("code.expired.body")}
        </Alert>
      ) : null}

      {state.status === "attemptsExhausted" ? (
        <Alert tone="warning" live title={t("code.exhausted.title")}>
          {t("code.exhausted.body")}
        </Alert>
      ) : null}

      {state.status === "locked" ? (
        <Alert tone="danger" live title={t("code.locked.title")}>
          {t("code.locked.body")}
        </Alert>
      ) : null}

      {state.status === "challengeExpired" ? (
        <Alert tone="danger" live title={t("code.challengeExpired.title")}>
          {t("code.challengeExpired.body")}
        </Alert>
      ) : null}

      {state.status === "unavailable" ? (
        <Alert tone="danger" live title={t("unavailable.title")}>
          {t("unavailable.body")}
        </Alert>
      ) : null}

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="locale" value={locale} />
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <Field>
          <FieldLabel htmlFor="code-1">{t("code.label")}</FieldLabel>
          <CodeInput
            name="code"
            length={codeLength}
            invalid={codeRejected}
            describedBy="code-help"
          />
          <FieldHelp id="code-help">{t("code.pasteHint")}</FieldHelp>
        </Field>

        <Checkbox
          name="trustDevice"
          defaultChecked={trustByDefault}
          label={t("trust.labelDays", { days: trustDays })}
          hint={t("trust.hintShort")}
        />

        <SubmitButton label={t("code.submit")} pendingLabel={t("code.submitting")} />
      </form>

      <div className="border-line flex flex-col gap-3 border-t pt-5">
        <form action={resendAction} className="flex items-center justify-between gap-3">
          <input type="hidden" name="locale" value={locale} />
          <span className="text-text-muted text-xs">{t("code.noCode")}</span>
          <Button type="submit" variant="quiet" size="quiet" disabled={cooldown > 0}>
            {cooldown > 0 ? t("code.resendIn", { seconds: cooldown }) : t("code.resend")}
          </Button>
        </form>

        {resend.status === "sent" ? (
          <p role="status" className="text-success text-2xs">
            {t("code.resent")}
          </p>
        ) : null}

        <p className="text-text-subtle text-3xs">
          {t("code.policyNote", {
            seconds: resendWaitSeconds,
            attempts: maxAttempts,
            minutes: lockMinutes,
          })}
        </p>
      </div>
    </div>
  );
}

/**
 * The resend countdown.
 *
 * Derived, not synchronised. The only state that changes on a timer is `now`;
 * the deadline comes from whichever anchor is current — the server's
 * `initialCooldown` on first paint, or the `sentAt` of the most recent resend.
 * Deriving it this way avoids a `setState` inside an effect body and, more
 * usefully, means the display cannot drift out of step with the anchor.
 *
 * Seeding from the server matters: a cooldown that started at zero and then
 * jumped to the full wait would let an impatient user click straight into a
 * refusal.
 *
 * The result is clamped to the configured wait, so a browser clock running
 * behind the server's cannot show a countdown longer than the policy allows.
 * The client's clock is only ever advisory — the server rejects an early resend
 * whatever this shows.
 */
function useCountdown(initialSeconds: number, resend: ResendState, waitSeconds: number) {
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(mountedAt);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const deadline =
    resend.status === "sent"
      ? resend.sentAt + waitSeconds * 1000
      : mountedAt + initialSeconds * 1000;

  const remaining = Math.ceil((deadline - now) / 1000);
  return Math.min(waitSeconds, Math.max(0, remaining));
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="primary" size="lg" block disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
