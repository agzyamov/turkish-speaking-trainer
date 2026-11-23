import { useCallback, useRef, useState, type RefObject } from "react";
import { BackendError, transcribeAudio } from "../../api/training";
import { failureOf } from "../../api/failureDiagnostics";
import { budgetPauseMessage } from "../../budgetPause";
import { startUiTiming } from "../../performance";
import { transcriptionErrorMessage } from "../../transcriptionError";
import type { AssistanceDraft } from "../../TranscriptionAssistanceView";
import { hasUnexpectedLetterScript, latinForEvaluation } from "../../turkishText";
import type { AttemptTimings, Exercise } from "../../types/training";
import { Capacitor } from "@capacitor/core";
import { microphoneFailureOf, VoiceRecorder, type MicrophoneFailure } from "../../voiceRecorder";
import type { VoiceState } from "./AnswerActions";

const microphoneFailureMessages: Record<MicrophoneFailure, string> = {
  denied: "app.microphoneBlocked",
  unsupported: "practice.voice.unavailable",
  other: "app.microphoneFailed",
};

// The Android app has no browser or site to point at: there the fix is the app permission.
const nativeMicrophoneFailureMessages: Record<MicrophoneFailure, string> = {
  denied: "app.microphoneBlockedNative",
  unsupported: "practice.voice.unavailableNative",
  other: "app.microphoneFailed",
};

/**
 * Recording a spoken answer and transcribing it. Every recording and transcription carries a voice
 * epoch; stopping or interrupting bumps it, so a late recorder or transcription result is ignored.
 * A transcript only replaces the answer if the learner has not edited it since recording started
 * (`answerEditEpochRef`, owned by the caller, which bumps it on every edit).
 */
export function useVoiceAnswer({
  exercise,
  voiceSupported,
  assistanceEnabled,
  answerEditEpochRef,
  onError,
  onDiagnostic,
  onTranscribed,
}: {
  exercise?: Exercise;
  voiceSupported: boolean;
  assistanceEnabled: boolean;
  answerEditEpochRef: RefObject<number>;
  onError: (message: string | undefined) => void;
  onDiagnostic: (id: string | undefined) => void;
  onTranscribed: (answer: string, draft: AssistanceDraft | undefined) => void;
}) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcriptionBreakRecommended, setTranscriptionBreakRecommended] = useState(false);
  const unexpectedScriptStreakRef = useRef(0);
  const voiceRef = useRef<VoiceRecorder | undefined>(undefined);
  /** Recording timings for the current answer; cleared when the answer no longer comes from that recording. */
  const voiceTimingRef = useRef<AttemptTimings | undefined>(undefined);
  const voiceEpochRef = useRef(0);
  const voiceStartEditEpochRef = useRef(0);
  const voiceControllerRef = useRef<AbortController | undefined>(undefined);
  const voiceBusy = voiceState === "connecting" || voiceState === "recording" || voiceState === "transcribing";

  const stopVoice = useCallback(() => {
    voiceEpochRef.current += 1;
    voiceControllerRef.current?.abort();
    voiceControllerRef.current = undefined;
    if (voiceRef.current) {
      voiceRef.current.stop();
      voiceRef.current = undefined;
    }
    voiceTimingRef.current = undefined;
    setVoiceState("idle");
  }, []);

  /** Stop a recording or transcription in progress because the learner left the practice (no-op when idle). */
  const interruptVoice = useCallback(() => {
    if (!voiceRef.current && !voiceControllerRef.current) return;
    stopVoice();
    setVoiceState("error");
    onError("app.recordingInterruptedPhraseAnswer");
  }, [stopVoice, onError]);

  /** Unmount: retire everything without touching state. */
  const abortVoice = useCallback(() => {
    voiceEpochRef.current += 1;
    voiceControllerRef.current?.abort();
    voiceRef.current?.stop();
  }, []);

  async function finishVoice() {
    const recorder = voiceRef.current;
    if (!recorder || !exercise) return;
    const epoch = voiceEpochRef.current;
    const exerciseId = exercise.id;
    const controller = new AbortController();
    voiceControllerRef.current = controller;
    setVoiceState("transcribing");
    onError(undefined);
    onDiagnostic(undefined);
    try {
      const recording = await recorder.finish();
      if (voiceEpochRef.current !== epoch) return;
      voiceRef.current = undefined;
      startUiTiming("transcription");
      const transcript = await transcribeAudio(exerciseId, recording.audio, controller.signal, assistanceEnabled);
      if (voiceEpochRef.current !== epoch) return;
      const unexpectedScript = hasUnexpectedLetterScript(transcript.text);
      unexpectedScriptStreakRef.current = unexpectedScript ? unexpectedScriptStreakRef.current + 1 : 0;
      setTranscriptionBreakRecommended(unexpectedScriptStreakRef.current >= 3);
      if (answerEditEpochRef.current === voiceStartEditEpochRef.current) {
        voiceTimingRef.current = recording.timing;
        const answer = transcript.review_required ? transcript.text : latinForEvaluation(transcript.text);
        if (transcript.review_required) voiceTimingRef.current = undefined;
        onTranscribed(
          answer,
          transcript.transcription_id || transcript.assistance_status
            ? { response: transcript, selected: (transcript.changes ?? []).flatMap((c, i) => (c.action === "applied" ? [i] : [])), edited: false }
            : undefined,
        );
      }
      setVoiceState("idle");
    } catch (error) {
      if (voiceEpochRef.current !== epoch) return;
      unexpectedScriptStreakRef.current = error instanceof BackendError && error.code === "transcription_unexpected_script" ? unexpectedScriptStreakRef.current + 1 : 0;
      setTranscriptionBreakRecommended(unexpectedScriptStreakRef.current >= 3);
      recorder.stop();
      voiceRef.current = undefined;
      voiceTimingRef.current = undefined;
      setVoiceState("error");
      onDiagnostic(failureOf(error)?.diagnostic_id);
      onError(budgetPauseMessage(error) ?? transcriptionErrorMessage(error));
    } finally {
      if (voiceEpochRef.current === epoch) voiceControllerRef.current = undefined;
    }
  }

  async function startVoice() {
    if (!exercise || !voiceSupported) return;
    stopVoice();
    voiceStartEditEpochRef.current = answerEditEpochRef.current;
    onError(undefined);
    onDiagnostic(undefined);
    setVoiceState("connecting");
    const epoch = voiceEpochRef.current;
    const recorder = new VoiceRecorder();
    voiceRef.current = recorder;
    try {
      await recorder.start();
      if (voiceEpochRef.current === epoch && voiceRef.current === recorder) setVoiceState("recording");
    } catch (error) {
      recorder.stop();
      if (voiceEpochRef.current !== epoch) return;
      if (voiceRef.current === recorder) voiceRef.current = undefined;
      setVoiceState("error");
      const messages = Capacitor.isNativePlatform() ? nativeMicrophoneFailureMessages : microphoneFailureMessages;
      onError(messages[microphoneFailureOf(error)]);
    }
  }

  return { voiceState, setVoiceState, voiceBusy, voiceTimingRef, transcriptionBreakRecommended, stopVoice, interruptVoice, abortVoice, startVoice, finishVoice };
}
