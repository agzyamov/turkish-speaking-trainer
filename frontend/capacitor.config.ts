import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.serbiantalk.trainer",
  // Keep in step with brand.name in src/shared/brand.ts (ADR-0005). appId stays until the owner renames the
  // Android package and builds (C-24): changing it here alone would not match the native project.
  appName: "TurkTalk",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
