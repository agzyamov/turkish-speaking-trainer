import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePracticeSession } from "../features/practice/usePracticeSession";
import { fetchReviewSummary, fetchTopics, startTrainingSession } from "../api/training";
import type { CurrentUser } from "../types/auth";

vi.mock("../api/training", async original => ({
  ...(await original<typeof import("../api/training")>()),
  fetchTopics: vi.fn(),
  fetchReviewSummary: vi.fn(),
  startTrainingSession: vi.fn(),
  fetchNextExercise: vi.fn(),
  submitAttempt: vi.fn(),
}));
vi.mock("../performance", () => ({ startUiTiming: vi.fn(), finishUiTimingWhenVisible: vi.fn() }));

const account = { id: "u-1", role: "user", access_tier: "free", daily_usage: { used: 0, limit: 20, remaining: 20, resets_at: "2026-11-22T00:00:00Z" } } as unknown as CurrentUser;
const topic = (id: string) => ({ id, title_ru: id, description_ru: "", likely_intents: [], suggested_vocabulary: [], is_custom: false, phrase_count: 5 });
const started = (topicId: string) => ({
  session: {
    id: `s-${topicId}`,
    status: "active",
    level: "A2",
    started_at: "",
    requested_length: 10,
    completed_count: 0,
    topic: { ...topic(topicId), source: "preset", target_level: "A2", excluded_domains: [], normalized_prompt_context: "" },
  },
  exercise: { id: `e-${topicId}`, session_id: `s-${topicId}`, source_ru: `Фраза ${topicId}`, targeted_skills: [], expected_level: "A2", difficulty: 0.4, word_hints: [] },
});

beforeEach(() => {
  vi.mocked(fetchTopics).mockResolvedValue([topic("bank"), topic("cafe")]);
  vi.mocked(fetchReviewSummary).mockResolvedValue({ phrase_count: 0 });
  vi.mocked(startTrainingSession).mockImplementation(async request => started((request as { topic_id: string }).topic_id) as never);
});
afterEach(() => vi.clearAllMocks());

function setup() {
  return renderHook(() => usePracticeSession({ account, onAccountChange: vi.fn(), assistanceEnabled: false, onReset: vi.fn() }));
}

it("loads the catalogue and starts the first topic with phrases", async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.startupState).toBe("ready"));
  expect(hook.result.current.backendState).toBe("online");
  expect(hook.result.current.topics.map(item => item.id)).toEqual(["bank", "cafe"]);
  expect(hook.result.current.exercise?.id).toBe("e-bank");
});

it("ignores a topic start that answers after the session was reset", async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.startupState).toBe("ready"));
  let answer!: (value: unknown) => void;
  vi.mocked(startTrainingSession).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        answer = resolve as (value: unknown) => void;
      }) as never,
  );
  act(() => hook.result.current.selectTopic("cafe"));
  act(() => hook.result.current.resetTraining());
  await act(async () => {
    answer(started("cafe"));
    await Promise.resolve();
  });
  expect(hook.result.current.session).toBeUndefined();
  expect(hook.result.current.exercise).toBeUndefined();
});

it("aborts the catalogue request when the practice unmounts", async () => {
  let signal: AbortSignal | undefined;
  vi.mocked(fetchTopics).mockImplementation(abortSignal => {
    signal = abortSignal;
    return new Promise(() => undefined);
  });
  const hook = setup();
  await waitFor(() => expect(signal).toBeDefined());
  hook.unmount();
  expect(signal?.aborted).toBe(true);
});
