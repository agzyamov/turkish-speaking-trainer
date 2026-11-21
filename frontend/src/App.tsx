import { failureOf } from "./api/failureDiagnostics";
import { budgetPauseMessage } from "./budgetPause";
import { t, useLanguage, getLocale, topicText } from "./i18n";
import { exerciseSource } from "./exerciseSource";
import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import { BackendError, fetchNextExercise, fetchReviewSummary, fetchTopics, revealWordHint, startTrainingSession, submitAttempt, transcribeAudio } from "./api/training";
import type { Attempt, AttemptTimings, Exercise, TopicListItem, TrainingSession, WordHint } from "./types/training";
import { supportsVoiceRecording, VoiceRecorder } from "./voiceRecorder";
import { DeferredPanel } from "./DeferredPanel";
import { fetchCurrentUser } from "./api/users";
import type { CurrentUser } from "./types/auth";
import { LegalPage } from "./LegalPage";
import { assistedText } from "./transcriptionAssistance";
import { transcriptionErrorMessage } from "./transcriptionError";
import type { AssistanceDraft } from "./TranscriptionAssistanceView";
import { useAssistancePreference } from "./useAssistancePreference";
import { useMobileLayout } from "./useMobileLayout";
import { SettingsView } from "./SettingsView";
import { PremiumView, type PremiumUiState } from "./PremiumView";
import { sortedPersonalTopics } from "./personalTopics";
import { hasUnexpectedLetterScript, latinForEvaluation } from "./turkishText";
import { RewardOverlay } from "./RewardOverlay";
import { useRewards } from "./useRewards";
import { finishUiTimingWhenVisible, startUiTiming } from "./performance";
import "./index.css";
import { Icon } from "./shared/ui/icon";
import type { VoiceState } from "./features/practice/AnswerActions";
import { PhraseLoading } from "./features/practice/PhraseLoading";
import { InteractivePhrase } from "./features/practice/InteractivePhrase";
import { PracticeCard } from "./features/practice/PracticeCard";
import { AuthGate } from "./features/auth/AuthGate";
import { AppHeader, MobileHeader, type AppView, type BackendState } from "./features/shell/AppHeader";
import { TopicGrid } from "./features/shell/TopicGrid";
import { topicIconName } from "./features/shell/topicIcons";
import { PracticeDone, ReviewComplete, WelcomeCard } from "./features/shell/StageStates";
import { cn } from "./shared/lib/utils";
import { authPage } from "./features/auth/authStyles";

type StartupState = "loading" | "ready" | "fallback";


const loadStatistics = (retryUrl?: string) => (retryUrl
  ? import(/* @vite-ignore */ retryUrl) as Promise<typeof import("./features/statistics/StatisticsView")>
  : import("./features/statistics/StatisticsView")).then(({ StatisticsView }) => ({ default: StatisticsView }));
const loadAdminUsers = (retryUrl?: string) => (retryUrl
  ? import(/* @vite-ignore */ retryUrl) as Promise<typeof import("./AdminUsersView")>
  : import("./AdminUsersView")).then(({ AdminUsersView }) => ({ default: AdminUsersView }));



function requestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (digit) => {
    const value = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    return (digit === "x" ? value : (value & 3) | 8).toString(16);
  });
}

function resetTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("app.afterLimitResets");
  return t("app.resetsAfter", { time: new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(date) });
}



export default function App() {
  const language = useLanguage();
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  if (window.location.pathname === "/privacy") return <LegalPage kind="privacy" />;
  if (window.location.pathname === "/terms") return <LegalPage kind="terms" />;
  if (window.location.pathname === "/delete-account") return <LegalPage kind="delete-account" />;
  return <AuthGate>{(account, onAccountChange, onSignOut) => <TrainerApp key={account.id} account={account} onAccountChange={onAccountChange} onSignOut={onSignOut} />}</AuthGate>;
}

