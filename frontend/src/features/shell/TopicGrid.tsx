import { Fragment } from "react";
import { t, topicText } from "../../i18n";
import type { TopicListItem } from "../../types/training";
import { Icon } from "../../shared/ui/icon";
import { cn } from "../../shared/lib/utils";
import { topicIconName } from "./topicIcons";

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";
// One card for every topic, phone and desktop: raised tile, accent-tinted when selected,
// the glass's gold rim for the owner's personal topics.
const card = cn(
  "relative grid w-full min-w-0 cursor-pointer content-between justify-items-start gap-1.5 rounded-card border border-line bg-surface-raised p-3 text-left text-ink",
  "transition-colors duration-(--duration-quick) hover:border-line-strong disabled:cursor-default disabled:opacity-45 disabled:hover:border-line",
  focusRing,
);
const selected = "is-selected border-accent bg-selected hover:border-accent";
const personal = "topic--personal border-reward hover:border-reward";
const tile = "topic__icon grid size-8 place-items-center rounded-control";
const title = "w-full text-sm font-semibold leading-tight hyphens-auto [overflow-wrap:break-word]";
const count = "absolute right-3 top-2.5 grid justify-items-end font-display text-xl font-bold leading-none text-accent-bright tabular-nums";
const countLabel = "mt-0.5 block font-sans text-micro font-medium text-ink-muted";

/** The topic chooser: review card first, the catalogue, then the owner's personal topics after a divider. */
export function TopicGrid({
  compact,
  topics,
  personalStart,
  selectedTopic,
  reviewSelected,
  reviewCount,
  onReview,
  onSelect,
}: {
  compact: boolean;
  topics: TopicListItem[];
  /** Index of the first personal topic, or undefined when personal topics are not shown separately. */
  personalStart?: number;
  selectedTopic?: string;
  reviewSelected: boolean;
  reviewCount: number;
  onReview: () => void;
  onSelect: (topicId: string) => void;
}) {
  const isPersonal = (topic: TopicListItem) => personalStart !== undefined && topic.is_custom;
  return (
    <div className={cn("grid grid-cols-2 content-start gap-2", compact ? "android-topic-list" : "topics desktop-topic-grid")} aria-label={t("shell.topics.label")}>
      {compact ? (
        <button className={cn("android-topic min-h-[clamp(70px,9.5dvh,90px)]", card, reviewSelected && selected)} type="button" disabled={reviewCount === 0} onClick={onReview}>
          <span className={cn(tile, "bg-info/12 text-info")}>
            <Icon name="repeat" />
          </span>
          <strong className={title}>{t("shell.topics.review")}</strong>
          <small className={count}>
            {reviewCount}
            <span className={countLabel}>{t("shell.topics.reviewToDo")}</span>
          </small>
        </button>
      ) : (
        <button className={cn("review-topic desktop-topic-card min-h-[88px]", card, reviewSelected && selected)} type="button" onClick={onReview}>
          <span className={cn(tile, "bg-info/12 text-info")}>
            <Icon name="repeat" />
          </span>
          <span className="topic__copy w-full">
            <strong className={cn(title, "block")}>{t("shell.topics.reviewPhrases")}</strong>
            <small className="sr-only">{reviewCount ? t("shell.topics.reviewNeeded", { count: reviewCount }) : t("shell.topics.reviewEmpty")}</small>
          </span>
          <span className={cn("review-topic__count", count)}>{reviewCount}</span>
        </button>
      )}
      {topics.map((topic, index) => (
        <Fragment key={topic.id}>
          {isPersonal(topic) && index === personalStart && <hr className="topics-divider col-span-full my-1.5 h-px w-full border-0 bg-line" aria-label={t("shell.topics.personal")} />}
          <button
            className={cn(
              compact ? "android-topic min-h-[clamp(70px,9.5dvh,90px)]" : "topic desktop-topic-card min-h-[88px]",
              card,
              selectedTopic === topic.id && selected,
              isPersonal(topic) && personal,
            )}
            type="button"
            onClick={() => onSelect(topic.id)}
          >
            <span className={cn(tile, `topic__icon--${topicIconName(topic.id)}`, "bg-accent/12 text-accent")}>
              <Icon name={topicIconName(topic.id)} />
            </span>
            {compact ? (
              <>
                <strong className={title}>{topicText(topic.id, topic.title_ru, topic.title_en)}</strong>
                <small className={count}>
                  {topic.phrase_count}
                  <span className={countLabel}> {t("shell.topics.unlearned")}</span>
                </small>
              </>
            ) : (
              <>
                <span className="topic__copy w-full">
                  <strong className={cn(title, "block")}>{topicText(topic.id, topic.title_ru, topic.title_en)}</strong>
                </span>
                <span className={cn("topic__unlearned", count)}>
                  <strong>{topic.phrase_count}</strong>
                  <small className={countLabel}>{t("shell.topics.unlearned")}</small>
                </span>
              </>
            )}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
