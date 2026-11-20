import { expect, it } from "vitest";
import { BackendError } from "../api/training";
import { budgetPauseOf } from "../budgetPause";
import { customContentError } from "../customContentErrors";

const failure = (reason: string) => ({ kind: "external_model", stage: "budget", reason, diagnostic_id: "00000000-0000-4000-8000-000000000001", retryable: false });

it("reads speech-to-text budget codes from detail.code", () => {
  expect(budgetPauseOf(new BackendError(503, { code: "transcription_budget_exhausted" }))).toBe("monthly");
  expect(budgetPauseOf(new BackendError(503, { code: "transcription_daily_budget_exhausted" }))).toBe("daily");
});

it("reads Claude budget reasons from detail.failure when the code is generic", () => {
  expect(budgetPauseOf(new BackendError(503, { code: "analysis_unavailable", failure: failure("budget_exhausted") }))).toBe("monthly");
  // Review-phrase preparation sends no code at all.
  expect(budgetPauseOf(new BackendError(503, { message: "unavailable", failure: failure("user_daily_budget_exhausted") }))).toBe("daily");
});

it("ignores other failures", () => {
  expect(budgetPauseOf(new BackendError(503, { code: "analysis_unavailable", failure: failure("timeout") }))).toBeUndefined();
  expect(budgetPauseOf(new Error("network"))).toBeUndefined();
});

it("explains a spent budget on custom topic creation instead of the generic translation error (ADR-0008)", () => {
  const error = new BackendError(503, { code: "topic_translation_unavailable", retryable: false, failure: failure("budget_exhausted") });
  expect(budgetPauseOf(error)).toBe("monthly");
  expect(customContentError(error, "fallback")).toContain("до начала следующего месяца");
  // Without a budget failure the released message stays.
  expect(customContentError(new BackendError(503, { code: "topic_translation_unavailable" }), "fallback")).toContain("Не удалось перевести название темы");
});