function TrainerApp({ account, onAccountChange, onSignOut }: { account: CurrentUser; onAccountChange: (account: CurrentUser) => void; onSignOut: () => void }) {
  const [backendState, setBackendState] = useState<BackendState>("checking");
  const [startupState, setStartupState] = useState<StartupState>("loading");
  const [view, setView] = useState<AppView>("practice");
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>();
  const [customTopic, setCustomTopic] = useState("");
  const [reviewPhraseCount, setReviewPhraseCount] = useState(0);
  const [session, setSession] = useState<TrainingSession>();
  const [exercise, setExercise] = useState<Exercise>();
  const [answer, setAnswer] = useState("");
  const [hasTranscript, setHasTranscript] = useState(false);
  const { enabled: assistanceEnabled, saving: assistanceSaving, error: assistanceError, change: changeAssistance, refresh: refreshAssistance } = useAssistancePreference(account.assistance_enabled ?? false);
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
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const unexpectedScriptStreakRef = useRef(0);
  const [transcriptionBreakRecommended, setTranscriptionBreakRecommended] = useState(false);
  const [wordHints, setWordHints] = useState<Record<string, WordHint>>({});
  const [activeHint, setActiveHint] = useState<string>();
  const wordHintsRef = useRef<Record<string, WordHint>>({});
  const savedHintsRef = useRef(new Set<string>());
  const hintRequestsRef = useRef(new Map<string, AbortController>());
  const voiceRef = useRef<VoiceRecorder | undefined>(undefined);
  const voiceTimingRef = useRef<AttemptTimings | undefined>(undefined);
  const nextExerciseRef = useRef<{ sessionId: string; requestId: string; promise: Promise<Exercise>; controller: AbortController } | undefined>(undefined);
  const pendingAttemptRef = useRef<{ payload: string; id: string } | undefined>(undefined);
  const checkingRef = useRef(false);
  const advancingRef = useRef(false);
  const nextRequestIdRef = useRef<string | undefined>(undefined);
  const flowEpochRef = useRef(0);
  const voiceEpochRef = useRef(0);
  const answerEditEpochRef = useRef(0);
  const voiceStartEditEpochRef = useRef(0);
  const hintEpochRef = useRef(0);
  const flowControllerRef = useRef<AbortController | undefined>(undefined);
  const voiceControllerRef = useRef<AbortController | undefined>(undefined);
  const catalogEpochRef = useRef(0);
  const catalogControllerRef = useRef<AbortController | undefined>(undefined);
  const reviewSummaryEpochRef = useRef(0);
  const accountRefreshEpochRef = useRef(0);
  const androidPagerRef = useRef<HTMLDivElement | null>(null);
  const presentedExerciseRef = useRef<string | undefined>(undefined);
  const initialExerciseTimingPendingRef = useRef(false);
  const [androidPanel, setAndroidPanel] = useState(() => Capacitor.isNativePlatform() ? 0 : 1);
  const [statisticsPage, setStatisticsPage] = useState<"activity" | "phrases">("activity");
  const androidBackHandlerRef = useRef<() => void>(() => undefined);
  const voiceSupported = supportsVoiceRecording();
  const isNative = Capacitor.isNativePlatform();
  const { compact, shell: mobileShellRef } = useMobileLayout(startupState !== "loading" && !isNative);
  const mobileLayout = isNative || compact;
  const visiblePanel = !isNative && view !== "practice" ? view === "statistics" ? 2 : view === "premium" ? 3 : 4 : androidPanel;
  // Section state that must survive the phone/desktop layout switch (which remounts the visible section)
  // but not leaving the section: it resets when another panel is shown.
  const premiumUi = useState<PremiumUiState>({ paymentOpen: false, paymentReported: false });
  const [, setPremiumUi] = premiumUi;
  const [shownPanel, setShownPanel] = useState(visiblePanel);
  if (shownPanel !== visiblePanel) { // React's "reset state when a value changes" pattern, during render
    setShownPanel(visiblePanel);
    if (visiblePanel !== 3) setPremiumUi({ paymentOpen: false, paymentReported: false });
  }

  useEffect(() => { startUiTiming("topics"); }, []);
  useEffect(() => {
    if (startupState !== "loading" && topics.length) finishUiTimingWhenVisible("topics", mobileLayout ? ".android-topic-list .android-topic" : ".topics .topic");
  }, [topics, mobileLayout, startupState]);
  useEffect(() => {
    if (exercise && !attempt) {
      const selector = mobileLayout ? ".android-page .interactive-phrase" : ".practice-stage .interactive-phrase";
      if (presentedExerciseRef.current !== exercise.id && (mobileLayout ? visiblePanel === 1 : view === "practice")) {
        document.querySelector<HTMLElement>(selector)?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
        presentedExerciseRef.current = exercise.id;
      }
      finishUiTimingWhenVisible("first_phrase", selector);
      finishUiTimingWhenVisible("next_phrase", selector);
    }
  }, [exercise, attempt, mobileLayout, visiblePanel, view]);
  useEffect(() => {
    if (hasTranscript) finishUiTimingWhenVisible("transcription", mobileLayout ? "#android-answer" : "#practice-answer");
  }, [hasTranscript, mobileLayout]);
  useEffect(() => {
    if (attempt) finishUiTimingWhenVisible("check", ".feedback");
  }, [attempt]);

  function invalidateFlow() {
    flowEpochRef.current += 1;
    initialExerciseTimingPendingRef.current = false;
    hintEpochRef.current += 1;
    flowControllerRef.current?.abort();
    flowControllerRef.current = undefined;
    savedHintsRef.current.clear();
    wordHintsRef.current = {};
    nextExerciseRef.current?.controller.abort();
    nextExerciseRef.current = undefined;
    nextRequestIdRef.current = undefined;
    pendingAttemptRef.current = undefined;
    checkingRef.current = false;
    advancingRef.current = false;
    setChecking(false); setAdvancing(false); setPreparingPhrase(false);
  }

  const refreshReviewSummary = useCallback((signal?: AbortSignal) => {
    const epoch = ++reviewSummaryEpochRef.current;
    return fetchReviewSummary(signal).then((summary) => {
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
      setChecking(false); setAdvancing(false); setPreparingPhrase(false);
      setStartupState("loading");
      setBackendState("checking");
      setError(undefined); setErrorDiagnosticId(undefined);
      const [topicsResult, summaryResult] = await Promise.allSettled([
        fetchTopics(controller.signal), fetchReviewSummary(controller.signal),
      ]);
      if (controller.signal.aborted || catalogEpochRef.current !== epoch) return;
      if (topicsResult.status === "rejected") {
        setBackendState("offline");
        setError("app.couldNotLoadTopics");
        setStartupState("fallback");
        return;
      }
      const availableTopics = topicsResult.value;
      const firstTopic = availableTopics.find((topic) => topic.phrase_count > 0);
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
        setSession(started.session); setExercise(started.exercise);
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
      .then((availableTopics) => {
        if (controller.signal.aborted || catalogEpochRef.current !== epoch) return;
        setTopics(availableTopics);
        setSelectedTopic((current) => current ?? availableTopics.find((topic) => topic.phrase_count > 0)?.id);
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
    return () => { catalogEpochRef.current += 1; catalogControllerRef.current?.abort(); };
  }, [loadCatalog]);

  useEffect(() => () => {
    flowEpochRef.current += 1;
    catalogEpochRef.current += 1;
    reviewSummaryEpochRef.current += 1;
    accountRefreshEpochRef.current += 1;
    voiceEpochRef.current += 1;
    hintEpochRef.current += 1;
    flowControllerRef.current?.abort();
    voiceControllerRef.current?.abort();
    for (const request of hintRequestsRef.current.values()) request.abort();
    hintRequestsRef.current.clear();
    nextExerciseRef.current?.controller.abort();
    catalogControllerRef.current?.abort();
    voiceRef.current?.stop();
  }, []);
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (startupState === "ready" && document.visibilityState === "visible") refreshReadyCatalog();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [refreshReadyCatalog, startupState]);
  const selectedTopicData = topics.find((topic) => topic.id === selectedTopic);
  const currentTopic = session?.topic ?? selectedTopicData;
  const isReviewMode = session?.topic.id === "review-phrases";
  const phraseTopicTitle = isReviewMode
    ? `${t("app.reviewPhrases")}${exercise?.topic_title_ru ? ` / ${topicText(exercise.topic_id, exercise.topic_title_ru, topics.find(topic => topic.id === exercise.topic_id)?.title_en)}` : ""}`
    : currentTopic ? topicText(currentTopic.id, currentTopic.title_ru, currentTopic.title_en) : "";
  const voiceBusy = voiceState === "connecting" || voiceState === "recording" || voiceState === "transcribing";

  const stopVoice = useCallback(() => {
    voiceEpochRef.current += 1;
    voiceControllerRef.current?.abort();
    voiceControllerRef.current = undefined;
    if (voiceRef.current) { voiceRef.current.stop(); voiceRef.current = undefined; }
    voiceTimingRef.current = undefined;
    setVoiceState("idle");
  }, []);

  const interruptVoice = useCallback(() => {
    if (!voiceRef.current && !voiceControllerRef.current) return;
    stopVoice();
    setVoiceState("error");
    setError("app.recordingInterruptedPhraseAnswer");
  }, [stopVoice]);

  function showAndroidPanel(panel: number) {
    const pager = androidPagerRef.current;
    if (panel === 1 && initialExerciseTimingPendingRef.current) {
      initialExerciseTimingPendingRef.current = false;
      startUiTiming("first_phrase");
    }
    if (panel !== 1) interruptVoice();
    setAndroidPanel(panel);
    if (!isNative) {
      setView(panel === 2 ? "statistics" : panel === 3 ? "premium" : panel === 4 ? "settings" : "practice");
      return;
    }
    if (!pager) return;
    const left = panel * pager.clientWidth;
    if (typeof pager.scrollTo === "function") pager.scrollTo({ left, behavior: "auto" });
    else pager.scrollLeft = left;
  }

  useEffect(() => {
    androidBackHandlerRef.current = () => {
      if (androidPanel === 2 && statisticsPage === "phrases") {
        setStatisticsPage("activity");
      } else if (androidPanel !== 0) {
        showAndroidPanel(session && androidPanel > 1 ? 1 : 0);
      } else {
        interruptVoice();
        void CapacitorApp.exitApp().catch(() => undefined);
      }
    };
  });

  useEffect(() => {
    if (!isNative) return;
    let active = true;
    let handle: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener("backButton", () => {
      if (active) androidBackHandlerRef.current();
    }).then((listener) => {
      if (active) handle = listener;
      else void listener.remove().catch(() => undefined);
    }).catch(() => undefined);
    return () => {
      active = false;
      if (handle) void handle.remove().catch(() => undefined);
    };
  }, [isNative]);

  useEffect(() => {
    let active = true;
    const accountRequests = new Map<AbortController, number>();
    const onVisibilityChange = () => {
      if (active && document.visibilityState === "hidden") interruptVoice();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    let nativeListener: { remove: () => Promise<void> } | undefined;
    if (isNative) {
      void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (active && !isActive) interruptVoice();
        if (active && isActive) {
          void refreshAssistance();
          const epoch = ++accountRefreshEpochRef.current;
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 10_000);
          accountRequests.set(controller, timeout);
          void fetchCurrentUser(controller.signal).then(updated => {
            if (active && accountRefreshEpochRef.current === epoch) onAccountChange(updated);
          }).catch(() => undefined).finally(() => {
            window.clearTimeout(timeout);
            accountRequests.delete(controller);
          });
        }
      }).then((listener) => {
        if (active) nativeListener = listener;
        else void listener.remove().catch(() => undefined);
      }).catch(() => undefined);
    }
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (nativeListener) void nativeListener.remove().catch(() => undefined);
      for (const [controller, timeout] of accountRequests) {
        window.clearTimeout(timeout);
        controller.abort();
      }
      accountRequests.clear();
    };
  }, [interruptVoice, isNative, refreshAssistance, onAccountChange]);

  function showView(next: AppView) {
    if (next !== "practice") interruptVoice();
    setView(next);
    if (!isNative) setAndroidPanel(next === "statistics" ? 2 : next === "premium" ? 3 : next === "settings" || next === "admin" ? 4 : 1);
  }

  async function finishVoice() {
    const recorder = voiceRef.current;
    if (!recorder || !exercise) return;
    const epoch = voiceEpochRef.current;
    const exerciseId = exercise.id;
    const controller = new AbortController();
    voiceControllerRef.current = controller;
    setVoiceState("transcribing"); setError(undefined); setErrorDiagnosticId(undefined);
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
        setAnswer(transcript.review_required ? transcript.text : latinForEvaluation(transcript.text));
        if (transcript.review_required) voiceTimingRef.current = undefined;
        setHasTranscript(true);
        setAssistanceDraft(transcript.transcription_id || transcript.assistance_status ? { response: transcript, selected: (transcript.changes ?? []).flatMap((c, i) => c.action === "applied" ? [i] : []), edited: false } : undefined);
      }
      setVoiceState("idle");
    } catch (error) {
      if (voiceEpochRef.current !== epoch) return;
      unexpectedScriptStreakRef.current = error instanceof BackendError && error.code === "transcription_unexpected_script" ? unexpectedScriptStreakRef.current + 1 : 0;
      setTranscriptionBreakRecommended(unexpectedScriptStreakRef.current >= 3);
      recorder.stop(); voiceRef.current = undefined; voiceTimingRef.current = undefined;
      setVoiceState("error"); setErrorDiagnosticId(failureOf(error)?.diagnostic_id); setError(budgetPauseMessage(error) ?? transcriptionErrorMessage(error));
    } finally {
      if (voiceEpochRef.current === epoch) voiceControllerRef.current = undefined;
    }
  }

  async function startVoice() {
    if (!exercise || !voiceSupported) return;
    stopVoice(); voiceStartEditEpochRef.current = answerEditEpochRef.current;
    setError(undefined); setErrorDiagnosticId(undefined); setVoiceState("connecting");
    const epoch = voiceEpochRef.current;
    const recorder = new VoiceRecorder(); voiceRef.current = recorder;
    try { await recorder.start(); if (voiceEpochRef.current === epoch && voiceRef.current === recorder) setVoiceState("recording"); }
    catch { recorder.stop(); if (voiceEpochRef.current !== epoch) return; if (voiceRef.current === recorder) voiceRef.current = undefined; setVoiceState("error"); setError("app.couldNotAccessMicrophone"); }
  }

  function enterAnswerManually() {
    voiceTimingRef.current = undefined;
    setHasTranscript(true);
    setVoiceState("idle");
    setError(undefined); setErrorDiagnosticId(undefined);
  }

  async function startTraining(topicId: string) {
    startUiTiming("first_phrase");
    invalidateFlow();
    stopVoice(); setAnswer(""); setAssistanceDraft(undefined); setHasTranscript(false); setAttempt(undefined); setWordHints({}); setActiveHint(undefined);
    setSession(undefined); setExercise(undefined); setCompletedCount(0); setSessionComplete(false); setTopicExhausted(false);
    setPreparingPhrase(true); setError(undefined); setErrorDiagnosticId(undefined);
    const epoch = flowEpochRef.current;
    const controller = new AbortController();
    flowControllerRef.current = controller;
    try {
      const started = await startTrainingSession({ topic_id: topicId }, controller.signal);
      if (flowEpochRef.current !== epoch) return;
      setSession(started.session); setExercise(started.exercise);
      setCompletedCount(started.session.completed_count ?? 0);
      setStartupState("ready");
    } catch (requestError) {
      if (flowEpochRef.current !== epoch) return;
      setError(requestError instanceof BackendError && (requestError.code === "topic_empty" || requestError.status === 409)
        ? "app.topicHasNoPhrases"
        : "app.couldNotStartPractice");
    }
    finally { if (flowEpochRef.current === epoch) { flowControllerRef.current = undefined; setPreparingPhrase(false); } }
  }

  async function startReviewTraining() {
    if (isReviewMode && session && exercise && !sessionComplete) return;
    startUiTiming("first_phrase");
    invalidateFlow(); stopVoice();
    setSession(undefined); setExercise(undefined); setCompletedCount(0); setSessionComplete(false); setTopicExhausted(false);
    setSelectedTopic(undefined); setCustomTopic(""); setError(undefined); setErrorDiagnosticId(undefined);
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
      setSession(started.session); setExercise(started.exercise);
      setAnswer(""); setAssistanceDraft(undefined); setHasTranscript(false); setAttempt(undefined); setWordHints({}); setActiveHint(undefined);
      setStartupState("ready");
    } catch (requestError) {
      if (flowEpochRef.current !== epoch) return;
      if (requestError instanceof BackendError && requestError.code === "review_queue_empty") {
        reviewSummaryEpochRef.current += 1;
        setReviewPhraseCount(0);
      }
      setError(requestError instanceof BackendError && requestError.code === "review_queue_empty" ? "app.youHaveMasteredAll" : "app.couldNotStartPhrase");
    } finally { if (flowEpochRef.current === epoch) { flowControllerRef.current = undefined; setPreparingPhrase(false); } }
  }

  async function nextExercise() {
    if (!session || advancingRef.current) return;
    if (!isReviewMode && completedCount >= session.requested_length) { setSessionComplete(true); return; }
    startUiTiming("next_phrase");
    advancingRef.current = true;
    hintEpochRef.current += 1;
    stopVoice(); setAdvancing(true); setError(undefined); setErrorDiagnosticId(undefined);
    const epoch = flowEpochRef.current;
    const request = nextExerciseRef.current?.sessionId === session.id ? nextExerciseRef.current : undefined;
    const id = request?.requestId ?? nextRequestIdRef.current ?? requestId();
    nextRequestIdRef.current = id;
    const controller = request?.controller ?? new AbortController();
    flowControllerRef.current = controller;
    try {
      const next = await (request?.promise ?? fetchNextExercise(session.id, id, controller.signal));
      if (flowEpochRef.current !== epoch) return;
      nextExerciseRef.current = undefined; nextRequestIdRef.current = undefined;
      setExercise(next);
      wordHintsRef.current = {}; savedHintsRef.current.clear();
      setAnswer(""); setAssistanceDraft(undefined); setHasTranscript(false); setAttempt(undefined); setWordHints({}); setActiveHint(undefined);
    }
    catch (requestError) {
      if (flowEpochRef.current !== epoch) return;
      nextExerciseRef.current = undefined;
      if (requestError instanceof BackendError && requestError.code === "session_completed") {
        setSessionComplete(true);
      } else if (!isReviewMode && requestError instanceof BackendError && requestError.code === "topic_empty") {
        setTopicExhausted(true); setSessionComplete(true);
      } else if (isReviewMode && requestError instanceof BackendError && (requestError.code === "review_queue_empty" || requestError.status === 409)) {
        reviewSummaryEpochRef.current += 1;
        setSession(undefined); setExercise(undefined); setReviewPhraseCount(0);
        setAnswer(""); setAssistanceDraft(undefined); setHasTranscript(false); setAttempt(undefined); setWordHints({}); setActiveHint(undefined);
        setError("app.youHaveMasteredAll");
      } else setError("app.couldNotLoadNext");
    }
    finally { if (flowEpochRef.current === epoch) { advancingRef.current = false; flowControllerRef.current = undefined; setAdvancing(false); } }
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
    const hintedWords = Object.keys(wordHintsRef.current).sort();
    const assistance = assistanceDraft?.response.transcription_id ? { transcription_id: assistanceDraft.response.transcription_id, accepted_transcription_changes: assistanceDraft.selected.filter(i => assistanceDraft.response.changes![i].action === "suggested") } : undefined;
    const payload = JSON.stringify({ exerciseId: exercise.id, transcript, timing, hintedWords, assistance });
    const id = pendingAttemptRef.current?.payload === payload ? pendingAttemptRef.current.id : requestId();
    pendingAttemptRef.current = { payload, id };
    checkingRef.current = true;
    setChecking(true); setError(undefined); setErrorDiagnosticId(undefined); setActiveHint(undefined);
    const epoch = flowEpochRef.current;
    const controller = new AbortController();
    flowControllerRef.current = controller;
    try {
      const completed = await submitAttempt(exercise.id, transcript, timing, hintedWords, id, controller.signal, assistance);
      if (flowEpochRef.current !== epoch) return;
      pendingAttemptRef.current = undefined;
      setAttempt(completed);
      celebrate(completed);
      hintEpochRef.current += 1;
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
        void fetchTopics().then((availableTopics) => { if (flowEpochRef.current === epoch) setTopics(availableTopics); }).catch(() => undefined);
        if (!completed.daily_usage) void fetchCurrentUser().then((updated) => { if (flowEpochRef.current === epoch && accountRefreshEpochRef.current === accountEpoch) onAccountChange(updated); }).catch(() => undefined);
      };
      refreshSideData();
    }
    catch (requestError) {
      if (flowEpochRef.current !== epoch) return;
      const failure = failureOf(requestError);
      const budgetPause = budgetPauseMessage(requestError);
      setErrorDiagnosticId(failure?.diagnostic_id);
      if (budgetPause) setError(budgetPause);
      else if (failure) setError({
        external_model: "app.externalCheckingServiceCould",
        response_parse: "app.checkingServiceResponseCould",
        response_return: "app.checkingResultCouldNot",
      }[failure.kind]);
      else if (requestError instanceof BackendError && requestError.status === 429) setError(t("app.dailyLimitReached", { time: resetTimeLabel(account.daily_usage.resets_at) }));
      else if (requestError instanceof BackendError && requestError.code === "transcript_unexpected_script") setError("app.transcriptContainsLettersOutside");
      else if (requestError instanceof BackendError && requestError.code === "analysis_unavailable") setError("app.checkingServiceTemporarilyUnavailable");
      else if (requestError instanceof BackendError && requestError.code === "attempt_in_progress") setError("app.answerStillBeingChecked");
      else if (requestError instanceof BackendError && requestError.code === "attempt_request_conflict") { pendingAttemptRef.current = undefined; setError("app.answerChangedWhileWas"); }
      else setError("app.couldNotCheckAnswer");
    }
    finally { if (flowEpochRef.current === epoch) { checkingRef.current = false; flowControllerRef.current = undefined; setChecking(false); } }
  }

  function resetTraining() {
    invalidateFlow();
    stopVoice(); setView("practice"); setSession(undefined); setExercise(undefined);
    setAnswer(""); setAssistanceDraft(undefined); setHasTranscript(false); setAttempt(undefined); setError(undefined); setErrorDiagnosticId(undefined); setWordHints({}); setActiveHint(undefined); setCompletedCount(0); setSessionComplete(false); setTopicExhausted(false);
  }

  function returnToTopics() {
    resetTraining();
    setSelectedTopic(undefined); setCustomTopic("");
    if (mobileLayout) showAndroidPanel(0);
  }

  const reviewFinished = error === "app.youHaveMasteredAll";

  function selectTopic(topicId: string) {
    if (session?.topic.id === topicId && exercise && !sessionComplete) return;
    if (session || preparingPhrase || sessionComplete) resetTraining();
    setSelectedTopic(topicId); setCustomTopic("");
    setSession(undefined); setExercise(undefined);
    if (topics.find((topic) => topic.id === topicId)?.phrase_count) void startTraining(topicId);
  }

  async function showWordHint(word: string, localHint?: Pick<WordHint, "word_ru" | "translation_tr">) {
    if (!exercise || checkingRef.current) return;
    const normalized = word.toLocaleLowerCase("ru-RU");
    setActiveHint(current => current === normalized ? undefined : normalized);
    const requestKey = `${hintEpochRef.current}:${normalized}`;
    if (hintRequestsRef.current.has(requestKey) || savedHintsRef.current.has(normalized)) return;
    const prepared = localHint ?? exercise.word_hints?.find((hint) => hint.word_ru.toLocaleLowerCase("ru-RU") === normalized);
    const epoch = flowEpochRef.current;
    const hintEpoch = hintEpochRef.current;
    if (prepared && !wordHintsRef.current[normalized]) {
      const opened = { ...prepared, is_learning: true };
      wordHintsRef.current = { ...wordHintsRef.current, [normalized]: opened };
      setWordHints(wordHintsRef.current);
    }
    if (wordHintsRef.current[normalized]) setError(undefined); setErrorDiagnosticId(undefined);
    const controller = new AbortController();
    hintRequestsRef.current.set(requestKey, controller);
    try {
      const hint = await revealWordHint(exercise.id, word, controller.signal);
      if (flowEpochRef.current === epoch && hintEpochRef.current === hintEpoch) {
        savedHintsRef.current.add(normalized);
        wordHintsRef.current = { ...wordHintsRef.current, [normalized]: hint };
        setWordHints(wordHintsRef.current);
      }
    } catch {
      if (flowEpochRef.current === epoch && hintEpochRef.current === hintEpoch) setError(
        wordHintsRef.current[normalized]
          ? t("app.hintNotSaved", { word })
          : t("app.hintUnavailable", { word }),
      );
    } finally {
      if (hintRequestsRef.current.get(requestKey) === controller) hintRequestsRef.current.delete(requestKey);
    }
  }

  function refreshCustomContent() {
    void Promise.allSettled([fetchTopics().then(setTopics), refreshReviewSummary()]).then(results => {
      if (results.some(result => result.status === "rejected")) setError("app.couldNotRefreshCatalog");
    });
  }

  const premiumActive = account.access_tier === "premium" || account.role === "admin";
  const mainTopics = premiumActive ? topics.filter(topic => !topic.is_custom) : topics;
  const personalTopics = premiumActive ? sortedPersonalTopics(topics) : [];
  const orderedTopics = [...mainTopics, ...personalTopics];

  const premiumPanel = <PremiumView ui={premiumUi} active={premiumActive} topics={topics}
      onPaymentReported={async () => { const updated = await fetchCurrentUser(); onAccountChange(updated); refreshCustomContent(); }}
      onTopicCreated={topic => setTopics(current => [...current.filter(item => item.id !== topic.id), topic])}
      onChanged={refreshCustomContent} onDeleted={topicId => {
        interruptVoice(); resetTraining(); setView("premium");
        if (topicId) { setTopics(current => current.filter(topic => topic.id !== topicId)); if (selectedTopic === topicId) setSelectedTopic(undefined); }
        refreshCustomContent();
      }} />;

  function renderPractice(compact: boolean) {
    if (exercise && !exerciseSource(exercise)) return <div className="practice-card grid content-start gap-4 rounded-card border border-line bg-surface p-6 text-ink">
      <p className="error m-0 text-sm text-danger" role="alert">{t("app.phraseUnavailableSelectedLanguage")}</p>
      <button type="button" className="justify-self-start min-h-11 cursor-pointer rounded-control border border-line bg-surface-raised px-4 text-sm font-semibold text-ink hover:border-line-strong" onClick={() => window.location.reload()}>{t("app.retryLoading")}</button>
    </div>;
    const phrase = <InteractivePhrase exercise={exercise} wordHints={wordHints} activeHint={activeHint}
      hintsVisible={mobileLayout ? visiblePanel === 1 : view === "practice"} disabled={checking || Boolean(attempt)}
      onDismissHint={() => setActiveHint(undefined)} onRevealHint={(word, localHint) => void showWordHint(word, localHint)} />;
    const localized = exercise ? exerciseSource(exercise) : undefined;
    return <PracticeCard compact={compact} native={isNative} phrase={phrase} topicTitle={phraseTopicTitle} attempt={attempt}
      hasHints={Object.keys(localized?.hints ?? {}).length > 0} source={localized?.source}
      progress={!isReviewMode && session ? { completed: completedCount, total: session.requested_length } : undefined}
      pauseResumeLabel={resetTimeLabel(account.daily_usage.resets_at)}
      answer={answer} onAnswerEdit={text => { answerEditEpochRef.current += 1; voiceTimingRef.current = undefined; setAssistanceDraft(current => current ? { ...current, edited: true } : undefined); setAnswer(text); }}
      onSubmit={checkAnswer} checking={checking} hasTranscript={hasTranscript} voiceState={voiceState} voiceSupported={voiceSupported} voiceBusy={voiceBusy}
      assistanceDraft={assistanceDraft} onToggleAssistance={toggleTranscriptionChange} transcriptionBreakRecommended={transcriptionBreakRecommended}
      onEnterManually={enterAnswerManually} onStartVoice={() => void startVoice()} onFinishVoice={() => void finishVoice()} onStopVoice={stopVoice}
      error={error} errorDiagnosticId={errorDiagnosticId} reward={reward} advancing={advancing}
      done={!isReviewMode && completedCount >= (session?.requested_length ?? 10)} onNext={() => void nextExercise()} />;
  }

  if (startupState === "loading") return <main className={cn(authPage, "auth-page--loading")}><PhraseLoading /></main>;

  const topicGrid = (compact: boolean) => <TopicGrid compact={compact} topics={orderedTopics} personalStart={premiumActive ? mainTopics.length : undefined}
    selectedTopic={customTopic ? undefined : selectedTopic} reviewSelected={isReviewMode} reviewCount={reviewPhraseCount}
    onReview={() => { if (compact) showAndroidPanel(1); void startReviewTraining(); }}
    onSelect={topicId => { selectTopic(topicId); if (compact) showAndroidPanel(1); }} />;
  const doneTitle = topicExhausted ? "app.allTopicPhrasesCompleted" : "app.practiceComplete";
  const doneSummary = topicExhausted ? t("app.topicExhausted", { count: completedCount }) : t("app.sessionDone", { completed: completedCount, count: session?.requested_length ?? 10 });
  const stageTitle = customTopic.trim() || (currentTopic ? topicText(currentTopic.id, currentTopic.title_ru, currentTopic.title_en) : t("app.chooseTopic"));
  const stage = (compact: boolean) => preparingPhrase && !session ? <PhraseLoading /> : sessionComplete
    ? <PracticeDone compact={compact} title={doneTitle} summary={doneSummary} onRestart={() => { resetTraining(); if (mobileLayout) showAndroidPanel(0); }} />
    : !session && reviewFinished ? <ReviewComplete compact={compact} message={t(error)} onHome={returnToTopics} />
    : !session ? <WelcomeCard compact={compact} icon={topicIconName(currentTopic?.id)} title={stageTitle}
      description={selectedTopicData?.phrase_count === 0 ? "app.topicEmptyAddPhrases" : currentTopic?.description_ru || "app.topicsWillLoadOnce"}
      onChooseTopic={compact && !isNative ? returnToTopics : undefined}
      retry={!compact && (startupState === "fallback" || backendState === "offline") ? retryCatalog : undefined} error={error} />
    : renderPractice(compact);
  const settings = <SettingsView account={account} onSignOut={onSignOut} assistanceEnabled={assistanceEnabled} assistanceSaving={assistanceSaving} assistanceError={assistanceError} onAssistanceChange={enabled => { interruptVoice(); void changeAssistance(enabled); }} />;
  const secondaryButton = "mobile-admin-link my-2 min-h-11 w-full cursor-pointer rounded-control border border-line bg-surface-raised p-2.5 text-ink hover:border-line-strong";

  if (mobileLayout) {
    // Native Android scrolls between panels; the mobile browser shows one panel at a time above the keyboard.
    const page = cn("android-page min-w-0 overflow-y-auto overflow-x-hidden bg-canvas text-ink",
      isNative ? "h-full w-full flex-[0_0_100%] snap-start snap-always px-[max(0.9rem,calc((100%-560px)/2))] pb-[calc(1.3rem+env(safe-area-inset-bottom))] pt-[1.15rem]"
        : "h-full overscroll-contain px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 in-[.mobile-web-shell--short]:py-1");
    return (
      <div ref={isNative ? undefined : mobileShellRef} className={cn("android-shell overflow-hidden bg-canvas text-ink", isNative ? "h-dvh" : "mobile-web-shell fixed inset-x-0 top-(--mobile-top,0px) h-(--mobile-height,100dvh) w-full")}>
        <RewardOverlay reward={reward?.kind === "twenty" ? reward : undefined} />
        <MobileHeader panel={visiblePanel} premiumActive={premiumActive} webShell={!isNative} onShow={showAndroidPanel} />

        <div
          className={cn("android-pager w-full", isNative ? "flex h-[calc(100dvh-var(--spacing-phone-header)-env(safe-area-inset-top))] snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "block h-[calc(100%-var(--spacing-phone-header))] overflow-hidden")}
          aria-label={t("app.panelContent")}
          ref={androidPagerRef}
          onScroll={(event) => {
            if (!isNative) return;
            const width = event.currentTarget.clientWidth;
            if (width) {
              const panel = Math.round(event.currentTarget.scrollLeft / width);
              if (panel === 1 && initialExerciseTimingPendingRef.current) {
                initialExerciseTimingPendingRef.current = false;
                startUiTiming("first_phrase");
              }
              if (panel !== 1) interruptVoice();
              setAndroidPanel(panel);
            }
          }}
        >
          <section className={cn(page, "android-topics-page", isNative ? "pt-3" : "flex flex-col gap-2 [&>.android-topic-list]:min-h-0 [&>.android-topic-list]:flex-1 [&>.android-topic-list]:overflow-y-auto [&>.android-topic-list]:p-px [&_.android-topic]:min-h-23")} hidden={!isNative && visiblePanel !== 0} aria-label={t("app.chooseTopicRegion")}>
            {topicGrid(true)}
            {(startupState === "fallback" || backendState === "offline") && <div className="android-error mt-3 text-center text-sm text-danger" role="alert">{t(startupState === "fallback" ? error : "app.noConnectionService")} <button className="ml-1 cursor-pointer rounded-control border border-line bg-surface-raised px-3 py-1.5 text-ink hover:border-line-strong" type="button" onClick={retryCatalog}>{t("app.retryLoading")}</button></div>}
          </section>

          <section className={cn(page, "android-training-page grid")} hidden={!isNative && visiblePanel !== 1} aria-label={t("app.nav.training")}>
            {stage(true)}
          </section>

          <section className={cn(page, "android-statistics-page", isNative && "pt-1.5")} hidden={!isNative && visiblePanel !== 2} aria-label={t("app.nav.statistics")}>
            {visiblePanel === 2 && <DeferredPanel load={loadStatistics} panelProps={{ page: statisticsPage, onPageChange: setStatisticsPage, compact: true }} label={t("app.sections.statistics")} />}
          </section>
          <section className={cn(page, "android-premium-page")} hidden={!isNative && visiblePanel !== 3}>
            {visiblePanel === 3 && premiumPanel}
          </section>
          <section className={cn(page, "android-settings-page")} hidden={!isNative && visiblePanel !== 4} aria-label={t("app.nav.appSettings")}>
            {!isNative && view === "admin" ? <><button className={secondaryButton} type="button" onClick={() => showAndroidPanel(4)}>{t("app.backToSettings")}</button><DeferredPanel load={loadAdminUsers} panelProps={{}} label={t("app.sections.users")} /></> : <>
            {settings}
            {!isNative && account.role === "admin" && <button className={secondaryButton} type="button" onClick={() => setView("admin")}>{t("app.nav.users")}</button>}
            </>}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen bg-canvas pb-[env(safe-area-inset-bottom)] text-ink">
      <RewardOverlay reward={reward?.kind === "twenty" ? reward : undefined} />
      <AppHeader view={view} premiumActive={premiumActive} showAdmin={account.role === "admin" && !Capacitor.isNativePlatform()} backendState={backendState}
        onHome={resetTraining} onShow={showView} onRetry={retryCatalog} />

      {view === "admin" ? <DeferredPanel key="admin" load={loadAdminUsers} panelProps={{}} label={t("app.sections.users")} /> : view === "statistics" ? <DeferredPanel key="statistics" load={loadStatistics} panelProps={{ page: statisticsPage, onPageChange: setStatisticsPage }} label={t("app.sections.statistics")} /> : view === "premium" ? premiumPanel : view === "settings" ? settings : (
        <main className="workspace mx-auto grid min-h-[calc(100vh-4rem)] max-w-workspace grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-workspace-gap px-gutter pb-6 pt-4">
          <aside className="topics-panel flex min-h-0 flex-col gap-4 rounded-card border border-line bg-surface p-4">
            <div className="panel-heading grid gap-1.5 px-0.5">
              <h2 className="m-0 font-display text-xl font-bold text-ink">{t("app.practiceTopics")}</h2>
              <p className="m-0 text-sm leading-normal text-ink-muted">{t("app.chooseSituationStartSpeaking")}</p>
            </div>
            {topicGrid(false)}
            <div className="topics-panel__note mt-auto flex items-center gap-3 border-t border-line px-1 pt-4 text-caption text-ink-muted"><span className="text-accent"><Icon name="message" /></span><span>{t("app.everyShortConversationBuilds")}</span></div>
          </aside>

          <section className={cn("practice-stage grid min-w-0 content-start gap-4", preparingPhrase && !session && "is-preparing content-stretch [&>.phrase-loading]:min-h-full [&>.phrase-loading]:w-full")} aria-label={t("app.nav.practice")}>
            {stage(false)}
          </section>
        </main>
      )}
    </div>
  );
}
