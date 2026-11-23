// Test build only (ADR-0014). Loaded through a dynamic import guarded by VITE_TEST_AUDIO, so normal
// web, Android and App Store builds contain neither this module nor the audio fixture
// (checked by frontend/build/checkNoTestAudio.mjs).
// Inlined as a data URL into this chunk: no request is made (C-20) and no separate file is emitted.
import phraseDataUrl from "./phrase.m4a?inline";

/** Present in every bundle that contains this module; the build check looks for it. */
export const TEST_AUDIO_MARKER = "turktalk-test-audio-build";

/**
 * A microphone stand-in: plays the bundled Turkish phrase (macOS voice "Yelda") in a loop into a
 * MediaStream, so MediaRecorder records it until the learner taps stop. The caller creates and resumes
 * the context during the tap that starts recording, because WKWebView lets only a user gesture start
 * audio; resuming here, after the asynchronous import, could stay pending.
 */
export async function fakeMicrophoneStream(context: AudioContext): Promise<MediaStream> {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    void context.close().catch(() => undefined);
  };
  try {
    const buffer = await context.decodeAudioData(dataUrlBytes(phraseDataUrl));
    const destination = context.createMediaStreamDestination();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(destination);
    source.start();
    const stream = destination.stream;
    // The recorder releases its "microphone" by stopping the tracks; that also ends the playback.
    for (const track of stream.getTracks()) {
      const stopTrack = track.stop.bind(track);
      track.stop = () => {
        stopTrack();
        close();
      };
    }
    console.info(`${TEST_AUDIO_MARKER}: recording the bundled test phrase instead of the microphone`);
    return stream;
  } catch (error) {
    close();
    throw error;
  }
}

function dataUrlBytes(dataUrl: string): ArrayBuffer {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (bytes.byteLength === 0) throw new Error("Test audio fixture is empty");
  return bytes.buffer;
}
