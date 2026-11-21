import type { FormEvent, ReactNode } from "react";
import { t } from "../../i18n";
import type { Attempt } from "../../types/training";
import { Icon } from "../../shared/ui/icon";
import { cn } from "../../shared/lib/utils";
import { RewardOverlay } from "../../RewardOverlay";
import type { Reward } from "../../useRewards";
import { TranscriptionAssistanceView, type AssistanceDraft } from "../../TranscriptionAssistanceView";
import { hasUnexpectedLetterScript } from "../../turkishText";
import { budgetPauseMessages, type BudgetPause } from "../../budgetPause";
import { AnswerActions, type VoiceState } from "./AnswerActions";
import { ExerciseFeedback } from "./ExerciseFeedback";
import { PauseNotice } from "./PauseNotice";
import { TeaGlass } from "./TeaGlass";

const transcriptionBreakMessage = "practice.transcriptionBreak";

function voiceStatus(voiceState: VoiceState, voiceSupported: boolean, hasTranscript: boolean): string {
  if (!voiceSupported) return "practice.voice.unavailable";
  if (voiceState === "connecting") return "practice.voice.connecting";
  if (voiceState === "recording") return "practice.voice.recording";
  if (voiceState === "transcribing") return "practice.voice.transcribing";
  if (voiceState === "error") return "practice.voice.failed";
  return hasTranscript ? "practice.voice.editTranscript" : "practice.voice.tapMic";
}

function pauseOf(error?: string): BudgetPause | undefined {
  return (Object.entries(budgetPauseMessages) as [BudgetPause, string][]).find(([, message]) => message === error)?.[0];
}

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const primaryButton =
  "inline-flex min-h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-control border-0 bg-accent px-5 text-base font-semibold text-accent-ink shadow-lift transition-colors duration-(--duration-quick) hover:bg-accent-bright disabled:cursor-default disabled:opacity-55";

