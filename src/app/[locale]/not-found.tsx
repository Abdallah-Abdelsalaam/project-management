import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">{t("notFoundTitle")}</h1>
        <p className="text-text-muted mt-2 text-sm">{t("notFoundBody")}</p>
        <Link
          href="/dashboard"
          className="bg-accent text-text-invert rounded-control mt-5 inline-block px-4 py-2 text-sm font-semibold"
        >
          {t("backToDashboard")}
        </Link>
      </div>
    </div>
  );
}
