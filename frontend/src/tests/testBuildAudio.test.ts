import { afterEach, describe, expect, it, vi } from "vitest";

import { transcribeAudio } from "../api/training";
import { fakeTranscription, MIN_TEST_RECORDING_BYTES, TEST_TRANSCRIPT } from "../testBuild/fakeTranscription";
import { VoiceRecorder } from "../voiceRecorder";

// The simulator test build (VITE_TEST_AUDIO=true, ADR-0014): a bundled phrase instead of the microphone,
// and the transcription answered on the device.

const fetched = vi.hoisted(() => [] as RequestInit[]);
vi.mock("../auth", () => ({
  authenticatedFetch: vi.fn(async (_url: string, init: RequestInit) => {
    fetched.push(init);
    return new Response(JSON.stringify({ text: "from the server" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }),
}));

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported(type: string) {
    return type === "audio/mp4";
  }
  state: RecordingState = "inactive";
  readonly mimeType = "audio/mp4";
  constructor(readonly stream: MediaStream) {
    super();
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    const dataEvent = new Event("dataavailable") as Event & { data: Blob };
    Object.defineProperty(dataEvent, "data", { value: new Blob([new Uint8Array(4_000)], { type: this.mimeType }) });
    this.dispatchEvent(dataEvent);
    this.dispatchEvent(new Event("stop"));
  }
}

/** Enough of the Web Audio API to see the fixture decoded, looped and routed into a stream. */
function fakeAudioContext() {
  const trackStop = vi.fn();
  const track = { stop: trackStop } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  const source = { buffer: null as AudioBuffer | null, loop: false, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const destination = { stream };
  const context = {
    state: "suspended",
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    decodeAudioData: vi.fn(async () => ({ duration: 2.6 }) as AudioBuffer),
    createMediaStreamDestination: vi.fn(() => destination),
    createBufferSource: vi.fn(() => source),
  };
  return { context, source, destination, stream, trackStop };
}

afterEach(() => {
  fetched.length = 0;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalMediaDevices) Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  else delete (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
});

describe("test build recorder", () => {
  it("records the bundled phrase without asking for the microphone, and releases the audio when done", async () => {
    vi.stubEnv("VITE_TEST_AUDIO", "true");
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    const audio = fakeAudioContext();
    const AudioContextStub = vi.fn(function () {
      return audio.context;
    });
    vi.stubGlobal("AudioContext", AudioContextStub);
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    const recorder = new VoiceRecorder();
    const started = recorder.start();
    // Created and resumed in the tap itself: WKWebView starts audio only from a user gesture.
    expect(AudioContextStub).toHaveBeenCalledTimes(1);
    expect(audio.context.resume).toHaveBeenCalledTimes(1);
    await started;

    expect(getUserMedia).not.toHaveBeenCalled();
    const decoded = audio.context.decodeAudioData.mock.calls[0] as unknown as [ArrayBuffer];
    expect(decoded[0].byteLength).toBeGreaterThan(1_000);
    expect(audio.source.loop).toBe(true);
    expect(audio.source.connect).toHaveBeenCalledWith(audio.destination);
    expect(audio.source.start).toHaveBeenCalled();

    const recording = await recorder.finish();
    expect(recording.audio.type).toBe("audio/mp4");
    expect(recording.audio.size).toBeGreaterThanOrEqual(MIN_TEST_RECORDING_BYTES);
    expect(audio.trackStop).toHaveBeenCalledOnce();
    expect(audio.context.close).toHaveBeenCalledOnce();
  });

  it("asks for the real microphone when the flag is off", () => {
    const getUserMedia = vi.fn(() => new Promise<MediaStream>(() => undefined));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    const AudioContextStub = vi.fn();
    vi.stubGlobal("AudioContext", AudioContextStub);
    const recorder = new VoiceRecorder();

    void recorder.start();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(AudioContextStub).not.toHaveBeenCalled();
    recorder.stop();
  });
});

describe("test build transcription", () => {
  const recording = (bytes: number, type = "audio/mp4") => new Blob([new Uint8Array(bytes)], { type });

  it("answers a usable recording with the canned transcript in the server's response shape", async () => {
    await expect(fakeTranscription(recording(4_000))).resolves.toMatchObject({ text: TEST_TRANSCRIPT, review_required: false, changes: [] });
    await expect(fakeTranscription(recording(4_000, "audio/webm;codecs=opus"))).resolves.toMatchObject({ text: TEST_TRANSCRIPT });
  });

  it("rejects an empty, tiny or non-audio recording, so a broken recorder shows an error", async () => {
    await expect(fakeTranscription(new Blob([], { type: "audio/mp4" }))).rejects.toMatchObject({ name: "TestRecordingRejectedError" });
    await expect(fakeTranscription(recording(MIN_TEST_RECORDING_BYTES - 1))).rejects.toMatchObject({ name: "TestRecordingRejectedError" });
    await expect(fakeTranscription(recording(4_000, ""))).rejects.toMatchObject({ name: "TestRecordingRejectedError" });
    await expect(fakeTranscription(recording(4_000, "text/plain"))).rejects.toMatchObject({ name: "TestRecordingRejectedError" });
  });

  it("is used instead of the network in the test build only", async () => {
    vi.stubEnv("VITE_TEST_AUDIO", "true");
    await expect(transcribeAudio("exercise", recording(4_000))).resolves.toMatchObject({ text: TEST_TRANSCRIPT });
    await expect(transcribeAudio("exercise", new Blob())).rejects.toMatchObject({ name: "TestRecordingRejectedError" });
    expect(fetched).toHaveLength(0);

    vi.unstubAllEnvs();
    await expect(transcribeAudio("exercise", recording(4_000))).resolves.toMatchObject({ text: "from the server" });
    expect(fetched).toHaveLength(1);
    expect((fetched[0].body as FormData).get("exercise_id")).toBe("exercise");
  });
});