/** One exercise: phrase, answer (voice or typed), check, then the result and the next-phrase button. */
export function PracticeCard(props: {
  compact: boolean;
  native: boolean;
  phrase: ReactNode;
  hasHints: boolean;
  source?: string;
  topicTitle: ReactNode;
  progress?: { completed: number; total: number };
  attempt?: Attempt;
  answer: string;
  onAnswerEdit: (text: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  checking: boolean;
  hasTranscript: boolean;
  voiceState: VoiceState;
  voiceSupported: boolean;
  voiceBusy: boolean;
  assistanceDraft?: AssistanceDraft;
  onToggleAssistance: (index: number) => void;
  transcriptionBreakRecommended: boolean;
  onEnterManually: () => void;
  onStartVoice: () => void;
  onFinishVoice: () => void;
  onStopVoice: () => void;
  error?: string;
  errorDiagnosticId?: string;
  pauseResumeLabel?: string;
  reward?: Reward;
  advancing: boolean;
  done: boolean;
  onNext: () => void;
}) {
  const { compact, attempt, answer, checking, hasTranscript, voiceState, voiceSupported } = props;
  const answerId = compact ? "android-answer" : "practice-answer";
  const pause = pauseOf(props.error);
  return (
    <div
      className={cn(
        "practice-card exercise-layout relative flex min-h-0 flex-col bg-surface text-ink",
        // Desktop: bounded to the viewport so the controls stay on screen and the content scrolls.
        compact ? "android-training-content h-full" : "h-[calc(100dvh-6.5rem)] min-h-[32rem] rounded-card border border-line",
      )}
    >
      {/* "start" shows its message in the free space above the controls; "perfect" is drawn on the score row itself. */}
      <RewardOverlay reward={props.reward?.kind === "start" ? props.reward : undefined} />
      <div className="exercise-scroll grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-5 pb-4 pt-4 sm:px-8 sm:pt-6">
        <div className="flex items-center justify-between gap-3 text-sm text-ink-muted">
          <span className="exercise-topic min-w-0 truncate">{props.topicTitle}</span>
          {props.progress && (
            <span className="inline-flex shrink-0 items-center" role="img" aria-label={t("practice.progress", { completed: props.progress.completed, count: props.progress.total })}>
              <TeaGlass completed={props.progress.completed} total={props.progress.total} />
            </span>
          )}
        </div>
        {!attempt && (
          <div className="exercise-source grid gap-2">
            {props.phrase}
            {props.hasHints && !hasTranscript && <p className="m-0 text-caption text-ink-muted">{t("practice.hintLegend")}</p>}
          </div>
        )}
        {!attempt ? (
          <form id="practice-answer-form" className="exercise-answer grid gap-4" onSubmit={props.onSubmit}>
            {hasTranscript && (
              <div className="exercise-answer-frame grid gap-2">
                <label htmlFor={answerId} className="text-caption font-semibold text-ink-muted">
                  {t("practice.answer.label")}
                </label>
                <textarea
                  id={answerId}
                  lang="tr"
                  value={answer}
                  readOnly={checking}
                  onChange={event => props.onAnswerEdit(event.target.value)}
                  placeholder={t("practice.answer.placeholder")}
                  rows={3}
                  className={cn(
                    "w-full resize-none rounded-control border border-line bg-surface-raised p-4 text-answer text-ink caret-accent placeholder:text-ink-muted read-only:opacity-80 focus:border-line-strong",
                    focusRing,
                  )}
                />
              </div>
            )}
            {hasUnexpectedLetterScript(answer) && (
              <p className="transcription-script-warning m-0 text-sm text-danger" role="alert">
                {t("practice.answer.foreignLetters")}
              </p>
            )}
            {props.transcriptionBreakRecommended && (
              <p className="transcription-script-warning m-0 text-sm text-danger" role="alert">
                {t(transcriptionBreakMessage)}
              </p>
            )}
            {!pause && <TranscriptionAssistanceView draft={props.assistanceDraft} disabled={checking || props.voiceBusy} onToggle={props.onToggleAssistance} />}
            {!hasTranscript && (voiceState === "error" || !voiceSupported) && (
              <button
                type="button"
                onClick={props.onEnterManually}
                className={cn(
                  "justify-self-start cursor-pointer rounded-control border border-line bg-surface-raised px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-line-strong hover:text-ink",
                  focusRing,
                )}
              >
                {t("practice.answer.typeManually")}
              </button>
            )}
          </form>
        ) : (
          <ExerciseFeedback attempt={attempt} native={compact} source={props.source} celebrate={props.reward?.kind === "perfect"} />
        )}
        {pause ? (
          <PauseNotice pause={pause} resumeLabel={props.pauseResumeLabel} diagnosticId={props.errorDiagnosticId} />
        ) : (
          props.error && (
            <p className="error m-0 text-sm text-danger" role="alert">
              {t(props.error)}
              {props.errorDiagnosticId && (
                <>
                  {" "}
                  <span className="text-ink-muted">
                    {t("common.diagnosticCode")}: {props.errorDiagnosticId}
                  </span>
                </>
              )}
            </p>
          )
        )}
      </div>
      <div className="exercise-controls grid justify-items-center gap-3 px-5 pb-5 pt-2 sm:px-8 sm:pb-7">
        {!attempt ? (
          <>
            <AnswerActions
              answer={answer}
              loading={checking}
              native={props.native}
              voiceState={voiceState}
              voiceSupported={voiceSupported}
              startVoice={props.onStartVoice}
              finishVoice={props.onFinishVoice}
              stopVoice={props.onStopVoice}
            />
            <div className="exercise-voice-status text-center text-sm text-ink-muted" role="status">
              {t(voiceStatus(voiceState, voiceSupported, hasTranscript))}
            </div>
          </>
        ) : (
          <button className={cn(compact ? "android-primary" : "answer-submit", primaryButton, focusRing)} type="button" disabled={props.advancing} onClick={props.onNext}>
            {t(props.advancing ? "practice.next.preparing" : props.done ? "practice.next.finish" : compact ? "practice.next.short" : "practice.next.full")}
            {!compact && <Icon name="arrow" />}
          </button>
        )}
      </div>
    </div>
  );
}
