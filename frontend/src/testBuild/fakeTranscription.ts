// Test build only (ADR-0014). Loaded through a dynamic import guarded by VITE_TEST_AUDIO, so normal
// builds never contain it. It replaces POST /api/transcriptions only: the recording never leaves the
// device and no AI provider is called (C-14).
import type { TranscriptionResponse } from "../types/training";

export const TEST_TRANSCRIPT = "Merhaba, hesap açmak istiyorum.";

/** A recording of the looped test phrase is several kilobytes; a broken recorder gives nothing or a bare header. */
export const MIN_TEST_RECORDING_BYTES = 1_000;

const recordedAudioType = /^audio\/(mp4|webm|ogg|aac|mpeg|x-m4a)(;|$)/;

export class TestRecordingRejectedError extends Error {
  override name = "TestRecordingRejectedError";
}

/**
 * Checks the recording the way the server rejects an unusable one, then answers with the shape of the
 * real transcription response. A failed check throws, so the interface shows the transcription error
 * and the app test catches a broken recorder.
 */
export async function fakeTranscription(audio: Blob, signal?: AbortSignal): Promise<TranscriptionResponse> {
  if (signal?.aborted) throw new DOMException("Transcription request aborted", "AbortError");
  if (!recordedAudioType.test(audio.type)) throw new TestRecordingRejectedError(`Unexpected recording type "${audio.type}"`);
  if (audio.size < MIN_TEST_RECORDING_BYTES) throw new TestRecordingRejectedError(`Recording too small (${audio.size} bytes)`);
  return {
    review_required: false,
    text: TEST_TRANSCRIPT,
    raw_text: TEST_TRANSCRIPT,
    transcription_id: null,
    policy_version: null,
    changes: [],
    assistance_status: null,
  };
}
