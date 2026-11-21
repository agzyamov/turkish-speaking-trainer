// Mirrors backend/app/services/turkish_text.py (C-17): Turkish is written only in
// Latin letters. A Russian keyboard can slip a look-alike Cyrillic letter into a
// Latin word; that is repaired, never guessed beyond the look-alikes.

const visualCyrillicToLatin: Record<string, string> = {
  А: "A",
  В: "B",
  Е: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  Р: "P",
  С: "C",
  Т: "T",
  У: "Y",
  Х: "X",
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
};

/** One Unicode form, with look-alike Cyrillic letters repaired inside mostly-Latin words. Length is preserved. */
export function latinForEvaluation(text: string): string {
  return text.normalize("NFC").replace(/[\p{L}\p{M}]+/gu, token => {
    const letters = Array.from(token).filter(character => /\p{L}/u.test(character));
    const latin = letters.filter(character => /\p{Script=Latin}/u.test(character)).length;
    const cyrillic = letters.filter(character => /\p{Script=Cyrillic}/u.test(character)).length;
    if (latin <= cyrillic) return token;
    return token.replace(/[АВЕКМНОРСТУХаеорсух]/g, part => visualCyrillicToLatin[part]);
  });
}

// The backend accepts a letter when its Unicode name starts with "LATIN", which excludes
// compatibility forms such as ª, fullwidth ｇ and superscript ⁱ. They change under NFKC.
function isPlainLatinLetter(letter: string): boolean {
  return /\p{Script=Latin}/u.test(letter) && letter.normalize("NFKC") === letter;
}

/** True when the text, after look-alike repair, still contains a letter that is not plain Latin. */
export function hasUnexpectedLetterScript(text: string): boolean {
  return Array.from(latinForEvaluation(text)).some(letter => /\p{L}/u.test(letter) && !isPlainLatinLetter(letter));
}
