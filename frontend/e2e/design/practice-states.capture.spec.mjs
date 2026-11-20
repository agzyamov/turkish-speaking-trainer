// Design capture, not a regression test: renders the practice screen in its main states with a
// mocked API and saves screenshots for design review (Impeccable critique, before/after).
// Run: pnpm exec playwright test e2e/design/practice-states.capture.spec.mjs
// Output: ../artifacts/design/<CAPTURE_LABEL or "current">/practice-<state>-<width>.png
import { test } from "@playwright/test";
import { installSyntheticMicrophone } from "../flow.mjs";

const label = process.env.CAPTURE_LABEL ?? "current";
const topic = { id: "bank", title_ru: "В банке", description_ru: "Счёт и платежи", likely_intents: [], suggested_vocabulary: [], is_custom: false, phrase_count: 20 };
const session = { id: "s-1", status: "active", level: "A2", started_at: "2026-11-20T10:00:00Z", requested_length: 10, completed_count: 3,
  topic: { ...topic, source: "preset", target_level: "A2", excluded_domains: [], normalized_prompt_context: "" } };
const source = "Я хочу открыть новый текущий счёт.";
const canonical = "Yeni bir vadesiz hesap açmak istiyorum.";
const exercise = { id: "e-1", session_id: "s-1", source_ru: source, targeted_skills: [], expected_level: "A2", difficulty: 0.4,
  word_hints: [{ word_ru: "хочу", translation_tr: "istiyorum" }, { word_ru: "открыть", translation_tr: "açmak" }, { word_ru: "новый", translation_tr: "Yeni" }, { word_ru: "текущий счёт", translation_tr: "vadesiz hesap" }] };
const account = { id: "u-1", email: "learner@example.invalid", display_name: "Анна", avatar_url: null, role: "user", access_tier: "free",
  registered_at: "2026-09-01T10:00:00Z", last_active_at: "2026-11-20T10:00:00Z", daily_usage: { used: 7, limit: 20, remaining: 13, resets_at: "2026-11-21T00:00:00Z" } };
const analysis = (verdict, score, issues) => ({ verdict, semantic_score: score, grammar_score: score, lexical_score: score, naturalness_score: score,
  pronunciation_score: null, fluency_score: 1, corrected_tr: canonical, short_feedback_ru: verdict === "correct" ? "Верно." : "Почти верно.",
  detailed_feedback_ru: "Смысл передан. В турецком глагол желания стоит в конце: «açmak istiyorum».", accepted_alternatives: [], issues, demonstrated_skills: [] });

