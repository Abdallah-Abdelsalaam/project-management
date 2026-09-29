import { getTranslations } from "next-intl/server";

/**
 * Every route in the shell renders this until its session builds it. It
 * carries the wireframe reference and the roadmap session, so an unbuilt page
 * is self-documenting rather than a blank rectangle.
 */
export async function PagePlaceholder({
  titleKey,
  subKey,
  wireframe,
  session,
}: {
  titleKey: string;
  subKey: string;
  /** Path of the source screen inside wireframe/. */
  wireframe: string;
  /** Roadmap session number that builds this page. */
  session: number;
}) {
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{t(titleKey)}</h1>
          <p className="text-text-muted mt-1 max-w-2xl text-sm">{t(subKey)}</p>
        </div>
        <span className="border-line bg-surface-sunk text-text-muted rounded-pill text-3xs border px-2.5 py-1 font-semibold">
          {t("placeholder.badge")}
        </span>
      </div>

      <section className="border-line bg-surface rounded-panel border p-5">
        <p className="text-text-muted text-sm">{t("placeholder.body", { session })}</p>
        <p className="text-text-subtle text-2xs mt-2 font-mono">
          {t("placeholder.wireframe", { file: wireframe })}
        </p>
      </section>
    </div>
  );
}
