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
