import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useWordHints } from "../features/practice/useWordHints";
import { revealWordHint } from "../api/training";
import type { Exercise, WordHint } from "../types/training";

vi.mock("../api/training", () => ({ revealWordHint: vi.fn() }));
afterEach(() => vi.resetAllMocks());

const exercise = { id: "e-1", session_id: "s-1", source_ru: "Я хочу открыть счёт.", targeted_skills: [], expected_level: "A2", difficulty: 0.4, word_hints: [] } as unknown as Exercise;
const saved: WordHint = { word_ru: "хочу", translation_tr: "istiyorum", is_learning: true } as WordHint;

function setup() {
  const flowEpochRef = { current: 0 };
  const onError = vi.fn();
  let resolve!: (hint: WordHint) => void;
  vi.mocked(revealWordHint).mockReturnValue(new Promise<WordHint>(done => { resolve = done; }));
  const hook = renderHook(() => useWordHints({ exercise, checkingRef: { current: false }, flowEpochRef, onClearError: vi.fn(), onClearDiagnostic: vi.fn(), onError }));
  return { hook, flowEpochRef, onError, resolve: (hint: WordHint) => resolve(hint) };
}

it("keeps a hint that arrives for the current phrase", async () => {
  const { hook, resolve } = setup();
  let pending!: Promise<void>;
  act(() => { pending = hook.result.current.reveal("хочу"); });
  await act(async () => { resolve(saved); await pending; });
  expect(hook.result.current.wordHints).toEqual({ "хочу": saved });
  expect(hook.result.current.hintedWords()).toEqual(["хочу"]);
});

it.each([
  ["the hint epoch moves on (next phrase or a finished attempt)", (ctx: ReturnType<typeof setup>) => ctx.hook.result.current.invalidate()],
  ["the practice flow moves on", (ctx: ReturnType<typeof setup>) => { ctx.flowEpochRef.current += 1; }],
])("drops a late hint when %s", async (_, moveOn) => {
  const ctx = setup();
  let pending!: Promise<void>;
  act(() => { pending = ctx.hook.result.current.reveal("хочу"); });
  act(() => moveOn(ctx));
  await act(async () => { ctx.resolve(saved); await pending; });
  expect(ctx.hook.result.current.wordHints).toEqual({});
  expect(ctx.onError).not.toHaveBeenCalled();
});

it("aborts requests in flight and never reports their failure", async () => {
  const flowEpochRef = { current: 0 };
  const onError = vi.fn();
  let signal!: AbortSignal;
  vi.mocked(revealWordHint).mockImplementation((_id, _word, abortSignal) => new Promise((_, reject) => {
    signal = abortSignal!; abortSignal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  }));
  const hook = renderHook(() => useWordHints({ exercise, checkingRef: { current: false }, flowEpochRef, onClearError: vi.fn(), onClearDiagnostic: vi.fn(), onError }));
  let pending!: Promise<void>;
  act(() => { pending = hook.result.current.reveal("хочу"); });
  await act(async () => { hook.result.current.abortAll(); await pending; });
  expect(signal.aborted).toBe(true);
  expect(onError).not.toHaveBeenCalled();
});
