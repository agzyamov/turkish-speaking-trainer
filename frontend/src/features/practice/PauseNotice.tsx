import { t } from "../../i18n";
import type { BudgetPause } from "../../budgetPause";

/** Calm, informational state when AI checking is paused by the budget (Q-7, principle "honest limits"). */
export function PauseNotice({ pause, resumeLabel, diagnosticId }: { pause: BudgetPause; resumeLabel?: string; diagnosticId?: string }) {
  const daily = pause === "daily";
  return <section role="alert" data-slot="pause-notice" className="grid gap-2 rounded-card border border-info/40 bg-info/10 p-4 text-ink">
    <h3 className="m-0 text-base font-semibold">{t(daily ? "practice.pause.dailyTitle" : "practice.pause.monthlyTitle")}</h3>
    <p className="m-0 text-sm leading-normal text-ink-soft">
      {daily ? (resumeLabel ? t("practice.pause.resumesAt", { time: t(resumeLabel) }) : t("practice.pause.tomorrow")) : t("practice.pause.monthlyReason")}
      {" "}{t("practice.pause.exactAnswers")}
    </p>
    {diagnosticId && <details className="text-caption text-ink-muted">
      <summary className="inline-flex cursor-pointer select-none list-none items-center gap-1 [&::-webkit-details-marker]:hidden [[open]>&>svg]:rotate-90">
        <svg className="size-3 transition-transform duration-(--duration-quick)" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {t("practice.pause.details")}
      </summary>
      <span>{t("common.diagnosticCode")}: {diagnosticId}</span>
    </details>}
  </section>;
}
