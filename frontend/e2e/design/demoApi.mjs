// Demonstration data and a mocked API for the phone screens: used by the landing screenshots and the local demo.
import { installSyntheticMicrophone } from "../flow.mjs";

const topics = [
  ["vacation", "Отпуск", "Holiday", 24],
  ["cafe", "В кафе", "At a café", 18],
  ["bank", "В банке", "At the bank", 20],
  ["doctor", "У врача", "At the doctor", 22],
  ["transport", "Транспорт", "Transport", 21],
  ["rent", "Аренда жилья", "Renting a flat", 19],
  ["work", "На работе", "At work", 23],
  ["job-interview", "Собеседование", "Job interview", 20],
].map(([id, title_ru, title_en, phrase_count]) => ({ id, title_ru, title_en, description_ru: "", likely_intents: [], suggested_vocabulary: [], is_custom: false, phrase_count }));
const source = "Прошлым летом мы отдыхали на Эгейском море.";
const canonical = "Geçen yaz Ege'de tatil yaptık.";
const session = {
  id: "s-1",
  status: "active",
  level: "A2",
  started_at: "2026-11-20T10:00:00Z",
  requested_length: 10,
  completed_count: 4,
  topic: { ...topics[0], source: "preset", target_level: "A2", excluded_domains: [], normalized_prompt_context: "" },
};
const exercise = { id: "e-1", session_id: "s-1", source_ru: source, targeted_skills: [], expected_level: "A2", difficulty: 0.4, word_hints: [] };
const account = {
  id: "u-1",
  email: "learner@example.invalid",
  display_name: "Анна",
  avatar_url: null,
  role: "user",
  access_tier: "free",
  registered_at: "2026-09-01T10:00:00Z",
  last_active_at: "2026-11-20T10:00:00Z",
  daily_usage: { used: 7, limit: 20, remaining: 13, resets_at: "2026-11-21T00:00:00Z" },
};
const transcript = { text: "Geçen yaz Ege'de tatil yaptik.", raw_text: "Geçen yaz Ege'de tatil yaptik.", transcription_id: "t-1", assistance_status: "analyzed", changes: [] };
// The model writes its feedback in the interface language; the English run shows English feedback.
const feedback = {
  ru: { detail: "Смысл передан. Прошедшее время на -dı/-di согласуется по гармонии гласных: «yaptık».", issue: "После «a» в корне нужна «ı»: yap-tı-k." },
  en: { detail: "The meaning is right. The past tense -dı/-di follows vowel harmony: “yaptık”.", issue: "After “a” in the stem the suffix takes “ı”: yap-tı-k." },
};
const attemptFor = language => ({
  id: "a-1",
  exercise_id: "e-1",
  transcript_tr: "Geçen yaz Ege'de tatil yaptik.",
  overall_score: 0.92,
  base_score: 0.92,
  hint_penalty: 0,
  daily_usage: account.daily_usage,
  analysis: {
    verdict: "mostly_correct",
    semantic_score: 1,
    grammar_score: 0.9,
    lexical_score: 0.9,
    naturalness_score: 0.9,
    pronunciation_score: null,
    fluency_score: 1,
    corrected_tr: canonical,
    short_feedback_ru: "Почти верно.",
    detailed_feedback_ru: feedback[language].detail,
    accepted_alternatives: [],
    issues: [{ type: "grammar", skill_key: "grammar.past_di", severity: 0.3, confidence: 0.9, evidence: "yaptik", correction: "yaptık", explanation_ru: feedback[language].issue }],
    demonstrated_skills: [],
  },
});
function week() {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  return [12, 21, 8, 0, 15, 0, 0].map((count, index) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    return { date, phrase_count: count, translation_count: count, correct_translation_count: Math.round(count * 0.7), mastered_phrase_count: Math.round(count / 4) };
  });
}

export async function openDemo(page, language, { syntheticMicrophone = true } = {}) {
  if (syntheticMicrophone) await installSyntheticMicrophone(page);
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body = {};
    if (path === "/api/auth/me") body = account;
    else if (path === "/api/auth/me/preferences") body = { assistance_enabled: false };
    else if (path === "/api/topics") body = topics;
    else if (path === "/api/review-phrases/summary") body = { phrase_count: 6 };
    else if (path === "/api/sessions/start") body = { session, exercise };
    else if (path === "/api/transcriptions") body = transcript;
    else if (path === "/api/attempts") body = attemptFor(language);
    else if (path === "/api/statistics/monthly") {
      const days = week();
      body = { month: url.searchParams.get("month"), active_days: 4, total_phrases: 56, total_translations: 56, correct_translations: 40, mastered_phrases: 14, days };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/privacy");
  await page.evaluate(language => {
    localStorage.setItem("turktalk.interface-language", language);
    localStorage.setItem(
      "sb-e2e-auth-auth-token",
      JSON.stringify({
        access_token: "e2e-local-only",
        refresh_token: "e2e-local-only",
        token_type: "bearer",
        expires_in: 31536000,
        expires_at: 4102444800,
        user: { id: "u-1", aud: "authenticated", role: "authenticated", email: "learner@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-09-01T10:00:00Z" },
      }),
    );
  }, language);
  await page.goto("/");
}
