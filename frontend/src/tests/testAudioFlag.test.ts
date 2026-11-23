import { describe, expect, it } from "vitest";
import { validateTestAudioFlag } from "../../build/testAudioFlag";

describe("VITE_TEST_AUDIO build guard", () => {
  it("allows the native-app build without the flag, and the simulator test build with it from the environment", () => {
    expect(() => validateTestAudioFlag("production", {}, {})).not.toThrow();
    expect(() => validateTestAudioFlag("android", { VITE_TEST_AUDIO: "" }, {})).not.toThrow();
    expect(() => validateTestAudioFlag("android", { VITE_TEST_AUDIO: "true" }, { VITE_TEST_AUDIO: "true" })).not.toThrow();
  });

  it("refuses a flag that comes from an env file, which the build scripts cannot clear", () => {
    expect(() => validateTestAudioFlag("android", { VITE_TEST_AUDIO: "true" }, {})).toThrow(/env file/);
    expect(() => validateTestAudioFlag("android", { VITE_TEST_AUDIO: "true" }, { VITE_TEST_AUDIO: "false" })).toThrow(/env file/);
  });

  it("refuses the flag for the web build and on Vercel", () => {
    expect(() => validateTestAudioFlag("production", { VITE_TEST_AUDIO: "true" }, { VITE_TEST_AUDIO: "true" })).toThrow(/simulator test build/);
    expect(() => validateTestAudioFlag("android", { VITE_TEST_AUDIO: "true" }, { VITE_TEST_AUDIO: "true", VERCEL_ENV: "production" })).toThrow(/simulator test build/);
  });
});
