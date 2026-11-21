// Design capture, not a regression test: renders the app shell (header, topic chooser, welcome
// card, statistics, premium) with a mocked API and saves screenshots for design review.
// Run: pnpm exec playwright test e2e/design/shell.capture.spec.mjs
// Output: ../artifacts/design/<CAPTURE_LABEL or "current">/shell-<state>-<width>.png
import { test } from "@playwright/test";

const label = process.env.CAPTURE_LABEL ?? "current";
const topics = [
  { id: "bank", title_ru: "В банке", title_en: "At the bank", description_ru: "Счёт, карта и платежи", likely_intents: [], suggested_vocabulary: [], is_custom: false, phrase_count: 20 },
  { id: "cafe", title_ru: "В кафе", title_en: "At a café", description_ru: "Заказ и счёт", likely_intents: [], suggested_vocabulary: [], is_custom: false, phrase_count: 18 },
  { id: "doctor", title_ru: "У врача", title_en: "At the doctor", description_ru: "Симптомы и запись", likely_intents: [], suggested_vocabulary: [], is_custom: false, phrase_count: 24 },
  { id: "transport", title_ru: "Транспорт", title_en: "Transport", description_ru: "Билеты и маршруты", likely_intents: [], suggested_vocabulary: [], is_custom: false, phrase_count: 22 },
];
const account = { id: "u-1", email: "learner@example.invalid", display_name: "Анна", avatar_url: null, role: "user", access_tier: "free",
  registered_at: "2026-09-01T10:00:00Z", last_active_at: "2026-11-20T10:00:00Z", daily_usage: { used: 7, limit: 20, remaining: 13, resets_at: "2026-11-21T00:00:00Z" } };

async function mock(page) {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body = {};
    if (path === "/api/auth/me") body = account;
    else if (path === "/api/auth/me/android-premium") body = account;
    else if (path === "/api/auth/me/preferences") body = { assistance_enabled: true };
    else if (path === "/api/topics") body = topics;
    else if (path === "/api/review-phrases/summary") body = { phrase_count: 4 };
    else if (path === "/api/sessions/start") { await route.abort(); return; }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/privacy");
  await page.evaluate(() => localStorage.setItem("sb-e2e-auth-auth-token", JSON.stringify({ access_token: "e2e-local-only", refresh_token: "e2e-local-only",
    token_type: "bearer", expires_in: 31536000, expires_at: 4102444800, user: { id: "u-1", aud: "authenticated", role: "authenticated", email: "learner@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-09-01T10:00:00Z" } })));
}

for (const width of [1280, 390]) {
  const height = width > 600 ? 900 : 844;
  const shot = (page, state) => page.screenshot({ path: `../artifacts/design/${label}/shell-${state}-${width}.png` });
  test(`shell ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mock(page);
    await page.goto("/");
    if (width < 600) {
      await page.getByRole("button", { name: "Темы", exact: true }).click();
      await page.getByRole("button", { name: /В банке/ }).waitFor();
      await shot(page, "topics");
      await page.getByRole("button", { name: "Тренировка", exact: true }).click();
      await shot(page, "welcome");
    } else {
      await page.getByRole("button", { name: /В банке/ }).waitFor();
      await shot(page, "welcome");
      await page.getByRole("button", { name: /У врача/ }).click();
      await shot(page, "topic-selected");
    }
    await page.getByRole("button", { name: "Статистика", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await shot(page, "statistics");
    await page.getByRole("button", { name: "Премиум", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await shot(page, "premium");
  });
}
