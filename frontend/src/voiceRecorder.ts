import type { AttemptTimings } from "./types/training";

export type VoiceRecording = {
  audio: Blob;
  timing: AttemptTimings;
};

export function supportsVoiceRecording(): boolean {
  return typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Why the microphone could not be started. "denied": the browser, the device or the app hosting the
 * page refused access (possibly without showing a prompt); "unsupported": this browser has no
 * recording API; "other": no device, device busy, timeout or a recorder failure.
 */
export type MicrophoneFailure = "denied" | "unsupported" | "other";

export class VoiceRecordingUnsupportedError extends Error {
  override name = "VoiceRecordingUnsupportedError";
}

export function microphoneFailureOf(error: unknown): MicrophoneFailure {
  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  if (name === "VoiceRecordingUnsupportedError") return "unsupported";
  // PermissionDeniedError is the legacy name some embedded webviews still use.
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  return "other";
}

export class VoiceRecorder {
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private startedAt?: number;
  private stopped = false;
  private discard = false;

  async start(): Promise<void> {
    if (!supportsVoiceRecording()) throw new VoiceRecordingUnsupportedError("Voice recording is not supported in this browser");

    // The simulator test build records a bundled phrase instead (ADR-0014); this branch and its module
    // are removed from every other build. getUserMedia stays synchronous in the tap.
    const pendingStream =
      import.meta.env.VITE_TEST_AUDIO === "true"
        ? testAudioStream()
        : navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
    pendingStream
      .then(stream => {
        if (this.stopped) stream.getTracks().forEach(track => track.stop());
      })
      .catch(() => undefined);

    try {
      this.stream = await withTimeout(pendingStream, 30_000, "Microphone selection timed out");
      if (this.stopped) return;

      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(this.stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 64_000,
      });
      this.recorder = recorder;
      recorder.addEventListener("dataavailable", event => {
        if (!this.discard && event.data.size > 0) this.chunks.push(event.data);
      });
      recorder.start(500);
      this.startedAt = performance.now();
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  async finish(): Promise<VoiceRecording> {
    const recorder = this.recorder;
    if (this.stopped || !recorder || recorder.state === "inactive") {
      throw new Error("Voice recording is not active");
    }

    const onStop = () => resolveFinished();
    const onError = () => rejectFinished(new Error("Voice recording failed"));
    let resolveFinished!: () => void;
    let rejectFinished!: (error: Error) => void;
    const finished = new Promise<void>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    });
    recorder.addEventListener("stop", onStop);
    recorder.addEventListener("error", onError);
    try {
      recorder.stop();
      this.stopTracks();
      await withTimeout(finished, 30_000, "Microphone stop timed out");
    } catch (error) {
      this.stop();
      throw error;
    } finally {
      recorder.removeEventListener("stop", onStop);
      recorder.removeEventListener("error", onError);
    }
    this.stopped = true;

    const contentType = recorder.mimeType || this.chunks[0]?.type || "audio/webm";
    const audio = new Blob(this.chunks, { type: contentType });
    const durationMs = Math.max(0, Math.round(performance.now() - (this.startedAt ?? performance.now())));
    this.chunks = [];
    return {
      audio,
      timing: {
        reaction_ms: null,
        speech_duration_ms: durationMs,
        longest_pause_ms: null,
        pause_count: null,
        timings: { source: "media_recorder", audio_stored: false },
      },
    };
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.discard = true;
    try {
      if (this.recorder?.state !== "inactive") this.recorder?.stop();
    } catch {
      /* The stream and buffered chunks must still be released. */
    }
    this.stopTracks();
    this.chunks = [];
  }

  private stopTracks(): void {
    const stream = this.stream;
    this.stream = undefined;
    stream?.getTracks().forEach(track => track.stop());
  }
}

function testAudioStream(): Promise<MediaStream> {
  // Created synchronously in the tap: WKWebView starts audio only from a user gesture.
  const context = new AudioContext();
  void context.resume().catch(() => undefined);
  return import("./testBuild/fakeMicrophone").then(
    module => module.fakeMicrophoneStream(context),
    (error: unknown) => {
      void context.close();
      throw error;
    },
  );
}

function preferredMimeType(): string | undefined {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}
