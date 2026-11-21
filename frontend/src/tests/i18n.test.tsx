import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getLanguage, getLocale, localizedPhrase, setLanguage, t, topicText } from "../i18n";
import phrases from "../locales/phrases.en.json";
import messages from "../locales/en.json";
import { sourceWords, splitHintFragments } from "../sourceWords";
import { SettingsView } from "../SettingsView";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLanguage("ru");
  localStorage.clear();
});

it("places language first and switches settings immediately", () => {
  const view = render(<SettingsView />);
  expect(view.container.querySelector("fieldset")).toHaveClass("language-settings");
  fireEvent.click(screen.getByRole("radio", { name: "English" }));
  expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  expect(document.documentElement.lang).toBe("en");
  expect(localStorage.getItem("turktalk.interface-language")).toBe("en");
  cleanup();
  render(<SettingsView />);
  expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: "Русский" }));
  expect(screen.getByRole("heading", { name: "Настройки" })).toBeInTheDocument();
});

it("translates dynamic counts and errors while preserving unknown text and Turkish", () => {
  setLanguage("en");
  expect(t("3 из 10 фраз осталось")).toBe("3 of 10 phrases remaining");
  expect(t("Сервер вернул ошибку HTTP 503.")).toBe("The server returned HTTP error 503.");
  expect(t("Дневной лимит фраз исчерпан. Новые фразы будут доступны после обновления лимита.")).toBe("Daily phrase limit reached. New phrases will be available after the limit resets.");
  expect(t("My own topic")).toBe("My own topic");
  expect(t("constructor")).toBe("constructor");
  expect(t("toString")).toBe("toString");
  expect(topicText("bank", "Банк")).toBe("Bank");
  expect(topicText("custom-topic", "Банк")).toBe("Банк");
  expect(t("Yeni bir hesap açmak istiyorum.")).toBe("Yeni bir hesap açmak istiyorum.");
  expect(getLocale()).toBe("en-GB");
  for (const [source, translation] of Object.entries(messages)) {
    const rendered = source.replace(/\{(\d+)\}/g, (_, index: string) => `value${index}`);
    expect(t(rendered), source).toBe(translation.replace(/\{(\d+)\}/g, (_, index: string) => `value${index}`));
  }
});

it("keeps a complete English catalog of all 210 canonical Turkish phrases with independent hints", () => {
  // phrases.en.json is generated from the backend catalogue (scripts/export_phrases_en.py);
  // the backend test suite checks that it is up to date, so this test reads no backend file.
  expect(phrases).toHaveLength(210);
  expect(new Set(phrases.map(phrase => phrase.id)).size).toBe(210);
  expect(new Set(phrases.map(phrase => phrase.source_ru)).size).toBe(210);
  setLanguage("en");
  for (const phrase of phrases) {
    expect(phrase.source_en).not.toMatch(/[А-Яа-яЁё]/);
    expect(t(phrase.source_ru)).toBe(phrase.source_en);
    expect(Object.keys(localizedPhrase(phrase.source_ru).hints).length).toBeGreaterThan(0);
    expect(splitHintFragments(phrase.source_en, Object.keys(phrase.word_hints)).join("")).toBe(phrase.source_en);
    for (const [word, hint] of Object.entries(phrase.word_hints)) {
      expect(phrase.source_en.toLowerCase()).toContain(word);
      expect(hint).not.toHaveProperty("word_ru");
      expect(hint.translation_tr.trim()).not.toBe("");
      expect(sourceWords(word).length).toBeLessThanOrEqual(4);
      const target = sourceWords(hint.translation_tr).join(" ").toLowerCase();
      expect(` ${sourceWords(phrase.canonical_tr).join(" ").toLowerCase()} `).toContain(` ${target} `);
      expect(sourceWords(hint.translation_tr).length).toBeLessThanOrEqual(5);
      if ("note" in hint && typeof hint.note === "string") {
        expect(messages).toHaveProperty(hint.note);
        expect(t(hint.note)).not.toBe(hint.note);
      }
    }
  }
  setLanguage("ru");
  expect(localizedPhrase(phrases[0].source_ru)).toEqual({ source: phrases[0].source_ru, hints: {} });
  setLanguage("en");
  expect(localizedPhrase(phrases[0].source_ru, false)).toEqual({ source: phrases[0].source_ru, hints: {} });
});

it("keeps the choice active if browser storage is blocked", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  setLanguage("en");
  expect(getLanguage()).toBe("en");
  expect(t("Настройки")).toBe("Settings");
});

it("keeps compound words intact and corrects the reported lexical hints", () => {
  setLanguage("en");
  const vacation = phrases.find(phrase => phrase.id === "vacation-10")!;
  const hints = localizedPhrase(vacation.source_ru).hints;
  expect(hints.best?.translation_tr).toBe("en iyi");
  expect(hints.time).toBeUndefined();
  expect(hints["to buy"]?.translation_tr).toBe("almak");
  expect(hints.when?.translation_tr).toBe("ne zaman");
  const job = phrases.find(phrase => phrase.id === "job-interview-01")!;
  expect(localizedPhrase(job.source_ru).hints.i).toBeUndefined();
  expect(localizedPhrase(job.source_ru).hints.work?.translation_tr).toBe("çalışıyorum");
  const bank = phrases.find(phrase => phrase.id === "bank-07")!;
  expect(sourceWords(bank.source_en)).toContain("bank's");
  expect(localizedPhrase(bank.source_ru).hints["bank's"]?.translation_tr).toBe("Bankanızın");
  const flat = phrases.find(phrase => phrase.id === "rent-01")!;
  expect(sourceWords(flat.source_en)).toContain("two-room");
  expect(localizedPhrase(flat.source_ru).hints["two-room"]?.translation_tr).toBe("iki odalı");
  const journey = phrases.find(phrase => phrase.id === "transport-06")!;
  expect(localizedPhrase(journey.source_ru).hints["how long"]?.translation_tr).toBe("ne kadar");
  expect(localizedPhrase(journey.source_ru).hints.long).toBeUndefined();
  expect(localizedPhrase(journey.source_ru).hints.take?.translation_tr).toBe("sürüyor");
  expect(sourceWords("Нью-Йорка и two-room")).toEqual(["Нью-Йорка", "и", "two-room"]);
});

it("selects saved bilingual custom titles and preserves legacy fallback", () => {
  setLanguage("en");
  expect(topicText("custom-one", "Мои путешествия", "My travels")).toBe("My travels");
  expect(topicText("custom-old", "Старая тема", null)).toBe("Старая тема");
  setLanguage("ru");
  expect(topicText("custom-one", "Мои путешествия", "My travels")).toBe("Мои путешествия");
});
