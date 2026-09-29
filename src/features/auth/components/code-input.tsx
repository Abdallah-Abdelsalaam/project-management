"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { normaliseDigits, parsePastedCode } from "@/features/auth/challenge";
import { cn } from "@/lib/utils";

/**
 * The six-digit code input — `.code-input` in the wireframe.
 *
 * Six boxes, forced LTR because a numeric code is read left to right even in an
 * Arabic interface, with tabular figures so the digits do not shift width as
 * they are typed.
 *
 * Four behaviours the screen promises, each of which is a real failure mode if
 * missed:
 *
 *   **Auto-advance.** Typing a digit moves to the next box. Without it the user
 *   types six digits into the first box and sees one.
 *
 *   **Paste into any box.** "يمكنك لصق الرمز كاملًا في أول خانة" — the code
 *   arrives from an email as a whole, and splitting it by hand is the worst
 *   part of every 2FA screen that gets this wrong. The paste is cleaned by
 *   `parsePastedCode`, which strips the surrounding prose and maps Arabic-Indic
 *   digits onto ASCII.
 *
 *   **Backspace goes back.** Backspace in an empty box clears and focuses the
 *   previous one, so correcting a mistake does not mean clicking.
 *
 *   **The value reaches the server as one field.** A hidden input holds the
 *   joined code, so the form posts `code=123456` and the action does not have
 *   to reassemble six fields — and the form still submits without JavaScript if
 *   the user types into the boxes.
 */
export function CodeInput({
  name,
  length,
  invalid = false,
  describedBy,
}: {
  name: string;
  length: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("auth.code");
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length }, () => ""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function focusBox(index: number) {
    refs.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  }

  function write(next: string[]) {
    setDigits(next);
  }

  function handleChange(index: number, raw: string) {
    // A soft keyboard can deliver more than one character per event, and an
    // autofilled one-time code arrives as the whole string — so treat any
    // multi-character input as a paste rather than dropping the extra digits.
    const cleaned = normaliseDigits(raw).replace(/\D/g, "");

    if (cleaned.length > 1) {
      fill(cleaned, index);
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    write(next);
    if (cleaned) focusBox(index + 1);
  }

  function fill(code: string, from = 0) {
    const next = [...digits];
    for (let offset = 0; offset < code.length && from + offset < length; offset += 1) {
      next[from + offset] = code[offset];
    }
    write(next);
    focusBox(Math.min(from + code.length, length - 1));
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index]) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      write(next);
      focusBox(index - 1);
      return;
    }

    // The boxes are visually LTR inside an RTL page, so the arrow keys follow
    // what the user sees rather than the document direction.
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  }

  function handlePaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const code = parsePastedCode(event.clipboardData.getData("text"));
    if (!code) return;
    event.preventDefault();
    fill(code, code.length >= length ? 0 : index);
  }

  return (
    <>
      <input type="hidden" name={name} value={digits.join("")} />
      <div dir="ltr" className="flex gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            id={index === 0 ? `${name}-1` : undefined}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={t("digit", { position: index + 1 })}
            aria-invalid={invalid || undefined}
            aria-describedby={index === 0 ? describedBy : undefined}
            data-filled={digit ? "true" : undefined}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onFocus={(event) => event.target.select()}
            className={cn(
              "border-line-strong bg-surface text-text rounded-control h-14 w-12 border text-center text-2xl font-semibold tabular-nums",
              "duration-fast transition-[border-color,box-shadow]",
              "focus:border-accent focus:outline-none",
              "data-[filled=true]:border-accent-line data-[filled=true]:bg-accent-soft",
              "max-[420px]:h-12 max-[420px]:w-10 max-[420px]:text-xl",
              invalid && "border-danger",
            )}
          />
        ))}
      </div>
    </>
  );
}
