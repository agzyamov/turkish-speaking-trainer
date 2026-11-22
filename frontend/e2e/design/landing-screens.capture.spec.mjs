// Landing screenshots, not a regression test: renders the phone layout of the current app with
// demonstration data and writes the three images the landing page shows, in Russian and English.
// Run: pnpm exec playwright test e2e/design/landing-screens.capture.spec.mjs
// Output: public/landing/screens/phone/<ru|en>-<topics|practice|feedback>.jpg (1280 x 2772)
import { test } from "@playwright/test";
import { openDemo } from "./demoApi.mjs";

for (const language of ["ru", "en"]) {
  test(`landing screens ${language}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 1280 / 393, reducedMotion: "reduce" });
    const page = await context.newPage();
    const ru = language === "ru";
    const shot = name => page.screenshot({ path: `public/landing/screens/phone/${language}-${name}.jpg`, type: "jpeg", quality: 82 });
    await openDemo(page, language);
    await page.locator(".interactive-phrase:visible").waitFor();
    await page.waitForTimeout(300);
    await shot("practice");
    await page.getByRole("button", { name: ru ? "Ответить голосом" : "Answer aloud" }).click();
    await page.getByRole("button", { name: ru ? "Завершить запись" : "Finish recording" }).click();
    await page.getByRole("button", { name: ru ? "Проверить ответ" : "Check answer" }).click();
    await page.locator(".feedback:visible").waitFor();
    await page.waitForTimeout(300);
    await shot("feedback");
    await page.getByRole("button", { name: ru ? "Темы" : "Topics", exact: true }).click();
    await page.locator(".android-topic-list").waitFor();
    await page.waitForTimeout(300);
    await shot("topics");
    await context.close();
  });
}
