import { useSyncExternalStore } from "react";
import i18next from "i18next";
import messages from "./locales/en.json";
import ruUi from "./locales/ru/ui.json";
import enUi from "./locales/en/ui.json";
import phraseData from "./locales/phrases.en.json";
type Phrase = { id: string; source_ru: string; source_en: string; canonical_tr: string; word_hints: Record<string, { translation_tr: string; note?: string } | undefined> };
const phrases: Phrase[] = phraseData;

export type InterfaceLanguage = "ru" | "en";
const storageKey = "serbotalk.interface-language";
const listeners = new Set<() => void>();
export function getLanguage(): InterfaceLanguage {
  if (sessionOnly) return memoryLanguage;
  try {
    return localStorage.getItem(storageKey) === "en" ? "en" : "ru";
  } catch {
    return memoryLanguage;
  }
}
let memoryLanguage: InterfaceLanguage = "ru";
let sessionOnly = false;
export function setLanguage(language: InterfaceLanguage): void {
  memoryLanguage = language;
  try {
    localStorage.setItem(storageKey, language);
    sessionOnly = false;
  } catch {
    sessionOnly = true;
  }
  document.documentElement.lang = language;
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      document.documentElement.lang = getLanguage();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
export function useLanguage(): InterfaceLanguage {
  return useSyncExternalStore(subscribe, getLanguage, () => "ru");
}
export function getLocale(): string {
  return getLanguage() === "en" ? "en-GB" : "ru-RU";
}
const dictionary: Record<string, string> = messages;
const phraseTranslations = new Map(phrases.map(phrase => [phrase.source_ru, phrase.source_en]));
const presetTopicIds = new Set(["misc", "general", "review-phrases", ...phrases.map(phrase => phrase.id.slice(0, -3))]);
export function topicText(id: string | null | undefined, text: string, englishTitle?: string | null): string {
  if (getLanguage() === "en" && englishTitle) return englishTitle;
  return id == null || presetTopicIds.has(id) ? t(text) : text;
}
export function localizedPhrase(source: string, allowPresetTranslation = true): { source: string; hints: Phrase["word_hints"] } {
  const phrase = allowPresetTranslation && getLanguage() === "en" ? phrases.find(item => item.source_ru === source) : undefined;
  return { source: phrase?.source_en ?? source, hints: phrase?.word_hints ?? {} };
}
const templates = Object.entries(dictionary)
  .filter(([key]) => key.includes("{0}"))
  .sort(([left], [right]) => right.replace(/\{\d+\}/g, "").length - left.replace(/\{\d+\}/g, "").length)
  .map(([key, value]) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { pattern: new RegExp(`^${escaped.replace(/\\\{\d+\\\}/g, "(.*?)")}$`, "s"), value };
  });

// Stable-key catalogue (Phase 4). Interface strings move here from Russian-as-key one module at a
// time; keys are "<area>.<name>", and Russian plural forms use i18next's _one/_few/_many/_other.
void i18next.init({
  resources: { ru: { ui: ruUi }, en: { ui: enUi } },
  lng: "ru",
  fallbackLng: "ru",
  defaultNS: "ui",
  ns: ["ui"],
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export type TranslationOptions = Record<string, string | number | undefined>;

/** True for a stable key (for example practice.check.full) that exists in the catalogue. */
function isKey(value: string, options?: TranslationOptions): boolean {
  return /^[a-z][A-Za-z0-9]*\.[A-Za-z0-9_.]+$/.test(value) && i18next.exists(value, { lng: "ru", ...options } as Record<string, unknown>) && typeof i18next.getResource("ru", "ui", value) !== "object"; // a branch such as "practice.pause" is not a key
}

/** A stable key in a fixed language (for text rendered in both languages at once, like the login copy). */
export function translateIn(language: InterfaceLanguage, key: string): string {
  return String(i18next.t(key, { lng: language }));
}

/**
 * Translate presentation text. A stable key is looked up in the catalogue (with interpolation and
 * plurals from `options`); legacy Russian text is translated through the old dictionary until its
 * module migrates. IDs, stored phrases and Turkish answers stay unchanged.
 */
export function t<T>(value: T, options?: TranslationOptions): T {
  if (typeof value === "string" && isKey(value, options)) return String(i18next.t(value as string, { ...options, lng: getLanguage() } as Record<string, unknown>)) as T;
  if (getLanguage() !== "en" || typeof value !== "string") return value;
  const trimmed = value.trim();
  let translated = (Object.hasOwn(dictionary, trimmed) ? dictionary[trimmed] : undefined) ?? phraseTranslations.get(trimmed);
  if (translated === undefined) {
    for (const template of templates) {
      const match = trimmed.match(template.pattern);
      if (match) {
        translated = template.value.replace(/\{(\d+)\}/g, (_, index: string) => String(t(match[Number(index) + 1])));
        break;
      }
    }
  }
  return (translated === undefined ? value : value.replace(trimmed, () => translated!)) as T;
}
