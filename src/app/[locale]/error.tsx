"use client";

import { useTranslations } from "next-intl";

export default function LocaleError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errors");

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">{t("errorTitle")}</h1>
        <p className="text-text-muted mt-2 text-sm">{t("errorBody")}</p>
        <button
          type="button"
          onClick={reset}
          className="bg-accent text-text-invert rounded-control mt-5 px-4 py-2 text-sm font-semibold"
        >
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
