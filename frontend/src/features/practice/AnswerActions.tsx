import { t } from "../../i18n";
import { cn } from "../../shared/lib/utils";
import { Icon } from "../../shared/ui/icon";
import { hasUnexpectedLetterScript } from "../../turkishText";

export type VoiceState = "idle" | "connecting" | "recording" | "transcribing" | "error";

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * Before an answer: one large microphone. With an answer: a labelled primary
 * "check" and a secondary "record again", so the two can no longer be confused.
 */
export function AnswerActions({ answer, loading, native, voiceState, voiceSupported, startVoice, finishVoice, stopVoice }: {
  answer: string; loading: boolean; native: boolean; voiceState: VoiceState; voiceSupported: boolean;
  startVoice: () => void; finishVoice: () => void; stopVoice: () => void;
}) {
  const busy = voiceState === "connecting" || voiceState === "recording" || voiceState === "transcribing";
  const hasAnswer = Boolean(answer.trim());
  const micLabel = t(busy ? voiceState === "recording" ? "Завершить запись" : "Остановить запись" : hasAnswer ? "Записать заново" : "Ответить голосом");
  const onMic = busy ? voiceState === "recording" ? finishVoice : stopVoice : startVoice;
  const micDisabled = loading || !voiceSupported || voiceState === "transcribing";

  if (hasAnswer) {
    // While re-recording over an existing answer, check stays visible and disabled; the
    // secondary button becomes "finish recording" so the draft is never lost.
    const checkLabel = t(loading ? "Проверяем…" : native ? "Проверить" : "Проверить ответ");
    const recordingOver = voiceState === "recording";
    return <div className="answer-actions flex w-full items-stretch gap-3">
      <button key="check" className={cn("answer-check-button inline-flex min-h-13 flex-1 cursor-pointer items-center justify-center gap-2 rounded-control border-0 bg-accent px-5 text-base font-semibold text-accent-ink shadow-lift transition-colors duration-(--duration-quick) hover:bg-accent-bright disabled:cursor-default disabled:opacity-55", focusRing)}
        type="submit" form="practice-answer-form" aria-label={checkLabel} disabled={loading || busy || hasUnexpectedLetterScript(answer)}>
        <Icon name="tick" size={22} /><span>{t(loading ? "Проверяем…" : "Проверить")}</span>
      </button>
      <button key="retry" className={cn("mic-button mic-button--retry inline-flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-control border px-4 text-sm font-semibold transition-colors duration-(--duration-quick) disabled:cursor-not-allowed disabled:opacity-55",
        busy ? "is-active border-danger bg-danger/15 text-ink" : "border-line bg-surface-raised text-ink-soft hover:border-line-strong hover:text-ink", focusRing)}
        type="button" aria-label={micLabel} disabled={micDisabled} onClick={onMic}>
        {busy ? <Icon name="mic" size={20} /> : <span className="mic-retry-ring inline-flex"><Icon name="retry" size={20} /></span>}
        {/* The visible word is part of the accessible name (WCAG 2.5.3 label in name). */}
        <span>{t(recordingOver ? "Завершить" : busy ? "Остановить" : "Заново")}</span>
      </button>
    </div>;
  }

  const recording = voiceState === "recording";
  return <div className="answer-actions grid place-items-center">
    <button key="mic" className={cn("mic-button relative grid size-18 cursor-pointer place-items-center rounded-full border-0 shadow-lift transition-[background-color,transform] duration-(--duration-quick) active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
      recording ? "is-active bg-danger text-accent-ink" : busy ? "is-active bg-surface-raised text-ink" : "bg-accent text-accent-ink hover:bg-accent-bright", focusRing)}
      type="button" aria-label={micLabel} disabled={micDisabled} onClick={onMic}>
      {recording && <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-danger motion-safe:animate-ping" aria-hidden="true" />}
      <Icon name="mic" size={30} />
    </button>
  </div>;
}
