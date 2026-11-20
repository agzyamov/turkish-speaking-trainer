import { t } from "../../i18n";
import { AnswerResult } from "../../AnswerResult";
import { Icon } from "../../shared/ui/icon";
import type { Attempt } from "../../types/training";
import { displayFeedback } from "./feedbackText";

/** Result of one checked answer: highlighted answer, score, hint penalty and the review details. */
export function ExerciseFeedback({ attempt, native }: { attempt: Attempt; native: boolean }) {
  const scorePercent = Math.round(attempt.overall_score * 100);
  return <div className={`feedback ${native ? "android-feedback" : ""} feedback--${attempt.analysis.verdict}`}>
    <AnswerResult answer={attempt.transcript_tr} attempt={attempt} />
    {attempt.overall_score !== 1 && <div className="feedback__score"><span>{scorePercent}%</span><strong>{t(attempt.analysis.verdict === "correct" ? "Верно" : attempt.analysis.verdict === "mostly_correct" ? "Почти верно" : "Нужно доработать")}</strong></div>}
    {attempt.hint_penalty > 0 && <div className="hint-penalty"><Icon name="bulb" /><span>{t("Подсказки: −")}{Math.round(attempt.hint_penalty * 100)}%</span></div>}
    {scorePercent < 100 && <details><summary>{t("Разбор")}</summary><p>{displayFeedback(attempt.analysis.detailed_feedback_ru)}</p>{attempt.analysis.issues.map((issue, index) => <p className="issue" key={`${issue.skill_key}-${issue.type}-${index}`}>{issue.evidence}{t(issue.correction ? ` → ${issue.correction}` : "")}{issue.explanation_ru && <span className="issue-explanation">{displayFeedback(issue.explanation_ru)}</span>}</p>)}</details>}
  </div>;
}
