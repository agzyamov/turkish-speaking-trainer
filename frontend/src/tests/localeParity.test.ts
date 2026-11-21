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
  Русский: "the Russian language option is shown in Russian in both interfaces",
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
  let scanned = 0;
  for (const file of sourceFiles(root)) {
    const name = relative(root, file);
    if (skippedFiles.some(pattern => pattern.test(name))) continue;
    scanned += 1;
    for (const key of cyrillicLiterals(readFileSync(file, "utf8"))) {
      if (!(key in allowed) && t(key) === key) missing.push(`${name}: ${key}`);
    }
  }
  // The literal count falls to zero as modules move to stable keys; make sure the scan ran.
  expect(scanned).toBeGreaterThan(40);
  expect(missing).toEqual([]);
});

function flatKeys(tree: object, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => (typeof value === "object" && value !== null ? flatKeys(value, `${prefix}${key}.`) : [`${prefix}${key}`]));
}
const pluralSuffix = /_(zero|one|two|few|many|other)$/;

it("keeps the Russian and English stable-key catalogues in step", async () => {
  const ru = flatKeys((await import("../locales/ru/ui.json")).default);
  const en = flatKeys((await import("../locales/en/ui.json")).default);
  const base = (keys: string[]) => [...new Set(keys.map(key => key.replace(pluralSuffix, "")))].sort();
  expect(base(en)).toEqual(base(ru));
  // Every plural key has the forms each language needs.
  for (const key of base(ru).filter(key => ru.includes(`${key}_one`))) {
    for (const form of ["one", "few", "many", "other"]) expect(ru).toContain(`${key}_${form}`);
    for (const form of ["one", "other"]) expect(en).toContain(`${key}_${form}`);
  }
});

it("uses only keys that exist in the catalogue", async () => {
  const ru = new Set(flatKeys((await import("../locales/ru/ui.json")).default).map(key => key.replace(pluralSuffix, "")));
  const areas = new Set([...ru].map(key => key.split(".")[0]));
  const unknown: string[] = [];
  for (const file of sourceFiles(root)) {
    for (const match of readFileSync(file, "utf8").matchAll(/"([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)"/g)) {
      const key = match[1];
      if (areas.has(key.split(".")[0]) && !ru.has(key) && ![...ru].some(known => known.startsWith(`${key}.`))) unknown.push(`${relative(root, file)}: ${key}`);
    }
  }
  expect(unknown).toEqual([]);
});

it("renders keys with English text and plural forms in both languages", () => {
  setLanguage("en");
  expect(t("practice.progress", { completed: 1, count: 1 })).toBe("1 of 1 phrase");
  expect(t("statistics.calendar.dayLabel", { day: t("common.weekdays.mon"), date: 5, count: 21 })).toBe("Mon 5: 21 attempts");
  expect(t("shell.topics.reviewNeeded", { count: 1 })).toBe("1 needs practice");
  expect(t("practice.pause")).toBe("practice.pause");
  setLanguage("ru");
  expect(t("practice.progress", { completed: 3, count: 21 })).toBe("3 из 21 фразы");
  expect(t("statistics.calendar.dayLabel", { day: t("common.weekdays.mon"), date: 5, count: 3 })).toBe("Пн 5: 3 попытки");
  expect(t("shell.topics.reviewNeeded", { count: 21 })).toBe("21 требует практики");
});
