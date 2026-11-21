import { failureOf } from "./api/failureDiagnostics";
import { BackendError } from "./api/training";

// Q-7: when the AI budget is spent the learner sees why practice is paused and when it resumes.
// Codes come from docs/architecture/interfaces/rest-api.md (budget guard failures).
export type BudgetPause = "monthly" | "daily";

// Speech-to-text failures carry the budget code in detail.code; Claude failures arrive wrapped
// (for example code "analysis_unavailable") with the budget reason in detail.failure.reason.
const pauses: Record<string, BudgetPause> = {
  budget_exhausted: "monthly",
  transcription_budget_exhausted: "monthly",
  user_daily_budget_exhausted: "daily",
  transcription_daily_budget_exhausted: "daily",
};

export const budgetPauseMessages: Record<BudgetPause, string> = {
  monthly: "practice.pause.monthlyMessage",
  daily: "practice.pause.dailyMessage",
};

export function budgetPauseOf(error: unknown): BudgetPause | undefined {
  if (!(error instanceof BackendError)) return undefined;
  return (error.code ? pauses[error.code] : undefined) ?? pauses[failureOf(error)?.reason ?? ""];
}

export function budgetPauseMessage(error: unknown): string | undefined {
  const pause = budgetPauseOf(error);
  return pause && budgetPauseMessages[pause];
}
