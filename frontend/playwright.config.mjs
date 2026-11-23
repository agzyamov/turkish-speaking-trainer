import { defineConfig, devices } from "@playwright/test";

// Playwright's failure snapshot can serialize form values, including testlab credentials.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

const live = Boolean(process.env.TESTLAB_BASE_URL);
// Installed Google Chrome locally; CI sets E2E_BROWSER_CHANNEL=chromium for Playwright's bundled Chromium.
const chromiumChannel = process.env.E2E_BROWSER_CHANNEL ?? "chrome";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "./test-results",
  use: {
    baseURL: live ? process.env.TESTLAB_BASE_URL : "http://127.0.0.1:5179",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  // Browser engines and device profiles, not real devices: Playwright WebKit is not iOS Safari (see e2e/README.md).
  // Without `--project` every project runs; `--project chromium` keeps the previous single-browser run.
  // The live testlab run (TESTLAB_BASE_URL) stays on Chromium only, as before.
  projects: [
    { name: "chromium", use: { browserName: "chromium", channel: chromiumChannel } },
    ...(live
      ? []
      : [
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
          { name: "iphone", use: { ...devices["iPhone 15"] } },
          { name: "pixel", use: { ...devices["Pixel 7"], channel: chromiumChannel } },
        ]),
  ],
  webServer: live
    ? undefined
    : {
        command: "node node_modules/vite/bin/vite.js build --mode e2e --outDir dist-e2e && node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5179 --strictPort --outDir dist-e2e",
        url: "http://127.0.0.1:5179/",
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
          VITE_API_BASE_URL: "",
          VITE_SUPABASE_URL: "https://e2e-auth.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-public-key",
          VITE_PUBLIC_APP_URL: "https://turktalk.example/",
        },
      },
});
