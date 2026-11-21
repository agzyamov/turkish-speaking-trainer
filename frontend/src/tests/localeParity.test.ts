// C-19: every interface string exists in Russian and English. Russian source strings are the
// translation keys today, so every Cyrillic string literal in application code must translate
// to something else in English (ternaries, props translated later and constants included).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterAll, expect, it } from "vitest";
import { setLanguage, t } from "../i18n";

const root = join(__dirname, "..");

// Literals that are deliberately not translated, with the reason.
const allowed: Record<string, string> = {
  "Русский": "the Russian language option is shown in Russian in both interfaces",
};
// Files whose Cyrillic text is data or test tooling, not interface copy.
const skippedFiles = [/^db\//, /^testlab-entry\.ts$/, /^LandingPage\.tsx$/, /^LegalPage\.tsx$/];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "tests" || name === "locales" || name === "assets" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });
}

/** Cyrillic text in double- or single-quoted literals and in the static parts of template literals. */
export function cyrillicLiterals(text: string): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const found: string[] = [];
  for (const match of code.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g)) {
    const value = match[1] ?? match[2];
    if (/[А-Яа-яЁё]/.test(value)) found.push(value.replace(/\\"/g, '"').replace(/\\'/g, "'"));
  }
  for (const match of code.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
    // A template like `${n} фраз проверено` is translated as a pattern; check its static pieces exist.
    if (/[А-Яа-яЁё]/.test(match[1]) && !match[1].includes("${")) found.push(match[1]);
  }
  return found;
}

afterAll(() => setLanguage("ru"));

it("finds literals inside ternaries and props, not only direct t() arguments", () => {
  expect(cyrillicLiterals('t(x ? "Да" : "Нет"); <Copy text="Привет" />; // "Комментарий"')).toEqual(["Да", "Нет", "Привет"]);
});

it("has an English translation for every Russian interface string", () => {
  setLanguage("en");
  const missing: string[] = [];
  let checked = 0;
  for (const file of sourceFiles(root)) {
    const name = relative(root, file);
    if (skippedFiles.some(pattern => pattern.test(name))) continue;
    for (const key of cyrillicLiterals(readFileSync(file, "utf8"))) {
      checked += 1;
      if (!(key in allowed) && t(key) === key) missing.push(`${name}: ${key}`);
    }
  }
  expect(checked).toBeGreaterThan(400);
  expect(missing).toEqual([]);
});
