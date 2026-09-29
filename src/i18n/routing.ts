import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { defineRouting } from "next-intl/routing";

/**
 * Arabic is the product language (the wireframe is Arabic-only and RTL).
 * English exists so the direction switch is structural rather than a later
 * retrofit — see docs/OPEN_QUESTIONS.md Q2 before shipping a visible switcher.
 */
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

/**
 * Narrows the `locale` route param to a known locale.
 *
 * Next generates its route types with `params: { locale: string }`, so a page
 * cannot simply declare the union it wants. Validating here rather than casting
 * means an unknown prefix becomes a 404 instead of a page rendered with
 * undefined messages.
 */
export function assertLocale(value: string): Locale {
  if (!hasLocale(routing.locales, value)) notFound();
  return value;
}
