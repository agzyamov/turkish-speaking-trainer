import { expect, it } from "vitest";
import { hasUnexpectedLetterScript, latinForEvaluation } from "../turkishText";

// Same cases as backend/tests/test_turkish_text.py, so both sides accept and reject the same text (C-17).
it("accepts Turkish letters and normalises to one Unicode form", () => {
  expect(hasUnexpectedLetterScript("Çay mı, kahve mi? İyi günler, Iğdır'a gidiyorum.")).toBe(false);
  expect(latinForEvaluation("Teşekkürler")).toBe("Teşekkürler");
});

it("repairs look-alike Cyrillic letters only inside mostly-Latin words", () => {
  expect(latinForEvaluation("istiyоrum")).toBe("istiyorum");
  expect(latinForEvaluation("Привет")).toBe("Привет");
  expect(hasUnexpectedLetterScript("istiyоrum")).toBe(false);
});

it("rejects any other non-Latin letter", () => {
  expect(hasUnexpectedLetterScript("açмak")).toBe(true);
  expect(hasUnexpectedLetterScript("Привет")).toBe(true);
  expect(hasUnexpectedLetterScript("γεια")).toBe(true);
  // Latin-script compatibility forms the backend also rejects.
  for (const text of ["ªbc", "ｇüzel", "ᵃçmak", "ⁱyi"]) expect(hasUnexpectedLetterScript(text), text).toBe(true);
});

it("keeps the text length so issue offsets stay valid", () => {
  const text = "Yeni bir hesap aсmak istiyоrum.";
  expect(latinForEvaluation(text)).toHaveLength(text.length);
});
