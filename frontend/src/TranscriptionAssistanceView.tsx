import { t } from "./i18n";
import type { TranscriptionResponse } from "./types/training";

export type AssistanceDraft = { response: TranscriptionResponse; selected: number[]; edited: boolean };

export function TranscriptionAssistanceView({ draft, disabled, onToggle }: { draft?: AssistanceDraft; disabled: boolean; onToggle: (index: number) => void }) {
  if (!draft) return null;
  const changes = draft.response.changes ?? [];
  if ((draft.edited || !changes.length) && draft.response.assistance_status !== "unavailable") return null;
  return (
    <section className="transcription-assistance grid gap-2 rounded-control border border-info/35 bg-info/8 p-3 text-sm text-ink-soft" aria-label={t("practice.assistance.title")}>
      {draft.response.assistance_status === "unavailable" && (
        <p className="m-0" role="status">
          {t("practice.assistance.unavailable")}
        </p>
      )}
      {!draft.edited && changes.length > 0 && <p className="m-0">{t("practice.assistance.possibleError")}</p>}
      {!draft.edited &&
        changes.map((change, index) => (
          <div className="transcription-assistance__change flex items-center justify-between gap-3" key={index}>
            <div className="transcription-assistance__copy text-base text-ink" lang="tr">
              <span className="whitespace-nowrap">
                {change.original} → {change.replacement}
              </span>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToggle(index)}
              className="min-h-11 shrink-0 cursor-pointer rounded-control border border-line bg-surface-raised px-3 text-sm font-semibold text-ink hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-default disabled:opacity-55"
            >
              {t(draft.selected.includes(index) ? "practice.assistance.undo" : "practice.assistance.fix")}
            </button>
          </div>
        ))}
    </section>
  );
}
