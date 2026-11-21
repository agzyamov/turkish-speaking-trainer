// Local demo, not a test: opens the real app in a visible browser with demonstration data and a mocked API,
// so it can be clicked through without keys, a backend or Supabase. Speak into the real microphone; the
// transcript and grade are canned. Close the Playwright Inspector window (or press Ctrl+C) to finish.
// Run: pnpm demo            (Russian)    DEMO_LANG=en pnpm demo    (English)
import { test } from "@playwright/test";
import { openDemo } from "./demoApi.mjs";

test("local demo", async ({ browser }) => {
  test.setTimeout(0);
  const language = process.env.DEMO_LANG === "en" ? "en" : "ru";
  const phone = process.env.DEMO_LAYOUT !== "desktop";
  const context = await browser.newContext({
    viewport: phone ? { width: 393, height: 851 } : { width: 1440, height: 900 },
    permissions: ["microphone"],
  });
  const page = await context.newPage();
  await openDemo(page, language, { syntheticMicrophone: false });
  await page.pause();
});
