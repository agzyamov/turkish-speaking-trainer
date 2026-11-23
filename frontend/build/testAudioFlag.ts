/**
 * VITE_TEST_AUDIO=true makes the iOS simulator test build (ADR-0014): a fake microphone and on-device
 * transcription. Only scripts/build-ios.sh sim may set it, in the process environment for the native-app
 * mode. A value from an env file (.env.local, .env.android.local, ...) is refused, because the build
 * scripts can clear only the process environment and a file would silently turn real builds into test builds.
 * `loadedEnv` is Vite's loadEnv result (files merged with the process environment, which wins).
 */
export function validateTestAudioFlag(mode: string, loadedEnv: Record<string, string | undefined>, processEnv: Record<string, string | undefined>): void {
  if (loadedEnv.VITE_TEST_AUDIO !== "true") return;
  if (processEnv.VITE_TEST_AUDIO !== "true") {
    throw new Error("VITE_TEST_AUDIO=true comes from an env file; remove it there. Only scripts/build-ios.sh sim sets it, in the environment.");
  }
  if (mode !== "android" || processEnv.VERCEL_ENV) {
    throw new Error("VITE_TEST_AUDIO is only for the iOS simulator test build (scripts/build-ios.sh sim).");
  }
}
