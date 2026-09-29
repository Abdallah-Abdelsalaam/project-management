import { getTranslations } from "next-intl/server";

/**
 * "مسار العمل في النظام" — the login screen's aside.
 *
 * A quiet restatement of what the product does: work leaves SEO and arrives at
 * two delivery teams. It uses the same components as the dashboard, so the
 * login screen teaches the visual language before you are inside.
 *
 * The counts (284 / 168 / 116) are the wireframe's reference organisation. They
 * are rendered as *sample* figures until the task tables exist (session 7), and
 * they live in the message files because they are part of the copy at this
 * point, not data — see docs/OPEN_QUESTIONS.md Q17.
 */

const DEPARTMENTS = [
  { id: "prog", tint: "bg-dept-prog", count: 168 },
  { id: "uiux", tint: "bg-dept-uiux", count: 116 },
] as const;

const LIFECYCLE = ["created", "assigned", "progress", "review", "approved"] as const;

const STATUS_TINT: Record<(typeof LIFECYCLE)[number], string> = {
  created: "bg-st-created/10 text-st-created",
  assigned: "bg-st-assigned/10 text-st-assigned",
  progress: "bg-st-progress/10 text-st-progress",
  review: "bg-st-review/10 text-st-review",
  approved: "bg-st-approved/10 text-st-approved",
};

export async function WorkflowAside({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "auth.workflow" });
  const formatCount = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en").format;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-text-muted text-xs">{t("body")}</p>
      </div>

      <div className="grid gap-3">
        <FlowNode
          tint="bg-dept-seo"
          initial={t("seo.initial")}
          name={t("seo.name")}
          meta={t("seo.meta")}
          count={formatCount(284)}
        />

        {/* The branch rail: one vertical line with a stub to each child, drawn
            with logical properties so it flips whole under LTR. */}
        <div className="border-line ms-6 grid gap-3 border-s ps-5">
          {DEPARTMENTS.map((department) => (
            <div key={department.id} className="relative">
              <span aria-hidden="true" className="bg-line absolute -start-5 top-1/2 h-px w-5" />
              <FlowNode
                tint={department.tint}
                initial={t(`${department.id}.initial`)}
                name={t(`${department.id}.name`)}
                meta={t(`${department.id}.meta`)}
                count={formatCount(department.count)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-line flex flex-col gap-2 border-t pt-5">
        <p className="text-text-subtle text-2xs">{t("lifecycle")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {LIFECYCLE.map((status) => (
            <span
              key={status}
              className={`rounded-pill text-2xs inline-flex items-center px-2 py-[3px] font-medium ${STATUS_TINT[status]}`}
            >
              {t(`status.${status}`)}
            </span>
          ))}
        </div>
        <p className="text-text-subtle text-3xs mt-2">{t("rejectionPath")}</p>
      </div>
    </div>
  );
}

function FlowNode({
  tint,
  initial,
  name,
  meta,
  count,
}: {
  tint: string;
  initial: string;
  name: string;
  meta: string;
  count: string;
}) {
  return (
    <div className="bg-surface-alt border-line rounded-data flex items-center gap-3 border border-s-[3px] px-4 py-3">
      <span
        aria-hidden="true"
        className={`rounded-pill text-3xs grid size-[22px] shrink-0 place-content-center font-semibold text-white ${tint}`}
      >
        {initial}
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-xs font-medium">{name}</span>
        <span className="text-text-subtle text-3xs truncate">{meta}</span>
      </div>
      <span className="text-text-subtle text-2xs ms-auto tabular-nums">{count}</span>
    </div>
  );
}
