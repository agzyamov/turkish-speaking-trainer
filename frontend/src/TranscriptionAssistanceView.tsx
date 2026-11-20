import { t } from "./i18n";
import type { TranscriptionResponse } from "./types/training";

export type AssistanceDraft = { response: TranscriptionResponse; selected: number[]; edited: boolean };

export function TranscriptionAssistanceView({ draft, disabled, onToggle }: {
  draft?: AssistanceDraft; disabled: boolean; onToggle: (index: number) => void;
}) {
  if (!draft) return null;
  const changes = draft.response.changes ?? [];
  if ((draft.edited || !changes.length) && draft.response.assistance_status !== "unavailable") return null;
  return <section className="transcription-assistance" aria-label={t("Мягкие подсказки")}>
    {draft.response.assistance_status === "unavailable" && <p role="status">{t("Мягкие подсказки временно недоступны. Показана исходная расшифровка; можно проверить ответ или повторить запись.")}</p>}
    {!draft.edited && changes.length > 0 && <p>{t("Возможное искажение распознавания.")}</p>}
    {!draft.edited && changes.map((change, index) => <div className="transcription-assistance__change" key={index}>
      <div className="transcription-assistance__copy"><span>{change.original} → {change.replacement}</span>
      </div>
      <button type="button" disabled={disabled} onClick={() => onToggle(index)}>
        {t(draft.selected.includes(index) ? "Отменить" : "Принять подсказку")}
      </button>
    </div>)}
  </section>;
}
