import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { resolve } from "node:path";
import { validateAndroidEnvironment, validateHostedWebEnvironment } from "./build/androidEnvironment.ts";
import { validateTestAudioFlag } from "./build/testAudioFlag.ts";

export default defineConfig(({ mode }) => {
  // The "android" mode is the native-app build mode: the iOS app uses it too (ios:sync), with the same .env.android (ADR-0013).
  if (mode === "android") validateAndroidEnvironment(loadEnv(mode, process.cwd(), "VITE_"));
  // Vercel sets VERCEL_ENV on its builds; local and CI builds may keep the API relative for mocks.
  else if (process.env.VERCEL_ENV) validateHostedWebEnvironment({ ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env });
  // The fake microphone and on-device transcription belong to the simulator test build only (ADR-0014).
  validateTestAudioFlag(mode, loadEnv(mode, process.cwd(), "VITE_"), process.env);
  const input: Record<string, string> = { main: resolve("index.html") };
  if (mode === "testlab") input.testlab = resolve("testlab.html");
  else if (mode !== "android") input.landing = resolve("landing.html");
  return {
    plugins: [react(), tailwindcss()],
    build: {
      copyPublicDir: mode !== "android",
      rollupOptions: {
        input,
      },
    },
    server: {
      proxy: {
        "/api": "http://127.0.0.1:8000",
      },
    },
    test: {
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      environment: "jsdom",
      setupFiles: "./src/tests/setup.ts",
      // A reserved example domain, so the share settings render in tests.
      env: { VITE_PUBLIC_APP_URL: "https://turktalk.example/", VITE_SUPPORT_EMAIL: "support@turktalk.example" },
    },
  };
});
