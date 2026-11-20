import { t } from "../../i18n";
import { Icon } from "../../shared/ui/icon";
import { hasUnexpectedLetterScript } from "../../turkishText";

export type VoiceState = "idle" | "connecting" | "recording" | "transcribing" | "error";

/** Check button and microphone button under the answer. */
export function AnswerActions({ answer, loading, native, voiceState, voiceSupported, startVoice, finishVoice, stopVoice }: {
  answer: string; loading: boolean; native: boolean; voiceState: VoiceState; voiceSupported: boolean;
  startVoice: () => void; finishVoice: () => void; stopVoice: () => void;
}) {
  const busy = voiceState === "connecting" || voiceState === "recording" || voiceState === "transcribing";
  return <div className="answer-actions">
    {answer.trim() && <button className="answer-check-button" type="submit" form="practice-answer-form" aria-label={t(loading ? "Проверяем…" : native ? "Проверить" : "Проверить ответ")} disabled={loading || busy || hasUnexpectedLetterScript(answer)}><Icon name="tick" size={40} /></button>}
    <button className={`mic-button${busy ? " is-active" : ""}${answer.trim() && !busy ? " mic-button--retry" : ""}`} type="button"
      aria-label={t(busy ? voiceState === "recording" ? "Завершить запись" : "Остановить запись" : answer.trim() ? "Записать заново" : "Ответить голосом")}
      disabled={loading || !voiceSupported || voiceState === "transcribing"}
      onClick={busy ? voiceState === "recording" ? finishVoice : stopVoice : startVoice}>
      {answer.trim() && !busy && <span className="mic-retry-ring"><Icon name="retry" size={52} /></span>}
      <Icon name="mic" size={30} />
    </button>
  </div>;
}
