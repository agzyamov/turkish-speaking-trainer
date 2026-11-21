import { t, useLanguage, topicText } from "./i18n";
import { exerciseSource } from "./exerciseSource";
import { useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import { DeferredPanel } from "./DeferredPanel";
import { fetchCurrentUser } from "./api/users";
import type { CurrentUser } from "./types/auth";
import { LegalPage } from "./LegalPage";
import { useAssistancePreference } from "./useAssistancePreference";
import { useMobileLayout } from "./useMobileLayout";
import { SettingsView } from "./SettingsView";
import { PremiumView, type PremiumUiState } from "./PremiumView";
import { sortedPersonalTopics } from "./personalTopics";
import { RewardOverlay } from "./RewardOverlay";
import { finishUiTimingWhenVisible, startUiTiming } from "./performance";
import "./index.css";
import { Icon } from "./shared/ui/icon";
import { PhraseLoading } from "./features/practice/PhraseLoading";
import { InteractivePhrase } from "./features/practice/InteractivePhrase";
import { PracticeCard } from "./features/practice/PracticeCard";
import { resetTimeLabel, usePracticeSession } from "./features/practice/usePracticeSession";
import { AuthGate } from "./features/auth/AuthGate";
import { QueryProvider } from "./shared/lib/QueryProvider";
import { AppHeader, MobileHeader, type AppView } from "./features/shell/AppHeader";
import { TopicGrid } from "./features/shell/TopicGrid";
import { topicIconName } from "./features/shell/topicIcons";
import { PracticeDone, ReviewComplete, WelcomeCard } from "./features/shell/StageStates";
import { cn } from "./shared/lib/utils";
import { authPage } from "./features/auth/authStyles";

const loadStatistics = (retryUrl?: string) =>
  (retryUrl ? (import(/* @vite-ignore */ retryUrl) as Promise<typeof import("./features/statistics/StatisticsView")>) : import("./features/statistics/StatisticsView")).then(({ StatisticsView }) => ({
    default: StatisticsView,
  }));
const loadAdminUsers = (retryUrl?: string) =>
  (retryUrl ? (import(/* @vite-ignore */ retryUrl) as Promise<typeof import("./AdminUsersView")>) : import("./AdminUsersView")).then(({ AdminUsersView }) => ({ default: AdminUsersView }));

export default function App() {
  const language = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  if (window.location.pathname === "/privacy") return <LegalPage kind="privacy" />;
  if (window.location.pathname === "/terms") return <LegalPage kind="terms" />;
  if (window.location.pathname === "/delete-account") return <LegalPage kind="delete-account" />;
  return (
    <AuthGate>
      {(account, onAccountChange, onSignOut) => (
        <QueryProvider key={account.id}>
          <TrainerApp account={account} onAccountChange={onAccountChange} onSignOut={onSignOut} />
        </QueryProvider>
      )}
    </AuthGate>
  );
}

function TrainerApp({ account, onAccountChange, onSignOut }: { account: CurrentUser; onAccountChange: (account: CurrentUser) => void; onSignOut: () => void }) {
  const [view, setView] = useState<AppView>("practice");
  const {
    enabled: assistanceEnabled,
    saving: assistanceSaving,
    error: assistanceError,
    change: changeAssistance,
    refresh: refreshAssistance,
  } = useAssistancePreference(account.assistance_enabled ?? false);
  const {
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
  } = usePracticeSession({ account, onAccountChange, assistanceEnabled, onReset: () => setView("practice") });
  const androidPagerRef = useRef<HTMLDivElement | null>(null);
  const presentedExerciseRef = useRef<string | undefined>(undefined);
  const [androidPanel, setAndroidPanel] = useState(() => (Capacitor.isNativePlatform() ? 0 : 1));
  const [statisticsPage, setStatisticsPage] = useState<"activity" | "phrases">("activity");
  const androidBackHandlerRef = useRef<() => void>(() => undefined);
  const isNative = Capacitor.isNativePlatform();
  const { compact, shell: mobileShellRef } = useMobileLayout(startupState !== "loading" && !isNative);
  const mobileLayout = isNative || compact;
  const visiblePanel = !isNative && view !== "practice" ? (view === "statistics" ? 2 : view === "premium" ? 3 : 4) : androidPanel;
  // Section state that must survive the phone/desktop layout switch (which remounts the visible section)
  // but not leaving the section: it resets when another panel is shown.
  const premiumUi = useState<PremiumUiState>({ paymentOpen: false, paymentReported: false });
  const [, setPremiumUi] = premiumUi;
  const [shownPanel, setShownPanel] = useState(visiblePanel);
  if (shownPanel !== visiblePanel) {
    // React's "reset state when a value changes" pattern, during render
    setShownPanel(visiblePanel);
    if (visiblePanel !== 3) setPremiumUi({ paymentOpen: false, paymentReported: false });
  }

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
    })
      .then(listener => {
        if (active) handle = listener;
        else void listener.remove().catch(() => undefined);
      })
      .catch(() => undefined);
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
          void fetchCurrentUser(controller.signal)
            .then(updated => {
              if (active && accountRefreshEpochRef.current === epoch) onAccountChange(updated);
            })
            .catch(() => undefined)
            .finally(() => {
              window.clearTimeout(timeout);
              accountRequests.delete(controller);
            });
        }
      })
        .then(listener => {
          if (active) nativeListener = listener;
          else void listener.remove().catch(() => undefined);
        })
        .catch(() => undefined);
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
  }, [interruptVoice, isNative, refreshAssistance, onAccountChange, accountRefreshEpochRef]);

  function showView(next: AppView) {
    if (next !== "practice") interruptVoice();
    setView(next);
    if (!isNative) setAndroidPanel(next === "statistics" ? 2 : next === "premium" ? 3 : next === "settings" || next === "admin" ? 4 : 1);
  }

  function returnToTopics() {
    resetTraining();
    setSelectedTopic(undefined);
    setCustomTopic("");
    if (mobileLayout) showAndroidPanel(0);
  }

  const premiumActive = account.access_tier === "premium" || account.role === "admin";
  const mainTopics = premiumActive ? topics.filter(topic => !topic.is_custom) : topics;
  const personalTopics = premiumActive ? sortedPersonalTopics(topics) : [];
  const orderedTopics = [...mainTopics, ...personalTopics];

  const premiumPanel = (
    <PremiumView
      ui={premiumUi}
      active={premiumActive}
      topics={topics}
      onPaymentReported={async () => {
        const updated = await fetchCurrentUser();
        onAccountChange(updated);
        refreshCustomContent();
      }}
      onTopicCreated={topic => setTopics(current => [...current.filter(item => item.id !== topic.id), topic])}
      onChanged={refreshCustomContent}
      onDeleted={topicId => {
        interruptVoice();
        resetTraining();
        setView("premium");
        if (topicId) {
          setTopics(current => current.filter(topic => topic.id !== topicId));
          if (selectedTopic === topicId) setSelectedTopic(undefined);
        }
        refreshCustomContent();
      }}
    />
  );

  function renderPractice(compact: boolean) {
    if (exercise && !exerciseSource(exercise))
      return (
        <div className="practice-card grid content-start gap-4 rounded-card border border-line bg-surface p-6 text-ink">
          <p className="error m-0 text-sm text-danger" role="alert">
            {t("app.phraseUnavailableSelectedLanguage")}
          </p>
          <button
            type="button"
            className="justify-self-start min-h-11 cursor-pointer rounded-control border border-line bg-surface-raised px-4 text-sm font-semibold text-ink hover:border-line-strong"
            onClick={() => window.location.reload()}
          >
            {t("app.retryLoading")}
          </button>
        </div>
      );
    const phrase = (
      <InteractivePhrase
        exercise={exercise}
        wordHints={hints.wordHints}
        activeHint={hints.activeHint}
        hintsVisible={mobileLayout ? visiblePanel === 1 : view === "practice"}
        disabled={checking || Boolean(attempt)}
        onDismissHint={hints.dismiss}
        onRevealHint={(word, localHint) => void hints.reveal(word, localHint)}
      />
    );
    const localized = exercise ? exerciseSource(exercise) : undefined;
    return (
      <PracticeCard
        compact={compact}
        native={isNative}
        phrase={phrase}
        topicTitle={phraseTopicTitle}
        attempt={attempt}
        hasHints={Object.keys(localized?.hints ?? {}).length > 0}
        source={localized?.source}
        progress={!isReviewMode && session ? { completed: completedCount, total: session.requested_length } : undefined}
        pauseResumeLabel={resetTimeLabel(account.daily_usage.resets_at)}
        answer={answer}
        onAnswerEdit={text => {
          answerEditEpochRef.current += 1;
          voiceTimingRef.current = undefined;
          setAssistanceDraft(current => (current ? { ...current, edited: true } : undefined));
          setAnswer(text);
        }}
        onSubmit={checkAnswer}
        checking={checking}
        hasTranscript={hasTranscript}
        voiceState={voiceState}
        voiceSupported={voiceSupported}
        voiceBusy={voiceBusy}
        assistanceDraft={assistanceDraft}
        onToggleAssistance={toggleTranscriptionChange}
        transcriptionBreakRecommended={transcriptionBreakRecommended}
        onEnterManually={enterAnswerManually}
        onStartVoice={() => void startVoice()}
        onFinishVoice={() => void finishVoice()}
        onStopVoice={stopVoice}
        error={error}
        errorDiagnosticId={errorDiagnosticId}
        reward={reward}
        advancing={advancing}
        done={!isReviewMode && completedCount >= (session?.requested_length ?? 10)}
        onNext={() => void nextExercise()}
      />
    );
  }

  if (startupState === "loading")
    return (
      <main className={cn(authPage, "auth-page--loading")}>
        <PhraseLoading />
      </main>
    );

  const topicGrid = (compact: boolean) => (
    <TopicGrid
      compact={compact}
      topics={orderedTopics}
      personalStart={premiumActive ? mainTopics.length : undefined}
      selectedTopic={customTopic ? undefined : selectedTopic}
      reviewSelected={isReviewMode}
      reviewCount={reviewPhraseCount}
      onReview={() => {
        if (compact) showAndroidPanel(1);
        void startReviewTraining();
      }}
      onSelect={topicId => {
        selectTopic(topicId);
        if (compact) showAndroidPanel(1);
      }}
    />
  );
  const doneTitle = topicExhausted ? "app.allTopicPhrasesCompleted" : "app.practiceComplete";
  const doneSummary = topicExhausted ? t("app.topicExhausted", { count: completedCount }) : t("app.sessionDone", { completed: completedCount, count: session?.requested_length ?? 10 });
  const stageTitle = customTopic.trim() || (currentTopic ? topicText(currentTopic.id, currentTopic.title_ru, currentTopic.title_en) : t("app.chooseTopic"));
  const stage = (compact: boolean) =>
    preparingPhrase && !session ? (
      <PhraseLoading />
    ) : sessionComplete ? (
      <PracticeDone
        compact={compact}
        title={doneTitle}
        summary={doneSummary}
        onRestart={() => {
          resetTraining();
          if (mobileLayout) showAndroidPanel(0);
        }}
      />
    ) : !session && reviewFinished ? (
      <ReviewComplete compact={compact} message={t(error)} onHome={returnToTopics} />
    ) : !session ? (
      <WelcomeCard
        compact={compact}
        icon={topicIconName(currentTopic?.id)}
        title={stageTitle}
        description={selectedTopicData?.phrase_count === 0 ? "app.topicEmptyAddPhrases" : currentTopic?.description_ru || "app.topicsWillLoadOnce"}
        onChooseTopic={compact && !isNative ? returnToTopics : undefined}
        retry={!compact && (startupState === "fallback" || backendState === "offline") ? retryCatalog : undefined}
        error={error}
      />
    ) : (
      renderPractice(compact)
    );
  const settings = (
    <SettingsView
      account={account}
      onSignOut={onSignOut}
      assistanceEnabled={assistanceEnabled}
      assistanceSaving={assistanceSaving}
      assistanceError={assistanceError}
      onAssistanceChange={enabled => {
        interruptVoice();
        void changeAssistance(enabled);
      }}
    />
  );
  const secondaryButton = "mobile-admin-link my-2 min-h-11 w-full cursor-pointer rounded-control border border-line bg-surface-raised p-2.5 text-ink hover:border-line-strong";

  if (mobileLayout) {
    // Native Android scrolls between panels; the mobile browser shows one panel at a time above the keyboard.
    const page = cn(
      "android-page min-w-0 overflow-y-auto overflow-x-hidden bg-canvas text-ink",
      isNative
        ? "h-full w-full flex-[0_0_100%] snap-start snap-always px-[max(0.9rem,calc((100%-560px)/2))] pb-[calc(1.3rem+env(safe-area-inset-bottom))] pt-[1.15rem]"
        : "h-full overscroll-contain px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 in-[.mobile-web-shell--short]:py-1",
    );
    return (
      <div
        ref={isNative ? undefined : mobileShellRef}
        className={cn("android-shell overflow-hidden bg-canvas text-ink", isNative ? "h-dvh" : "mobile-web-shell fixed inset-x-0 top-(--mobile-top,0px) h-(--mobile-height,100dvh) w-full")}
      >
        <RewardOverlay reward={reward?.kind === "twenty" ? reward : undefined} />
        <MobileHeader panel={visiblePanel} premiumActive={premiumActive} webShell={!isNative} onShow={showAndroidPanel} />

        <div
          className={cn(
            "android-pager w-full",
            isNative
              ? "flex h-[calc(100dvh-var(--spacing-phone-header)-env(safe-area-inset-top))] snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "block h-[calc(100%-var(--spacing-phone-header))] overflow-hidden",
          )}
          aria-label={t("app.panelContent")}
          ref={androidPagerRef}
          onScroll={event => {
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
          <section
            className={cn(
              page,
              "android-topics-page",
              isNative
                ? "pt-3"
                : "flex flex-col gap-2 [&>.android-topic-list]:min-h-0 [&>.android-topic-list]:flex-1 [&>.android-topic-list]:overflow-y-auto [&>.android-topic-list]:p-px [&_.android-topic]:min-h-23",
            )}
            hidden={!isNative && visiblePanel !== 0}
            aria-label={t("app.chooseTopicRegion")}
          >
            {topicGrid(true)}
            {(startupState === "fallback" || backendState === "offline") && (
              <div className="android-error mt-3 text-center text-sm text-danger" role="alert">
                {t(startupState === "fallback" ? error : "app.noConnectionService")}{" "}
                <button className="ml-1 cursor-pointer rounded-control border border-line bg-surface-raised px-3 py-1.5 text-ink hover:border-line-strong" type="button" onClick={retryCatalog}>
                  {t("app.retryLoading")}
                </button>
              </div>
            )}
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
            {!isNative && view === "admin" ? (
              <>
                <button className={secondaryButton} type="button" onClick={() => showAndroidPanel(4)}>
                  {t("app.backToSettings")}
                </button>
                <DeferredPanel load={loadAdminUsers} panelProps={{}} label={t("app.sections.users")} />
              </>
            ) : (
              <>
                {settings}
                {!isNative && account.role === "admin" && (
                  <button className={secondaryButton} type="button" onClick={() => setView("admin")}>
                    {t("app.nav.users")}
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen bg-canvas pb-[env(safe-area-inset-bottom)] text-ink">
      <RewardOverlay reward={reward?.kind === "twenty" ? reward : undefined} />
      <AppHeader
        view={view}
        premiumActive={premiumActive}
        showAdmin={account.role === "admin" && !Capacitor.isNativePlatform()}
        backendState={backendState}
        onHome={resetTraining}
        onShow={showView}
        onRetry={retryCatalog}
      />

      {view === "admin" ? (
        <DeferredPanel key="admin" load={loadAdminUsers} panelProps={{}} label={t("app.sections.users")} />
      ) : view === "statistics" ? (
        <DeferredPanel key="statistics" load={loadStatistics} panelProps={{ page: statisticsPage, onPageChange: setStatisticsPage }} label={t("app.sections.statistics")} />
      ) : view === "premium" ? (
        premiumPanel
      ) : view === "settings" ? (
        settings
      ) : (
        <main className="workspace mx-auto grid min-h-[calc(100vh-4rem)] max-w-workspace grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-workspace-gap px-gutter pb-6 pt-4">
          <aside className="topics-panel flex min-h-0 flex-col gap-4 rounded-card border border-line bg-surface p-4">
            <div className="panel-heading grid gap-1.5 px-0.5">
              <h2 className="m-0 font-display text-xl font-bold text-ink">{t("app.practiceTopics")}</h2>
              <p className="m-0 text-sm leading-normal text-ink-muted">{t("app.chooseSituationStartSpeaking")}</p>
            </div>
            {topicGrid(false)}
            <div className="topics-panel__note mt-auto flex items-center gap-3 border-t border-line px-1 pt-4 text-caption text-ink-muted">
              <span className="text-accent">
                <Icon name="message" />
              </span>
              <span>{t("app.everyShortConversationBuilds")}</span>
            </div>
          </aside>

          <section
            className={cn("practice-stage grid min-w-0 content-start gap-4", preparingPhrase && !session && "is-preparing content-stretch [&>.phrase-loading]:min-h-full [&>.phrase-loading]:w-full")}
            aria-label={t("app.nav.practice")}
          >
            {stage(false)}
          </section>
        </main>
      )}
    </div>
  );
}
