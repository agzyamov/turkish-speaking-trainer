import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useVoiceAnswer } from "../features/practice/useVoiceAnswer";
import { transcribeAudio } from "../api/training";
import type { Exercise } from "../types/training";

const recorder = { start: vi.fn(), finish: vi.fn(), stop: vi.fn() };
vi.mock("../voiceRecorder", () => ({
  VoiceRecorder: vi.fn(function VoiceRecorder() {
    return recorder;
  }),
}));
vi.mock("../api/training", async original => ({ ...(await original<typeof import("../api/training")>()), transcribeAudio: vi.fn() }));
vi.mock("../performance", () => ({ startUiTiming: vi.fn() }));

const exercise = { id: "e-1" } as Exercise;
const recording = { audio: new Blob(["a"]), timing: { recording_ms: 900 } };

beforeEach(() => {
  recorder.start.mockResolvedValue(undefined);
  recorder.finish.mockResolvedValue(recording);
});
afterEach(() => vi.clearAllMocks());

function setup() {
  const answerEditEpochRef = { current: 0 };
  const onTranscribed = vi.fn();
  const onError = vi.fn();
  const hook = renderHook(() => useVoiceAnswer({ exercise, voiceSupported: true, assistanceEnabled: false, answerEditEpochRef, onError, onDiagnostic: vi.fn(), onTranscribed }));
  return { hook, answerEditEpochRef, onTranscribed, onError };
}

it("records, transcribes and hands over the Latin-normalised answer with its timing", async () => {
  vi.mocked(transcribeAudio).mockResolvedValue({ text: "Merhaba" } as Awaited<ReturnType<typeof transcribeAudio>>);
  const { hook, onTranscribed } = setup();
  await act(() => hook.result.current.startVoice());
  expect(hook.result.current.voiceState).toBe("recording");
  await act(() => hook.result.current.finishVoice());
  expect(onTranscribed).toHaveBeenCalledWith("Merhaba", undefined);
  expect(hook.result.current.voiceTimingRef.current).toEqual(recording.timing);
  expect(hook.result.current.voiceState).toBe("idle");
});

it("ignores a transcription that arrives after the recording was stopped", async () => {
  let finish!: (value: Awaited<ReturnType<typeof transcribeAudio>>) => void;
  vi.mocked(transcribeAudio).mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  const { hook, onTranscribed } = setup();
  await act(() => hook.result.current.startVoice());
  let pending!: Promise<void>;
  await act(async () => {
    pending = hook.result.current.finishVoice();
    await Promise.resolve();
  });
  act(() => hook.result.current.stopVoice());
  await act(async () => {
    finish({ text: "Geç kalan" } as Awaited<ReturnType<typeof transcribeAudio>>);
    await pending;
  });
  expect(onTranscribed).not.toHaveBeenCalled();
  expect(hook.result.current.voiceState).toBe("idle");
});

it("keeps an answer the learner edited while recording", async () => {
  vi.mocked(transcribeAudio).mockResolvedValue({ text: "Merhaba" } as Awaited<ReturnType<typeof transcribeAudio>>);
  const { hook, answerEditEpochRef, onTranscribed } = setup();
  await act(() => hook.result.current.startVoice());
  answerEditEpochRef.current += 1;
  await act(() => hook.result.current.finishVoice());
  expect(onTranscribed).not.toHaveBeenCalled();
});

it("interrupts a recording in progress with a message, and does nothing when idle", async () => {
  const { hook, onError } = setup();
  act(() => hook.result.current.interruptVoice());
  expect(onError).not.toHaveBeenCalled();
  await act(() => hook.result.current.startVoice());
  act(() => hook.result.current.interruptVoice());
  expect(recorder.stop).toHaveBeenCalled();
  expect(hook.result.current.voiceState).toBe("error");
  expect(onError).toHaveBeenLastCalledWith("app.recordingInterruptedPhraseAnswer");
});

it("hands over raw text without timing when the transcript needs review", async () => {
  vi.mocked(transcribeAudio).mockResolvedValue({ text: "Мerhaba", review_required: true } as Awaited<ReturnType<typeof transcribeAudio>>);
  const { hook, onTranscribed } = setup();
  await act(() => hook.result.current.startVoice());
  await act(() => hook.result.current.finishVoice());
  expect(onTranscribed).toHaveBeenCalledWith("Мerhaba", undefined);
  expect(hook.result.current.voiceTimingRef.current).toBeUndefined();
});

it("recommends a break after three transcripts in a row with foreign letters", async () => {
  vi.mocked(transcribeAudio).mockResolvedValue({ text: "Мерхаба", review_required: true } as Awaited<ReturnType<typeof transcribeAudio>>);
  const { hook } = setup();
  for (let round = 0; round < 3; round++) {
    expect(hook.result.current.transcriptionBreakRecommended).toBe(false);
    await act(() => hook.result.current.startVoice());
    await act(() => hook.result.current.finishVoice());
  }
  expect(hook.result.current.transcriptionBreakRecommended).toBe(true);
});
