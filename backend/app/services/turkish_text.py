"""Turkish text policy (constraint C-17, ADR-0004).

The single place for comparing, casing and checking Turkish text. Generic
``str.lower()`` is wrong for Turkish: ``I`` lowercases to ``ı`` and ``İ`` to ``i``.
Nothing here rewrites what a learner said; these forms are for comparison only (C-18).
"""
from __future__ import annotations

import re
import unicodedata

from pydantic import BaseModel

_LOWER = str.maketrans({"I": "ı", "İ": "i"})
# Circumflex vowels are optional in modern spelling: "kâr" and "kar" are both accepted.
_CIRCUMFLEX = str.maketrans({"â": "a", "î": "i", "û": "u"})
# Suffixes on proper nouns follow an apostrophe ("Ankara'ya"); speech-to-text often omits it.
_APOSTROPHES = re.compile(r"(?<=\w)['’ʼ`](?=\w)")

# A Russian keyboard can insert visually identical Cyrillic letters inside a Latin word.
_VISUAL_CYRILLIC_TO_LATIN = str.maketrans({
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H",
    "О": "O", "Р": "P", "С": "C", "Т": "T", "У": "Y", "Х": "X",
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x",
})


def canonical_form(text: str) -> str:
    """One Unicode form. No letter is changed."""
    return unicodedata.normalize("NFC", text)


def turkish_lower(text: str) -> str:
    """Lowercase by Turkish rules: I -> ı, İ -> i."""
    lowered = canonical_form(text).translate(_LOWER).lower()
    # Guard against a dotted i that arrives as "i" plus a combining dot above.
    return lowered.replace("i̇", "i")


def _is_letter(char: str) -> bool:
    return unicodedata.category(char).startswith("L")


def _script(char: str) -> str:
    return unicodedata.name(char, "").split(" ", 1)[0]


def latin_for_evaluation(text: str) -> str:
    """Repair look-alike Cyrillic letters, but only inside words that are mostly Latin."""
    def repair(token: str) -> str:
        latin = sum(_is_letter(char) and _script(char) == "LATIN" for char in token)
        cyrillic = sum(_is_letter(char) and _script(char) == "CYRILLIC" for char in token)
        return token.translate(_VISUAL_CYRILLIC_TO_LATIN) if latin > cyrillic else token

    result: list[str] = []
    run: list[str] = []
    for char in canonical_form(text):
        # A letter run includes combining marks, so a mark that cannot be composed does not split a word.
        if unicodedata.category(char).startswith(("L", "M")):
            run.append(char)
            continue
        if run:
            result.append(repair("".join(run)))
            run.clear()
        result.append(char)
    if run:
        result.append(repair("".join(run)))
    return "".join(result)


def has_unexpected_letter_script(text: str) -> bool:
    """True when the text contains a letter that is not Latin. Turkish is written only in Latin script."""
    return any(_is_letter(char) and _script(char) != "LATIN" for char in canonical_form(text))


def normalized_words(text: str) -> str:
    """The form used to decide whether two answers are the same words.

    Unfamiliar letters are kept visible: dropping them could make a bad transcript
    look identical to the canonical answer.
    """
    folded = turkish_lower(latin_for_evaluation(text)).translate(_CIRCUMFLEX)
    return re.sub(r"[\W_]+", " ", _APOSTROPHES.sub("", folded)).strip()


def validate_generated_target(result: BaseModel) -> None:
    """Reject model output whose Turkish fields contain non-Latin letters."""
    texts = list(getattr(result, "intended_tr_variants", []))
    texts.extend(hint.translation_tr for hint in getattr(result, "word_hints", []))
    versions = getattr(result, "source_versions", None)
    if versions is not None:
        texts.extend(hint.translation_tr for hint in [*versions.hints_ru, *versions.hints_en])
    texts.extend(getattr(result, "suggested_vocabulary", []))
    if hasattr(result, "corrected_tr"):
        texts.append(result.corrected_tr)
        texts.extend(result.accepted_alternatives)
        texts.extend(issue.correction for issue in result.issues if issue.correction)
    if any(has_unexpected_letter_script(text) for text in texts):
        raise ValueError("Generated Turkish contains letters outside the Latin script")
