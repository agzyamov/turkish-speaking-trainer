import { getLanguage, t } from "../../i18n";

/** Feedback text from the grader: translated in English, shown as written (NFC) in Russian. */
export function displayFeedback(text: string): string {
  return getLanguage() === "en" || !/[А-Яа-яЁё]/.test(text) ? t(text) : text.normalize("NFC");
}
