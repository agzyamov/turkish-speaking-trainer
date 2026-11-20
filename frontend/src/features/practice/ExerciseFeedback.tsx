import { t } from "../../i18n";
import { AnswerResult } from "../../AnswerResult";
import { Icon } from "../../shared/ui/icon";
import { cn } from "../../shared/lib/utils";
import type { Attempt } from "../../types/training";
import { displayFeedback } from "./feedbackText";
import { useRewardPreference } from "../../rewardPreferences";

const verdictTone = {
  correct: "text-success",
  mostly_correct: "text-reward",
  needs_work: "text-danger",
} as const;

/**
 * Result of one checked answer. The verdict row is always shown (a perfect answer keeps its
 * score after the reward animation), the prompt stays visible, and what to fix is expanded.
 */
export function ExerciseFeedback({ attempt, native, source, celebrate = false }: { attempt: Attempt; native: boolean; source?: string; celebrate?: boolean }) {
  const animations = useRewardPreference("animations");
  const scorePercent = Math.round(attempt.overall_score * 100);
  const verdict = attempt.analysis.verdict;
  const verdictLabel = t(verdict === "correct" ? "Верно" : verdict === "mostly_correct" ? "Почти верно" : "Нужно доработать");
  return <div className={cn("feedback grid gap-5", native && "android-feedback", `feedback--${verdict}`)}>
    {source && <p className="m-0 text-sm text-ink-muted">{source}</p>}
    <div className="feedback__score flex flex-wrap items-baseline gap-x-3 gap-y-1" role="status">
      <span className={cn("relative font-display text-4xl font-bold tabular-nums", verdictTone[verdict])}>
        {scorePercent}%
        {/* Perfect answer: the gold rim is drawn once around the score; it never covers the result. */}
        {celebrate && animations && <span data-slot="reward-ring" aria-hidden="true"
          className="pointer-events-none absolute -inset-x-3 -inset-y-1.5 rounded-full border-2 border-reward opacity-0 motion-safe:animate-reward-ring" />}
      </span>
      <strong className="text-lg font-semibold text-ink">{verdictLabel}</strong>
      {attempt.hint_penalty > 0 && <span className="hint-penalty inline-flex items-center gap-1.5 text-sm text-ink-muted">
        <Icon name="bulb" size={16} />{t("Подсказки: −")}{Math.round(attempt.hint_penalty * 100)}%
      </span>}
    </div>
    <AnswerResult answer={attempt.transcript_tr} attempt={attempt} />
    {scorePercent < 100 && <section className="grid gap-3" aria-labelledby="feedback-review-title">
      <h3 id="feedback-review-title" className="m-0 text-sm font-semibold text-ink-soft">{t("Разбор")}</h3>
      {attempt.analysis.issues.length > 0 && <ul className="m-0 grid list-none gap-3 p-0">
        {attempt.analysis.issues.map((issue, index) => <li className="issue grid gap-1" key={`${issue.skill_key}-${issue.type}-${index}`}>
          <span className="text-answer" lang="tr">
            <span className="text-danger line-through decoration-danger/60">{issue.evidence}</span>
            {issue.correction && <> <span className="text-ink-muted" aria-hidden="true">→</span> <span className="text-success">{issue.correction}</span></>}
          </span>
          {issue.explanation_ru && <span className="issue-explanation text-sm leading-normal text-ink-soft">{displayFeedback(issue.explanation_ru)}</span>}
        </li>)}
      </ul>}
      <p className="m-0 text-sm leading-normal text-ink-muted">{displayFeedback(attempt.analysis.detailed_feedback_ru)}</p>
    </section>}
  </div>;
}
