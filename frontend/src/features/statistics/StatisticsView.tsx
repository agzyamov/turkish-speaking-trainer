import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { t, getLocale, topicText } from "../../i18n";
import { fetchMonthlyStatistics, fetchPhraseStatistics, fetchPhraseTopics } from "../../api/statistics";
import { cn } from "../../shared/lib/utils";
import { GoldStar } from "./GoldStar";

const weekDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(day => `common.weekdays.${day}`);
type PageSize = "20" | "50";
type StatisticsPage = "activity" | "phrases";

function monthKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(value: Date): string {
  return `${monthKey(value)}-${String(value.getDate()).padStart(2, "0")}`;
}

function currentWeek(): Date[] {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
}

function formatReviewDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const card = "rounded-card border border-line bg-surface text-ink";
const secondaryButton = cn(
  "cursor-pointer rounded-control border border-line bg-surface-raised px-4 py-2.5 font-semibold text-ink-soft transition-colors duration-(--duration-quick) hover:border-line-strong hover:text-ink disabled:cursor-default disabled:opacity-40 disabled:hover:border-line",
  focusRing,
);
const select = cn(
  "min-w-0 cursor-pointer rounded-control border border-line bg-surface-raised px-3 py-2 text-ink [color-scheme:light] hover:border-line-strong [&>option]:bg-surface-raised [&>option]:text-ink",
  focusRing,
);
const cardHeading = "m-0 font-display text-xl font-bold text-ink";
const eyebrow = "m-0 text-micro font-semibold uppercase tracking-widest text-accent";
// Legend markers reuse the day-cell classes so the legend always matches the calendar.
const activeDay = "border-success/60 bg-success/18";
const intensiveDay = "border-reward ring-1 ring-inset ring-reward/45";

function StatusPanel({ role, children }: { role?: "status" | "alert"; children: ReactNode }) {
  return (
    <div className={cn("statistics-state grid min-h-[22rem] place-items-center content-center gap-4 p-6 text-center text-ink-muted", card)} role={role}>
      {children}
    </div>
  );
}

function RetryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button className={secondaryButton} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function PhraseList({ topicId, compact }: { topicId: string; compact: boolean }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>("20");
  const query = useQuery({
    queryKey: ["statistics", "phrases", topicId, page, pageSize],
    queryFn: ({ signal }) => fetchPhraseStatistics(page, pageSize, signal, topicId),
  });
  const statistics = query.data;
  const loading = query.isPending; // a retry with no data yet goes back to pending

  function changePage(nextPage: number) {
    setPage(nextPage);
  }
  function changePageSize(nextPageSize: PageSize) {
    setPageSize(nextPageSize);
    setPage(1);
  }

  if (loading) return <StatusPanel>{t("statistics.phrases.loading")}</StatusPanel>;
  if (query.isError || !statistics)
    return (
      <StatusPanel role="alert">
        {t("statistics.phrases.failed")} <RetryButton onClick={() => void query.refetch()}>{t("statistics.phrases.reload")}</RetryButton>
      </StatusPanel>
    );

  // Phone (every window up to 780px uses the phone layout): each phrase becomes a small card with its own labels.
  const cell = cn("border-t border-line px-3 py-3 align-top leading-snug text-ink-soft", compact && "block w-full border-0 px-0 py-1.5 text-left [overflow-wrap:anywhere]");
  const label = cn("phrase-cell-label mb-0.5 text-micro text-ink-muted", compact ? "block" : "hidden");
  const heads = ["statistics.phrases.source", "statistics.phrases.target", "statistics.phrases.attempts", "statistics.phrases.status", "statistics.phrases.nextReview"];
  return (
    <section className={cn("phrase-statistics grid gap-5", card, compact ? "p-3" : "p-5")} aria-labelledby="phrases-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <p className={cn(eyebrow, compact && "hidden")}>{t("statistics.phrases.kicker")}</p>
          <h2 id="phrases-title" className={cardHeading}>
            {t("statistics.phrases.title")}
          </h2>
        </div>
        <label className="page-size-control flex items-center gap-2 text-sm text-ink-muted">
          {t("statistics.phrases.perPage")}
          <select className={select} value={pageSize} onChange={event => changePageSize(event.target.value as PageSize)}>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>
      {statistics.total === 0 ? (
        <p className="empty-phrases m-0 text-ink-muted">{t("statistics.empty")}</p>
      ) : (
        <>
          <div className="grid gap-5">
            {statistics.groups.map(group => (
              <section className="phrase-group min-w-0" key={group.topic_id ?? "custom"}>
                <h3 className="m-0 mb-2.5 text-sm font-semibold text-accent">{topicText(group.topic_id, group.topic_title, group.topic_title_en)}</h3>
                <div className={cn("max-w-full", compact ? "overflow-visible" : "overflow-x-auto rounded-control border border-line")}>
                  <table className={cn("w-full border-collapse text-sm", compact && "block")}>
                    <thead className={cn(compact && "hidden")}>
                      <tr>
                        {heads.map(head => (
                          <th key={head} className="whitespace-nowrap bg-surface-raised px-3 py-2.5 text-left text-micro font-semibold uppercase tracking-wider text-ink-muted">
                            {t(head)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={cn(compact && "grid gap-2")}>
                      {group.phrases.map(phrase => (
                        <tr key={phrase.id} className={cn(compact && "block rounded-control border border-line bg-surface-raised p-3")}>
                          <td className={cell}>
                            <span className={label}>{t(heads[0])}</span>
                            <span>{t(phrase.source_ru)}</span>
                          </td>
                          <td className={cn(cell, "text-ink")} lang="tr">
                            <span className={label}>{t(heads[1])}</span>
                            <span>{phrase.target_tr}</span>
                          </td>
                          <td className={cn(cell, "tabular-nums", compact ? "text-left" : "text-center")}>
                            <span className={label}>{t(heads[2])}</span>
                            <span>{phrase.attempts}</span>
                          </td>
                          <td className={cell}>
                            <span className={label}>{t(heads[3])}</span>
                            <span
                              className={cn(
                                `phrase-status phrase-status--${phrase.status} inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold`,
                                phrase.status === "mastered" ? "bg-success/14 text-success" : "bg-selected text-accent",
                              )}
                            >
                              {t(phrase.status === "mastered" ? "statistics.phrases.mastered" : "statistics.phrases.learning")}
                            </span>
                          </td>
                          <td className={cn(cell, "tabular-nums")}>
                            <span className={label}>{t(heads[4])}</span>
                            <span>{t(phrase.status === "mastered" ? formatReviewDate(phrase.next_review_at) : "—")}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
          <nav className="phrase-pagination flex items-center justify-end gap-3 text-sm text-ink-muted" aria-label={t("statistics.phrases.pagination")}>
            <button className={secondaryButton} type="button" disabled={statistics.page <= 1} onClick={() => changePage(statistics.page - 1)}>
              {t("statistics.phrases.previous")}
            </button>
            <span className="tabular-nums">{t("statistics.phrases.page", { page: statistics.page, total: statistics.total_pages })}</span>
            <button className={secondaryButton} type="button" disabled={statistics.page >= statistics.total_pages} onClick={() => changePage(statistics.page + 1)}>
              {t("statistics.phrases.next")}
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

function PhrasesPage({ compact }: { compact: boolean }) {
  const query = useQuery({ queryKey: ["statistics", "phraseTopics"], queryFn: ({ signal }) => fetchPhraseTopics(signal) });
  const topics = query.data;
  const [chosenTopic, setChosenTopic] = useState<string>();
  // The first topic is selected until the learner picks another one.
  const selectedTopic = chosenTopic ?? (topics?.[0] ? (topics[0].topic_id ?? "unassigned") : "");

  if (query.isError)
    return (
      <StatusPanel role="alert">
        {t("statistics.topics.failed")} <RetryButton onClick={() => void query.refetch()}>{t("statistics.topics.reload")}</RetryButton>
      </StatusPanel>
    );
  if (!topics) return <StatusPanel role="status">{t("statistics.topics.loading")}</StatusPanel>;
  if (!topics.length) return <StatusPanel>{t("statistics.empty")}</StatusPanel>;
  return (
    <>
      <label className={cn("phrase-topic-control grid gap-2 p-4 text-sm text-ink-muted", card)}>
        {t("statistics.topics.label")}
        <select className={cn(select, "w-full py-2.5")} aria-label={t("statistics.topics.label")} value={selectedTopic} onChange={event => setChosenTopic(event.target.value)}>
          {topics.map(topic => (
            <option key={topic.topic_id ?? "unassigned"} value={topic.topic_id ?? "unassigned"}>
              {topicText(topic.topic_id, topic.topic_title, topic.topic_title_en)} · {topic.phrase_count}
            </option>
          ))}
        </select>
      </label>
      <PhraseList key={selectedTopic} topicId={selectedTopic} compact={compact} />
    </>
  );
}

function ActivityTab({ compact }: { compact: boolean }) {
  const [thisWeek] = useState(currentWeek);
  const [weekOffset, setWeekOffset] = useState(0);
  const week = thisWeek.map(date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + weekOffset * 7));
  const months = [...new Set(week.map(monthKey))];
  // One request per calendar month the week touches; weeks inside the same months reuse the data.
  const query = useQuery({
    queryKey: ["statistics", "monthly", ...months],
    queryFn: ({ signal }) => Promise.all(months.map(month => fetchMonthlyStatistics(month, signal))),
  });
  const statistics = query.data ?? [];
  const loading = query.isPending; // a retry with no data yet goes back to pending

  function changeWeek(direction: number) {
    setWeekOffset(Math.min(0, weekOffset + direction));
  }

  const weekTitle = `${new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "short" }).format(week[0])} — ${new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "short" }).format(week[6])}`;
  const stepButton = cn(
    "grid min-h-11 cursor-pointer place-items-center rounded-control border border-line bg-surface-raised p-1 text-2xl leading-none text-ink-soft transition-colors duration-(--duration-quick) hover:border-line-strong hover:bg-selected hover:text-ink active:bg-selected",
    focusRing,
  );
  const toolbar = (
    <nav className="activity-toolbar grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 text-sm text-ink-soft" aria-label={t("statistics.week.label")}>
      <button className={stepButton} type="button" aria-label={t("statistics.week.previous")} onClick={() => changeWeek(-1)}>
        ‹
      </button>
      <strong className="text-center font-semibold" aria-live="polite">
        {t("statistics.week.title", { range: weekTitle })}
      </strong>
      {weekOffset < 0 ? (
        <button className={stepButton} type="button" aria-label={t("statistics.week.next")} onClick={() => changeWeek(1)}>
          ›
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );

  if (loading)
    return (
      <>
        {toolbar}
        <StatusPanel role="status">{t("statistics.loading")}</StatusPanel>
      </>
    );
  if (query.isError || !statistics.length)
    return (
      <>
        {toolbar}
        <StatusPanel role="alert">
          {t("statistics.failed")} <RetryButton onClick={() => void query.refetch()}>{t("statistics.reload")}</RetryButton>
        </StatusPanel>
      </>
    );
  const byDate = new Map(statistics.flatMap(month => month.days).map(day => [day.date, day]));
  const days = week.map(date => byDate.get(dateKey(date)) ?? { date: dateKey(date), phrase_count: 0, translation_count: 0, correct_translation_count: 0, mastered_phrase_count: 0 });
  const total = days.reduce((sum, day) => sum + day.translation_count, 0);
  const mastered = days.reduce((sum, day) => sum + day.mastered_phrase_count, 0);
  const activeDays = days.filter(day => day.translation_count > 0).length;
  const maxCount = Math.max(1, ...days.map(day => day.translation_count), ...days.map(day => day.mastered_phrase_count));
  const sectionCard = cn("statistics-card grid gap-4", card, compact ? "p-3" : "p-5");
  const heading = (kicker: string, id: string, title: string, aside: ReactNode) => (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="grid gap-1">
        <p className={cn(eyebrow, compact && "hidden")}>{t(kicker)}</p>
        <h2 id={id} className={cardHeading}>
          {t(title)}
        </h2>
      </div>
      {aside}
    </div>
  );
  const marker = "size-2.5 shrink-0 rounded-xs border";
  return (
    <>
      {toolbar}
      <section className="statistics-summary grid grid-cols-3 gap-3" aria-label={t("statistics.summary.label")}>
        {[
          [activeDays, "statistics.summary.days"],
          [total, "statistics.summary.reviews"],
          [mastered, "statistics.summary.mastered"],
        ].map(([value, caption]) => (
          <div key={caption} className={cn("grid min-w-0 gap-0.5 px-3 py-3 sm:px-4", card)}>
            <span className="font-display text-3xl font-bold leading-none text-success tabular-nums">{value}</span>
            <small className="text-caption text-ink-muted max-[360px]:text-micro">{t(String(caption))}</small>
          </div>
        ))}
      </section>
      <section className={sectionCard} aria-labelledby="calendar-title">
        {heading(
          "statistics.calendar.kicker",
          "calendar-title",
          "statistics.calendar.title",
          <span className="calendar-legend flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-ink-muted">
            <span className="flex items-center gap-1.5">
              <i className={cn(marker, activeDay)} />
              {t("statistics.calendar.legend.active")}
            </span>
            <span className="flex items-center gap-1.5">
              <i className={cn(marker, "is-intensive", activeDay, intensiveDay)} />
              {t("statistics.calendar.legend.intensive")}
            </span>
            <span className="flex items-center gap-1.5">
              <GoldStar className="size-4.5" />
              {t("statistics.calendar.legend.star")}
            </span>
          </span>,
        )}
        <div className={cn("practice-calendar grid", compact ? "grid-cols-[repeat(7,minmax(32px,1fr))] gap-1" : "grid-cols-[repeat(7,minmax(48px,1fr))] gap-2")}>
          {days.map((day, index) => {
            const dayNumber = Number(day.date.slice(-2));
            const active = day.translation_count > 0,
              intensive = day.translation_count >= 10;
            return (
              <div
                key={day.date}
                aria-label={t("statistics.calendar.dayLabel", { day: t(weekDays[index]), date: dayNumber, count: day.translation_count })}
                className={cn(
                  "calendar-day relative grid w-full min-w-0 place-items-center rounded-control border border-line bg-surface-raised pb-4 text-ink-muted",
                  compact ? "min-h-17" : "aspect-[1.25] min-h-18.5",
                  active && cn("is-active font-bold text-ink", activeDay),
                  intensive && cn("is-intensive", intensiveDay),
                )}
              >
                <small className={cn("calendar-date absolute inset-x-0 text-center text-micro font-medium text-ink-muted", compact ? "top-1.5" : "top-2")}>
                  {t(weekDays[index])} {dayNumber}
                </small>
                <strong className="calendar-count mt-3 font-display text-day-count leading-none tabular-nums">{day.translation_count}</strong>
                {day.translation_count >= 20 && <GoldStar className="calendar-day__star absolute bottom-1 left-1/2 size-4.5 -translate-x-1/2" />}
              </div>
            );
          })}
        </div>
      </section>
      <section className={sectionCard} aria-labelledby="daily-chart-title">
        {heading(
          "statistics.dailyChart.kicker",
          "daily-chart-title",
          "statistics.dailyChart.title",
          <span className="text-caption text-ink-muted">{t("statistics.dailyChart.total", { count: total })}</span>,
        )}
        <div className="chart-legend flex flex-wrap gap-x-4 gap-y-2 text-caption text-ink-muted" aria-label={t("statistics.dailyChart.legend")}>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-xs bg-info" />
            {t("statistics.dailyChart.correct")}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-xs bg-reward" />
            {t("statistics.dailyChart.incorrect")}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-xs bg-success" />
            {t("statistics.dailyChart.mastered")}
          </span>
        </div>
        <div
          className={cn(
            "daily-chart grid border-t border-line px-0.5 pt-3 [--bar:min(100%,38px)]",
            compact ? "h-45 grid-cols-7 gap-1 overflow-hidden" : "h-62.5 grid-cols-[repeat(7,minmax(34px,1fr))] gap-2.5",
          )}
          role="img"
          aria-label={t("statistics.dailyChart.label", { range: weekTitle })}
        >
          {days.map((day, index) => {
            const correct = Math.min(day.correct_translation_count, day.translation_count);
            const incorrect = Math.max(0, day.translation_count - correct);
            return (
              <div
                className={cn("daily-chart__column grid h-full min-w-0", compact ? "grid-rows-[1fr_1fr_auto]" : "grid-rows-[1fr_1fr_22px]")}
                key={day.date}
                title={t("statistics.dailyChart.dayTitle", { date: day.date, total: day.translation_count, correct, incorrect, mastered: day.mastered_phrase_count })}
              >
                <div className="flex items-end justify-center border-b border-line">
                  <span className="flex min-h-0 w-(--bar) flex-col overflow-hidden rounded-t-sm" style={{ height: `${(day.translation_count / maxCount) * 100}%` }}>
                    {day.translation_count > 0 && (
                      <>
                        <i className="daily-chart__segment daily-chart__segment--correct block min-h-0 w-full basis-0 bg-info" style={{ flexGrow: correct }} />
                        <i className="daily-chart__segment daily-chart__segment--other block min-h-0 w-full basis-0 bg-reward" style={{ flexGrow: incorrect }} />
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-start justify-center">
                  <span className="daily-chart__mastered block w-(--bar) rounded-b-sm bg-success" style={{ height: `${(day.mastered_phrase_count / maxCount) * 100}%` }} />
                </div>
                <small className={cn("self-center text-center text-micro text-ink-muted", compact ? "pt-1 leading-tight" : "whitespace-nowrap")}>
                  {t(weekDays[index])} {Number(day.date.slice(-2))}
                </small>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

/** Weekly activity (calendar, totals, daily chart) and, on its own page, the phrase list by topic. */
export function StatisticsView({
  page,
  onPageChange,
  compact = false,
}: {
  page?: StatisticsPage;
  onPageChange?: (page: StatisticsPage) => void;
  /** Phone layout (also every window up to 780px): full width, smaller cards, stacked phrases. */
  compact?: boolean;
}) {
  const [localPage, setLocalPage] = useState<StatisticsPage>("activity");
  const currentPage = page ?? localPage;
  const changePage = (next: StatisticsPage) => {
    setLocalPage(next);
    onPageChange?.(next);
  };
  // Desktop: the same width as the practice column next to the topics.
  const layout = cn(
    "statistics-page mx-auto grid gap-4 text-ink [&>*]:min-w-0",
    compact ? "w-full" : "w-[calc((min(100%,var(--container-workspace))-2*var(--spacing-gutter)-var(--spacing-workspace-gap))*2/3)] pb-10 pt-8",
  );
  return currentPage === "phrases" ? (
    <main className={cn(layout, "phrase-statistics-page")}>
      <header className="flex flex-wrap items-center gap-4">
        <button className={secondaryButton} type="button" onClick={() => changePage("activity")}>
          {t("statistics.back")}
        </button>
        <h1 className="m-0 font-display text-title-compact font-bold">{t("statistics.phrasesByTopic")}</h1>
      </header>
      <PhrasesPage compact={compact} />
    </main>
  ) : (
    <main className={layout}>
      <ActivityTab compact={compact} />
      <button className={cn("statistics-phrases-link", secondaryButton, "text-accent hover:text-accent")} type="button" onClick={() => changePage("phrases")}>
        {t("statistics.phrasesByTopicLink")}
      </button>
    </main>
  );
}