async function mock(page, { transcript, attempt }) {
  await installSyntheticMicrophone(page);
  await page.route("**/api/**", async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    let body, status = 200;
    if (path === "/api/auth/me") body = account;
    else if (path === "/api/auth/me/android-premium") body = { ...account, access_tier: "premium" };
    else if (path === "/api/auth/me/preferences") body = { assistance_enabled: true };
    else if (path === "/api/topics") body = [topic];
    else if (path === "/api/review-phrases/summary") body = { phrase_count: 4 };
    else if (path === "/api/sessions/start") body = { session, exercise };
    else if (path.startsWith("/api/exercises/") && path.endsWith("/word-hints")) body = { word_ru: "хочу", translation_tr: "istiyorum", is_learning: true };
    else if (path === "/api/transcriptions") body = transcript;
    else if (path === "/api/attempts" && method === "POST") ({ status, body } = attempt());
    else body = {};
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/privacy");
  await page.evaluate(() => localStorage.setItem("sb-e2e-auth-auth-token", JSON.stringify({ access_token: "e2e-local-only", refresh_token: "e2e-local-only",
    token_type: "bearer", expires_in: 31536000, expires_at: 4102444800, user: { id: "u-1", aud: "authenticated", role: "authenticated", email: "learner@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-09-01T10:00:00Z" } })));
}

const transcriptWithSuggestion = { text: "Yeni bir vadesiz hesap acmak istiyorum.", raw_text: "Yeni bir vadesiz hesap acmak istiyorum.", transcription_id: "t-1", assistance_status: "analyzed",
  changes: [{ start: 23, end: 28, original: "acmak", replacement: "açmak", kind: "phonetic_ambiguity", action: "suggested", reason_code: "confirm_ambiguous_sound" }] };
const needsWork = () => ({ body: { id: "a-1", exercise_id: "e-1", transcript_tr: "Yeni bir vadesiz hesap istiyorum açmak.", overall_score: 0.72, base_score: 0.8, hint_penalty: 0.08, daily_usage: account.daily_usage,
  analysis: analysis("mostly_correct", 0.8, [{ type: "word_order", skill_key: "grammar.necessity", severity: 0.6, confidence: 0.9, evidence: "istiyorum açmak", correction: "açmak istiyorum", explanation_ru: "Глагол «istiyorum» ставится после инфинитива." }]) } });
const correct = () => ({ body: { id: "a-2", exercise_id: "e-1", transcript_tr: canonical, overall_score: 1, base_score: 1, hint_penalty: 0, daily_usage: account.daily_usage, analysis: analysis("correct", 1, []) } });
const paused = () => ({ status: 503, body: { detail: { code: "analysis_unavailable", retryable: false, message: "paused",
  failure: { kind: "external_model", stage: "budget", reason: "user_daily_budget_exhausted", diagnostic_id: "00000000-0000-4000-8000-000000000001", retryable: false } } } });

for (const width of [1280, 390]) {
  const height = width > 600 ? 900 : 844;
  const shot = (page, state) => page.screenshot({ path: `../artifacts/design/${label}/practice-${state}-${width}.png` });
  async function open(page, attempt) {
    await page.setViewportSize({ width, height });
    await mock(page, { transcript: transcriptWithSuggestion, attempt });
    await page.goto("/");
    // The phone layout starts a session on its own; the desktop layout waits for a topic.
    const heading = page.getByRole("heading", { name: source }).filter({ visible: true });
    const topicButton = page.getByRole("button", { name: /В банке/ }).filter({ visible: true }).first();
    await heading.or(topicButton).first().waitFor();
    if (!(await heading.count())) await topicButton.click();
    await heading.first().waitFor();
  }
  async function record(page) {
    await page.getByRole("button", { name: "Ответить голосом" }).click();
    await page.getByRole("button", { name: "Завершить запись" }).click();
    await page.getByLabel("Ваш ответ").waitFor();
  }
  test(`practice states at ${width}px`, async ({ page }) => {
    await open(page, needsWork);
    await shot(page, "1-phrase");
    await page.getByRole("button", { name: "хочу" }).click();
    await page.waitForTimeout(300);
    await shot(page, "2-hint");
    await page.keyboard.press("Escape");
    await record(page);
    await shot(page, "3-transcript");
    await page.getByRole("button", { name: /Проверить/ }).first().click();
    await page.getByText("Почти верно", { exact: true }).filter({ visible: true }).first().waitFor();
    await shot(page, "4-result-needs-work");
  });
  test(`practice correct and paused at ${width}px`, async ({ page }) => {
    await open(page, correct);
    await record(page);
    await page.getByRole("button", { name: /Проверить/ }).first().click();
    await page.waitForTimeout(1200);
    await shot(page, "5-result-correct");
    // After the 2 s celebration the score row, prompt and answers remain with no overlay.
    await page.waitForTimeout(2500);
    await shot(page, "5-result-correct-settled");
  });
  test(`practice correct with reduced motion at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, correct);
    await record(page);
    await page.getByRole("button", { name: /Проверить/ }).first().click();
    await page.waitForTimeout(800);
    await shot(page, "5-result-correct-reduced-motion");
  });
  test(`practice paused at ${width}px`, async ({ page }) => {
    await open(page, paused);
    await record(page);
    await page.getByRole("button", { name: /Проверить/ }).first().click();
    await page.getByRole("alert").filter({ visible: true }).first().waitFor();
    await shot(page, "6-paused");
  });
}
