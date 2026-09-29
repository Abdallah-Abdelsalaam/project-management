"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input, InputGroup } from "@/components/ui/field";

/**
 * A password field with a reveal toggle — the eye button in the wireframe's
 * `.input-group`.
 *
 * The button is `type="button"`: inside a form, a button without one submits,
 * and a reveal control that submits the form is a bug that only shows up when
 * someone clicks it before finishing the password.
 *
 * `aria-pressed` carries the state, and the label changes with it, so a screen
 * reader user is told whether their password is currently on screen — which is
 * the only reason the control exists.
 */
export function PasswordInput({
  id,
  name,
  autoComplete = "current-password",
  required = true,
  invalid = false,
  describedBy,
  onValueChange,
}: {
  id?: string;
  name: string;
  autoComplete?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onValueChange?: (value: string) => void;
}) {
  const t = useTranslations("auth");
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [revealed, setRevealed] = useState(false);

  return (
    <InputGroup>
      <Input
        id={fieldId}
        name={name}
        type={revealed ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={onValueChange ? (event) => onValueChange(event.target.value) : undefined}
      />
      <button
        type="button"
        onClick={() => setRevealed((previous) => !previous)}
        aria-pressed={revealed}
        aria-controls={fieldId}
        aria-label={revealed ? t("password.hide") : t("password.show")}
        className="text-text-subtle hover:text-text rounded-control flex shrink-0 items-center transition-colors"
      >
        {revealed ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </InputGroup>
  );
}
