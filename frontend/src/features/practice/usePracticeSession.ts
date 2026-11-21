import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BackendError, fetchNextExercise, fetchReviewSummary, fetchTopics, startTrainingSession, submitAttempt } from "../../api/training";
import { fetchCurrentUser } from "../../api/users";
import { failureOf } from "../../api/failureDiagnostics";
import { budgetPauseMessage } from "../../budgetPause";
import { t, getLocale, topicText } from "../../i18n";
import { startUiTiming } from "../../performance";
import { assistedText } from "../../transcriptionAssistance";
import type { AssistanceDraft } from "../../TranscriptionAssistanceView";
import { hasUnexpectedLetterScript, latinForEvaluation } from "../../turkishText";
import type { BackendState } from "../../types/app";
import type { CurrentUser } from "../../types/auth";
import type { Attempt, Exercise, TopicListItem, TrainingSession } from "../../types/training";
import { useRewards } from "../../useRewards";
import { supportsVoiceRecording } from "../../voiceRecorder";
import { useVoiceAnswer } from "./useVoiceAnswer";
import { useWordHints } from "./useWordHints";

export type StartupState = "loading" | "ready" | "fallback";

function requestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, digit => {
    const value = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    return (digit === "x" ? value : (value & 3) | 8).toString(16);
  });
}

/** "after 21 November, 00:00" in the interface language; used for daily-limit messages. */
export function resetTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("app.afterLimitResets");
  return t("app.resetsAfter", { time: new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(date) });
}

/**
 * The practice session: topic catalogue and review count, the first phrase at startup, the current
 * session and exercise, the answer (typed or spoken), checking it, and moving to the next phrase.
 * Every request carries the flow (or catalogue / review-summary / account-refresh) epoch it started
 * in and is ignored if the epoch moved on; this request-race handling is unchanged from App.tsx.
 * `onReset` lets the app return its view to practice when the session resets.
 */
