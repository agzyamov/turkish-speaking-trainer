import type { FormEvent, ReactNode } from "react";
import { t } from "../../i18n";
import type { Attempt } from "../../types/training";
import { Icon } from "../../shared/ui/icon";
import { RewardOverlay } from "../../RewardOverlay";
import type { Reward } from "../../useRewards";
import { TranscriptionAssistanceView, type AssistanceDraft } from "../../TranscriptionAssistanceView";
import { hasUnexpectedLetterScript } from "../../turkishText";
import { AnswerActions, type VoiceState } from "./AnswerActions";
import { ExerciseFeedback } from "./ExerciseFeedback";

const transcriptionBreakMessage = "Проблемы с работой внешней моделью. Сделайте перерыв и вернитесь к обучению позже";

function voiceStatus(voiceState: VoiceState, voiceSupported: boolean, hasTranscript: boolean): string {
  if (!voiceSupported) return "Микрофон недоступен. Разрешите доступ к нему в браузере или устройстве.";
  if (voiceState === "connecting") return "Подключаем микрофон…";
  if (voiceState === "recording") return "Идёт запись. Аудио не сохраняется";
  if (voiceState === "transcribing") return "Расшифровываем фразу…";
  if (voiceState === "error") return "Не удалось распознать ответ. Повторите запись.";
  return hasTranscript ? "Введите ответ или исправьте распознанный текст." : "Нажмите на микрофон, чтобы ответить.";
}

/** One exercise: phrase, answer (voice or typed), check, then the result and the next-phrase button. */
export function PracticeCard(props: {
  compact: boolean;
  native: boolean;
  phrase: ReactNode;
  topicTitle: ReactNode;
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
  reward?: Reward;
  advancing: boolean;
  done: boolean;
  onNext: () => void;
}) {
  const { compact, attempt, answer, checking, hasTranscript, voiceState, voiceSupported } = props;
  const answerId = compact ? "android-answer" : "practice-answer";
  return <div className={`practice-card exercise-layout${compact ? " android-training-content" : " panel"}`}>
    <RewardOverlay reward={props.reward?.kind !== "twenty" ? props.reward : undefined} />
    <div className="exercise-scroll">
      <div className="exercise-topic">{props.topicTitle}</div>
      {!attempt && <div className="exercise-source">{props.phrase}</div>}
      {!attempt ? <form id="practice-answer-form" className="exercise-answer" onSubmit={props.onSubmit}>
        {hasTranscript && <div className="exercise-answer-frame result-phrase"><label htmlFor={answerId}>{t("Ваш ответ")}</label>
          <textarea id={answerId} value={answer} readOnly={checking} onChange={event => props.onAnswerEdit(event.target.value)} placeholder={t("Введите ответ на турецком языке")} rows={3} /></div>}
        {hasUnexpectedLetterScript(answer) && <p className="transcription-script-warning" role="alert">{t("В расшифровке есть буквы не из турецкого алфавита. Исправьте текст перед проверкой или запишите ответ заново.")}</p>}
        {props.transcriptionBreakRecommended && <p className="transcription-script-warning" role="alert">{t(transcriptionBreakMessage)}</p>}
        <TranscriptionAssistanceView draft={props.assistanceDraft} disabled={checking || props.voiceBusy} onToggle={props.onToggleAssistance} />
        {!hasTranscript && (voiceState === "error" || !voiceSupported) && <button type="button" onClick={props.onEnterManually}>{t("Ввести ответ вручную")}</button>}
      </form> : <ExerciseFeedback attempt={attempt} native={compact} />}
      {props.error && <p className="error" role="alert">{t(props.error)}{props.errorDiagnosticId && <> <span>{t("Код диагностики")}: {props.errorDiagnosticId}</span></>}</p>}
    </div>
    <div className="exercise-controls">
      {!attempt ? <>
        <AnswerActions answer={answer} loading={checking} native={props.native} voiceState={voiceState} voiceSupported={voiceSupported} startVoice={props.onStartVoice} finishVoice={props.onFinishVoice} stopVoice={props.onStopVoice} />
        <div className="exercise-voice-status" role="status">{t(voiceStatus(voiceState, voiceSupported, hasTranscript))}</div>
      </> : <button className={compact ? "android-primary" : "answer-submit"} type="button" disabled={props.advancing} onClick={props.onNext}>{t(props.advancing ? "Готовим…" : props.done ? "Завершить тренировку" : compact ? "Следующая" : "Следующая фраза")}{!compact && <Icon name="arrow" />}</button>}
    </div>
  </div>;
}
