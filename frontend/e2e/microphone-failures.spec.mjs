import { expect, test } from "@playwright/test";
import { installAccountRoutes } from "./accountRoutes.mjs";

// Microphone failures as a browser reports them, with stubs only: no real microphone, no audio, no provider.
// The checks are about behaviour (an alert or status appears, the app keeps working, the typed answer path
// still reaches feedback), not about the exact error wording, which is expected to change. Every visible
// text this spec depends on is in `labels` below, so a wording change is a one-place update.
const labels = {
  answerAloud: "Ответить голосом",
  typeManually: "Ввести ответ вручную",
  answer: "Ваш ответ",
  check: "Проверить ответ",
};

const topic = {
  id: "bank",
  title_ru: "В банке",
  description_ru: "Счёт и платежи",
  likely_intents: ["открыть счёт"],
  suggested_vocabulary: ["hesap"],
  is_custom: false,
  phrase_count: 20,
};
const session = {
  id: "session-mic",
  status: "active",
  level: "A2",
  started_at: "2026-09-29T10:00:00Z",
  requested_length: 10,
  completed_count: 0,
  topic: { ...topic, source: "preset", target_level: "A2", excluded_domains: [], normalized_prompt_context: "Разговор в банке" },
};
const exercise = { id: "exercise-mic", session_id: session.id, source_ru: "Я хочу открыть счёт.", targeted_skills: [], expected_level: "A2", difficulty: 1, word_hints: [] };
const typedAnswer = "Hesap açmak istiyorum.";
const account = {
  id: "user-mic",
  email: "learner@example.invalid",
  display_name: "Ученик",
  avatar_url: null,
  role: "user",
  access_tier: "free",
  registered_at: "2026-09-01T10:00:00Z",
  last_active_at: "2026-09-29T10:00:00Z",
  daily_usage: { used: 0, limit: 10, remaining: 10, resets_at: "2026-09-30T00:00:00Z" },
};

/**
 * Replaces the browser's recording API before the app loads.
 * - `{ reject: "NotAllowedError" | "NotFoundError" }`: getUserMedia exists and rejects with that DOMException,
 *   as a browser does when permission is denied or no input device exists.
 * - `{ missing: true }`: no `navigator.mediaDevices` and no `MediaRecorder`, as on an insecure origin or an old browser.
 * Records how often getUserMedia was asked, so a spec can tell "not attempted" from "attempted and failed".
 */
async function installFailingMicrophone(page, failure) {
  await page.addInitScript(({ reject, missing }) => {
    window.__micRequests = 0;
    if (missing) {
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, get: () => undefined });
      Object.defineProperty(window, "MediaRecorder", { configurable: true, writable: true, value: undefined });
      return;
    }
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          window.__micRequests += 1;
          throw new DOMException("Synthetic microphone failure", reject);
        },
      },
    });
    class UnusedRecorder extends EventTarget {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      start() {
        throw new Error("MediaRecorder must not start without a stream");
      }
      stop() {}
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: UnusedRecorder });
  }, failure);
}

async function openPractice(page, failure) {
  const pageErrors = [];
  const attempts = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await installFailingMicrophone(page, failure);
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let body;
    if (path === "/api/auth/me" && method === "GET") body = account;
    else if (path === "/api/topics" && method === "GET") body = [topic];
    else if (path === "/api/review-phrases/summary" && method === "GET") body = { phrase_count: 0 };
    else if (path === "/api/sessions/start" && method === "POST") body = { session, exercise };
    else if (path === "/api/attempts" && method === "POST") {
      attempts.push(request.postDataJSON().transcript_tr);
      body = {
        id: "attempt-mic",
        exercise_id: exercise.id,
        transcript_tr: attempts.at(-1),
        overall_score: 0.95,
        base_score: 0.95,
        hint_penalty: 0,
        daily_usage: account.daily_usage,
        analysis: {
          verdict: "correct",
          semantic_score: 0.95,
          grammar_score: 0.95,
          lexical_score: 0.95,
          naturalness_score: 0.95,
          pronunciation_score: null,
          fluency_score: 1,
          corrected_tr: typedAnswer,
          short_feedback_ru: "Верный перевод.",
          detailed_feedback_ru: "Верный перевод.",
          accepted_alternatives: [],
          issues: [],
          demonstrated_skills: [],
        },
      };
    } else if (path === `/api/sessions/${session.id}/next-exercise` && method === "POST") body = { ...exercise, id: "exercise-mic-next", source_ru: "Мы можем поговорить завтра." };
    // No transcription endpoint: a failed microphone must never upload anything.
    if (body === undefined) throw new Error(`Unexpected mocked API request: ${method} ${path}`);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await installAccountRoutes(page, { preferences: true });
  await page.goto("/privacy");
  await page.evaluate(() =>
    localStorage.setItem(
      "sb-e2e-auth-auth-token",
      JSON.stringify({
        access_token: "e2e-mic-only",
        refresh_token: "e2e-mic-only",
        token_type: "bearer",
        expires_in: 60 * 60 * 24 * 365,
        expires_at: 4102444800,
        user: { id: "user-mic", aud: "authenticated", role: "authenticated", email: "learner@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-09-01T10:00:00Z" },
      }),
    ),
  );
  await page.goto("/");
  // The app opens the only topic's first phrase directly, at desktop and phone width alike.
  await expect(page.getByRole("heading", { name: exercise.source_ru })).toBeVisible();
  return { pageErrors, attempts };
}

async function voiceStatus(page) {
  const status = page.getByRole("status").filter({ hasText: /\S/ }).last();
  await expect(status).toBeVisible();
  return status;
}

async function answerByTyping(page, attempts) {
  await page.getByRole("button", { name: labels.typeManually }).click();
  const answer = page.getByLabel(labels.answer);
  await expect(answer).toBeVisible();
  await answer.fill(typedAnswer);
  await page.getByRole("button", { name: labels.check }).click();
  await expect(page.getByText("95%").first()).toBeVisible();
  expect(attempts).toEqual([typedAnswer]);
}

for (const reject of ["NotAllowedError", "NotFoundError"]) {
  test(`getUserMedia ${reject}: alert shown, mic usable again, typed answer still checked`, async ({ page }) => {
    const { pageErrors, attempts } = await openPractice(page, { reject });
    const status = await voiceStatus(page);
    const idleStatus = await status.textContent();

    await page.getByRole("button", { name: labels.answerAloud }).click();
    await expect.poll(() => page.evaluate(() => window.__micRequests)).toBe(1);
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).not.toHaveText("");
    await expect(status).not.toHaveText(idleStatus ?? "");
    // Back to idle: the learner can try again (e.g. after allowing access) without reloading.
    const mic = page.getByRole("button", { name: labels.answerAloud });
    await expect(mic).toBeEnabled();
    await mic.click();
    await expect.poll(() => page.evaluate(() => window.__micRequests)).toBe(2);
    await expect(page.getByRole("alert")).toBeVisible();

    await answerByTyping(page, attempts);
    expect(pageErrors).toEqual([]);
  });
}

test("no recording API: mic disabled with a status, typed answer still checked", async ({ page }) => {
  const { pageErrors, attempts } = await openPractice(page, { missing: true });
  expect(await page.evaluate(() => navigator.mediaDevices)).toBeUndefined();
  await expect(page.getByRole("button", { name: labels.answerAloud })).toBeDisabled();
  const status = await voiceStatus(page);
  await expect(status).not.toHaveText("");

  await answerByTyping(page, attempts);
  expect(pageErrors).toEqual([]);
});