export function usePracticeSession({
  account,
  onAccountChange,
  assistanceEnabled,
  onReset,
}: {
  account: CurrentUser;
  onAccountChange: (account: CurrentUser) => void;
  assistanceEnabled: boolean;
  onReset: () => void;
}) {
  const [backendState, setBackendState] = useState<BackendState>("checking");
  const [startupState, setStartupState] = useState<StartupState>("loading");
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>();
  const [customTopic, setCustomTopic] = useState("");
  const [reviewPhraseCount, setReviewPhraseCount] = useState(0);
  const [session, setSession] = useState<TrainingSession>();
  const [exercise, setExercise] = useState<Exercise>();
  const [answer, setAnswer] = useState("");
  const [hasTranscript, setHasTranscript] = useState(false);
  const [assistanceDraft, setAssistanceDraft] = useState<AssistanceDraft>();
  const [attempt, setAttempt] = useState<Attempt>();
  const { reward, prepareReward, celebrate } = useRewards();
  const [checking, setChecking] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [topicExhausted, setTopicExhausted] = useState(false);
  const [preparingPhrase, setPreparingPhrase] = useState(false);
  const [error, setError] = useState<string>();
  const [errorDiagnosticId, setErrorDiagnosticId] = useState<string>();
  const nextExerciseRef = useRef<{ sessionId: string; requestId: string; promise: Promise<Exercise>; controller: AbortController } | undefined>(undefined);
  const pendingAttemptRef = useRef<{ payload: string; id: string } | undefined>(undefined);
  const checkingRef = useRef(false);
  const advancingRef = useRef(false);
  const nextRequestIdRef = useRef<string | undefined>(undefined);
  const flowEpochRef = useRef(0);
  const answerEditEpochRef = useRef(0);
  const flowControllerRef = useRef<AbortController | undefined>(undefined);
  const catalogEpochRef = useRef(0);
  const catalogControllerRef = useRef<AbortController | undefined>(undefined);
  const reviewSummaryEpochRef = useRef(0);
  const accountRefreshEpochRef = useRef(0);
  const initialExerciseTimingPendingRef = useRef(false);
  const hints = useWordHints({ exercise, checkingRef, flowEpochRef, onClearError: () => setError(undefined), onClearDiagnostic: () => setErrorDiagnosticId(undefined), onError: setError });
  const { abortAll: abortHints } = hints;
  const voiceSupported = supportsVoiceRecording();
  const voice = useVoiceAnswer({
    exercise,
    voiceSupported,
    assistanceEnabled,
    answerEditEpochRef,
    onError: setError,
    onDiagnostic: setErrorDiagnosticId,
    onTranscribed: (text, draft) => {
      setAnswer(text);
      setHasTranscript(true);
      setAssistanceDraft(draft);
    },
  });
  const { voiceState, setVoiceState, voiceBusy, voiceTimingRef, transcriptionBreakRecommended, stopVoice, interruptVoice, abortVoice, startVoice, finishVoice } = voice;
  useEffect(() => {
    startUiTiming("topics");
  }, []);
  function invalidateFlow() {
    flowEpochRef.current += 1;
    initialExerciseTimingPendingRef.current = false;
    hints.invalidate();
    flowControllerRef.current?.abort();
    flowControllerRef.current = undefined;
    hints.forget();
    nextExerciseRef.current?.controller.abort();
    nextExerciseRef.current = undefined;
    nextRequestIdRef.current = undefined;
    pendingAttemptRef.current = undefined;
    checkingRef.current = false;
    advancingRef.current = false;
    setChecking(false);
    setAdvancing(false);
    setPreparingPhrase(false);
  }

  const refreshReviewSummary = useCallback((signal?: AbortSignal) => {
    const epoch = ++reviewSummaryEpochRef.current;
    return fetchReviewSummary(signal).then(summary => {
      if (reviewSummaryEpochRef.current === epoch) setReviewPhraseCount(summary.phrase_count);
    });
  }, []);

  const loadCatalog = useCallback(() => {
    catalogControllerRef.current?.abort();
    flowControllerRef.current?.abort();
    flowEpochRef.current += 1;
    flowControllerRef.current = undefined;
    checkingRef.current = false;
    advancingRef.current = false;
    const controller = new AbortController();
    catalogControllerRef.current = controller;
    const epoch = ++catalogEpochRef.current;
    const summaryEpoch = ++reviewSummaryEpochRef.current;
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted || catalogEpochRef.current !== epoch) return;
      setChecking(false);
      setAdvancing(false);
      setPreparingPhrase(false);
      setStartupState("loading");
      setBackendState("checking");
      setError(undefined);
      setErrorDiagnosticId(undefined);
      const [topicsResult, summaryResult] = await Promise.allSettled([fetchTopics(controller.signal), fetchReviewSummary(controller.signal)]);
      if (controller.signal.aborted || catalogEpochRef.current !== epoch) return;
      if (topicsResult.status === "rejected") {
        setBackendState("offline");
        setError("app.couldNotLoadTopics");
        setStartupState("fallback");
        return;
      }
      const availableTopics = topicsResult.value;
      const firstTopic = availableTopics.find(topic => topic.phrase_count > 0);
      setTopics(availableTopics);
      setSelectedTopic(firstTopic?.id);
      setBackendState("online");
      if (summaryResult.status === "rejected") {
        setError("app.couldNotLoadReview");
        setStartupState("fallback");
        return;
      }
      const reviewCount = summaryResult.value.phrase_count;
      if (reviewSummaryEpochRef.current === summaryEpoch) setReviewPhraseCount(reviewCount);
      setSelectedTopic(reviewCount > 0 ? undefined : firstTopic?.id);
      if (reviewCount === 0 && !firstTopic) {
        setError("app.noPhrasesPractiseYet");
        setStartupState("fallback");
        return;
      }
      if (!Capacitor.isNativePlatform()) startUiTiming("first_phrase");
      flowControllerRef.current = controller;
      try {
        let started;
        if (reviewCount > 0) {
          try {
            started = await startTrainingSession({ review_mode: true }, controller.signal);
          } catch (requestError) {
            if (!(requestError instanceof BackendError && requestError.code === "review_queue_empty")) throw requestError;
            if (reviewSummaryEpochRef.current === summaryEpoch) setReviewPhraseCount(0);
            if (!firstTopic) {
              setError("app.noPhrasesPractiseYet");
              setStartupState("fallback");
              return;
            }
            setSelectedTopic(firstTopic.id);
            started = await startTrainingSession({ topic_id: firstTopic.id }, controller.signal);
          }
        } else {
          started = await startTrainingSession({ topic_id: firstTopic!.id }, controller.signal);
        }
        if (controller.signal.aborted || catalogEpochRef.current !== epoch) return;
        setSession(started.session);
        setExercise(started.exercise);
        setCompletedCount(started.session.completed_count ?? 0);
        if (Capacitor.isNativePlatform()) initialExerciseTimingPendingRef.current = true;
        setStartupState("ready");
      } catch {
        if (controller.signal.aborted || catalogEpochRef.current !== epoch) return;
        setError("app.couldNotPrepareFirst");
        setStartupState("fallback");
      } finally {
        if (catalogEpochRef.current === epoch) flowControllerRef.current = undefined;
      }
    })();
  }, []);

  const refreshReadyCatalog = useCallback(() => {
    catalogControllerRef.current?.abort();
    const controller = new AbortController();
    catalogControllerRef.current = controller;
    const epoch = ++catalogEpochRef.current;
    setBackendState("checking");
    void fetchTopics(controller.signal)
      .then(availableTopics => {
        if (controller.signal.aborted || catalogEpochRef.current !== epoch) return;
        setTopics(availableTopics);
        setSelectedTopic(current => current ?? availableTopics.find(topic => topic.phrase_count > 0)?.id);
        setBackendState("online");
      })
      .catch(() => {
        if (!controller.signal.aborted && catalogEpochRef.current === epoch) setBackendState("offline");
      });
    void refreshReviewSummary(controller.signal).catch(() => undefined);
  }, [refreshReviewSummary]);

  function retryCatalog() {
    if (startupState === "ready") refreshReadyCatalog();
    else loadCatalog();
  }

  useEffect(() => {
    loadCatalog();
    return () => {
      catalogEpochRef.current += 1;
      catalogControllerRef.current?.abort();
    };
  }, [loadCatalog]);

  useEffect(
    () => () => {
      flowEpochRef.current += 1;
      catalogEpochRef.current += 1;
      reviewSummaryEpochRef.current += 1;
      accountRefreshEpochRef.current += 1;
      abortVoice();
      abortHints();
      flowControllerRef.current?.abort();
      nextExerciseRef.current?.controller.abort();
      catalogControllerRef.current?.abort();
    },
    [abortHints, abortVoice],
  ); // stable: runs on unmount only
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (startupState === "ready" && document.visibilityState === "visible") refreshReadyCatalog();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [refreshReadyCatalog, startupState]);
  const selectedTopicData = topics.find(topic => topic.id === selectedTopic);
  const currentTopic = session?.topic ?? selectedTopicData;
  const isReviewMode = session?.topic.id === "review-phrases";
  const phraseTopicTitle = isReviewMode
    ? `${t("app.reviewPhrases")}${exercise?.topic_title_ru ? ` / ${topicText(exercise.topic_id, exercise.topic_title_ru, topics.find(topic => topic.id === exercise.topic_id)?.title_en)}` : ""}`
    : currentTopic
      ? topicText(currentTopic.id, currentTopic.title_ru, currentTopic.title_en)
      : "";

  function enterAnswerManually() {
    voiceTimingRef.current = undefined;
    setHasTranscript(true);
    setVoiceState("idle");
    setError(undefined);
    setErrorDiagnosticId(undefined);
  }

  async function startTraining(topicId: string) {
    startUiTiming("first_phrase");
    invalidateFlow();
    stopVoice();
    setAnswer("");
    setAssistanceDraft(undefined);
    setHasTranscript(false);
    setAttempt(undefined);
    hints.resetView();
    setSession(undefined);
    setExercise(undefined);
    setCompletedCount(0);
    setSessionComplete(false);
    setTopicExhausted(false);
    setPreparingPhrase(true);
    setError(undefined);
    setErrorDiagnosticId(undefined);
    const epoch = flowEpochRef.current;
    const controller = new AbortController();
    flowControllerRef.current = controller;
    try {
      const started = await startTrainingSession({ topic_id: topicId }, controller.signal);
      if (flowEpochRef.current !== epoch) return;
      setSession(started.session);
      setExercise(started.exercise);
      setCompletedCount(started.session.completed_count ?? 0);
      setStartupState("ready");
    } catch (requestError) {
      if (flowEpochRef.current !== epoch) return;
      setError(requestError instanceof BackendError && (requestError.code === "topic_empty" || requestError.status === 409) ? "app.topicHasNoPhrases" : "app.couldNotStartPractice");
    } finally {
      if (flowEpochRef.current === epoch) {
        flowControllerRef.current = undefined;
        setPreparingPhrase(false);
      }
    }
  }

  async function startReviewTraining() {
    if (isReviewMode && session && exercise && !sessionComplete) return;
    startUiTiming("first_phrase");
    invalidateFlow();
    stopVoice();
    setSession(undefined);
    setExercise(undefined);
    setCompletedCount(0);
    setSessionComplete(false);
    setTopicExhausted(false);
    setSelectedTopic(undefined);
    setCustomTopic("");
    setError(undefined);
    setErrorDiagnosticId(undefined);
    if (!reviewPhraseCount) {
      setError("app.noPhrasesReviewYet");
      return;
    }
    setPreparingPhrase(true);
    const epoch = flowEpochRef.current;
    const controller = new AbortController();
    flowControllerRef.current = controller;
    try {
      const started = await startTrainingSession({ review_mode: true }, controller.signal);
      if (flowEpochRef.current !== epoch) return;
      setSession(started.session);
      setExercise(started.exercise);
      setAnswer("");
      setAssistanceDraft(undefined);
      setHasTranscript(false);
      setAttempt(undefined);
      hints.resetView();
      setStartupState("ready");
    } catch (requestError) {
      if (flowEpochRef.current !== epoch) return;
      if (requestError instanceof BackendError && requestError.code === "review_queue_empty") {
        reviewSummaryEpochRef.current += 1;
        setReviewPhraseCount(0);
      }
      setError(requestError instanceof BackendError && requestError.code === "review_queue_empty" ? "app.youHaveMasteredAll" : "app.couldNotStartPhrase");
    } finally {
      if (flowEpochRef.current === epoch) {
        flowControllerRef.current = undefined;
        setPreparingPhrase(false);
      }
    }
  }

  async function nextExercise() {
    if (!session || advancingRef.current) return;
    if (!isReviewMode && completedCount >= session.requested_length) {
      setSessionComplete(true);
      return;
    }
    startUiTiming("next_phrase");
    advancingRef.current = true;
    hints.invalidate();
    stopVoice();
    setAdvancing(true);
    setError(undefined);
    setErrorDiagnosticId(undefined);
    const epoch = flowEpochRef.current;
    const request = nextExerciseRef.current?.sessionId === session.id ? nextExerciseRef.current : undefined;
    const id = request?.requestId ?? nextRequestIdRef.current ?? requestId();
    nextRequestIdRef.current = id;
    const controller = request?.controller ?? new AbortController();
    flowControllerRef.current = controller;
    try {
      const next = await (request?.promise ?? fetchNextExercise(session.id, id, controller.signal));
      if (flowEpochRef.current !== epoch) return;
      nextExerciseRef.current = undefined;
      nextRequestIdRef.current = undefined;
      setExercise(next);
      hints.forget();
      setAnswer("");
      setAssistanceDraft(undefined);
      setHasTranscript(false);
      setAttempt(undefined);
      hints.resetView();
    } catch (requestError) {
      if (flowEpochRef.current !== epoch) return;
      nextExerciseRef.current = undefined;
      if (requestError instanceof BackendError && requestError.code === "session_completed") {
        setSessionComplete(true);
      } else if (!isReviewMode && requestError instanceof BackendError && requestError.code === "topic_empty") {
        setTopicExhausted(true);
        setSessionComplete(true);
      } else if (isReviewMode && requestError instanceof BackendError && (requestError.code === "review_queue_empty" || requestError.status === 409)) {
        reviewSummaryEpochRef.current += 1;
        setSession(undefined);
        setExercise(undefined);
        setReviewPhraseCount(0);
        setAnswer("");
        setAssistanceDraft(undefined);
        setHasTranscript(false);
        setAttempt(undefined);
        hints.resetView();
        setError("app.youHaveMasteredAll");
      } else setError("app.couldNotLoadNext");
    } finally {
      if (flowEpochRef.current === epoch) {
        advancingRef.current = false;
        flowControllerRef.current = undefined;
        setAdvancing(false);
      }
    }
  }

  function toggleTranscriptionChange(index: number) {
    if (!assistanceDraft || assistanceDraft.edited || checking || voiceBusy) return;
    const selected = assistanceDraft.selected.includes(index) ? assistanceDraft.selected.filter(i => i !== index) : [...assistanceDraft.selected, index];
    answerEditEpochRef.current += 1;
    setAnswer(latinForEvaluation(assistedText(assistanceDraft.response, selected)));
    setAssistanceDraft({ ...assistanceDraft, selected });
  }

  async function checkAnswer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exercise || !session || !hasTranscript || !answer.trim() || checkingRef.current || voiceBusy || hasUnexpectedLetterScript(answer)) return;
    startUiTiming("check");
    prepareReward();
    // C-18: send what the learner typed; the backend repairs look-alike letters only for grading.
    const transcript = answer.trim();
    const timing = voiceTimingRef.current;
    const hintedWords = hints.hintedWords();
    const assistance = assistanceDraft?.response.transcription_id
      ? {
          transcription_id: assistanceDraft.response.transcription_id,
          accepted_transcription_changes: assistanceDraft.selected.filter(i => assistanceDraft.response.changes![i].action === "suggested"),
        }
      : undefined;
    const payload = JSON.stringify({ exerciseId: exercise.id, transcript, timing, hintedWords, assistance });
    const id = pendingAttemptRef.current?.payload === payload ? pendingAttemptRef.current.id : requestId();
    pendingAttemptRef.current = { payload, id };
    checkingRef.current = true;
    setChecking(true);
    setError(undefined);
    setErrorDiagnosticId(undefined);
    hints.dismiss();
    const epoch = flowEpochRef.current;
    const controller = new AbortController();
    flowControllerRef.current = controller;
    try {
      const completed = await submitAttempt(exercise.id, transcript, timing, hintedWords, id, controller.signal, assistance);
      if (flowEpochRef.current !== epoch) return;
      pendingAttemptRef.current = undefined;
      setAttempt(completed);
      celebrate(completed);
      hints.invalidate();
      const count = completedCount + 1;
      setCompletedCount(count);
      const accountEpoch = ++accountRefreshEpochRef.current;
      if (completed.daily_usage) onAccountChange({ ...account, daily_usage: completed.daily_usage });
      if (isReviewMode || count < session.requested_length) {
        const nextController = new AbortController();
        const nextId = requestId();
        nextRequestIdRef.current = nextId;
        const prepared = fetchNextExercise(session.id, nextId, nextController.signal);
        nextExerciseRef.current = { sessionId: session.id, requestId: nextId, promise: prepared, controller: nextController };
        void prepared.catch(() => {
          if (nextExerciseRef.current?.promise === prepared) nextExerciseRef.current = undefined;
        });
      }
      const refreshSideData = () => {
        void refreshReviewSummary().catch(() => undefined);
        void fetchTopics()
          .then(availableTopics => {
            if (flowEpochRef.current === epoch) setTopics(availableTopics);
          })
          .catch(() => undefined);
        if (!completed.daily_usage)
          void fetchCurrentUser()
            .then(updated => {
              if (flowEpochRef.current === epoch && accountRefreshEpochRef.current === accountEpoch) onAccountChange(updated);
            })
            .catch(() => undefined);
      };
      refreshSideData();
    } catch (requestError) {
      if (flowEpochRef.current !== epoch) return;
      const failure = failureOf(requestError);
      const budgetPause = budgetPauseMessage(requestError);
      setErrorDiagnosticId(failure?.diagnostic_id);
      if (budgetPause) setError(budgetPause);
      else if (failure)
        setError(
          {
            external_model: "app.externalCheckingServiceCould",
            response_parse: "app.checkingServiceResponseCould",
            response_return: "app.checkingResultCouldNot",
          }[failure.kind],
        );
      else if (requestError instanceof BackendError && requestError.status === 429) setError(t("app.dailyLimitReached", { time: resetTimeLabel(account.daily_usage.resets_at) }));
      else if (requestError instanceof BackendError && requestError.code === "transcript_unexpected_script") setError("app.transcriptContainsLettersOutside");
      else if (requestError instanceof BackendError && requestError.code === "analysis_unavailable") setError("app.checkingServiceTemporarilyUnavailable");
      else if (requestError instanceof BackendError && requestError.code === "attempt_in_progress") setError("app.answerStillBeingChecked");
      else if (requestError instanceof BackendError && requestError.code === "attempt_request_conflict") {
        pendingAttemptRef.current = undefined;
        setError("app.answerChangedWhileWas");
      } else setError("app.couldNotCheckAnswer");
    } finally {
      if (flowEpochRef.current === epoch) {
        checkingRef.current = false;
        flowControllerRef.current = undefined;
        setChecking(false);
      }
    }
  }

  function resetTraining() {
    invalidateFlow();
    stopVoice();
    onReset();
    setSession(undefined);
    setExercise(undefined);
    setAnswer("");
    setAssistanceDraft(undefined);
    setHasTranscript(false);
    setAttempt(undefined);
    setError(undefined);
    setErrorDiagnosticId(undefined);
    hints.resetView();
    setCompletedCount(0);
    setSessionComplete(false);
    setTopicExhausted(false);
  }

  const reviewFinished = error === "app.youHaveMasteredAll";

  function selectTopic(topicId: string) {
    if (session?.topic.id === topicId && exercise && !sessionComplete) return;
    if (session || preparingPhrase || sessionComplete) resetTraining();
    setSelectedTopic(topicId);
    setCustomTopic("");
    setSession(undefined);
    setExercise(undefined);
    if (topics.find(topic => topic.id === topicId)?.phrase_count) void startTraining(topicId);
  }

  function refreshCustomContent() {
    void Promise.allSettled([fetchTopics().then(setTopics), refreshReviewSummary()]).then(results => {
      if (results.some(result => result.status === "rejected")) setError("app.couldNotRefreshCatalog");
    });
  }

  return {
    accountRefreshEpochRef,
    advancing,
    answer,
    answerEditEpochRef,
    assistanceDraft,
    attempt,
    backendState,
    checkAnswer,
    checking,
    completedCount,
    currentTopic,
    customTopic,
    enterAnswerManually,
    error,
    errorDiagnosticId,
    exercise,
    finishVoice,
    hasTranscript,
    hints,
    initialExerciseTimingPendingRef,
    interruptVoice,
    isReviewMode,
    nextExercise,
    phraseTopicTitle,
    preparingPhrase,
    refreshCustomContent,
    resetTraining,
    retryCatalog,
    reviewFinished,
    reviewPhraseCount,
    reward,
    selectTopic,
    selectedTopic,
    selectedTopicData,
    session,
    sessionComplete,
    setAnswer,
    setAssistanceDraft,
    setCustomTopic,
    setSelectedTopic,
    setTopics,
    startReviewTraining,
    startVoice,
    startupState,
    stopVoice,
    toggleTranscriptionChange,
    topicExhausted,
    topics,
    transcriptionBreakRecommended,
    voiceBusy,
    voiceState,
    voiceSupported,
    voiceTimingRef,
  };
}
