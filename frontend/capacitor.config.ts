import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Keep in step with brand.name in src/shared/brand.ts (ADR-0005) and with applicationId in android/app/build.gradle.
  appId: "com.turktalk.trainer",
  appName: "TurkTalk",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
