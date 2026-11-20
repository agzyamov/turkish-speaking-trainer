"""Validate per-transcription AI hypotheses; no word/phrase correction dictionary."""
import unicodedata
from collections import Counter

from app.schemas.transcriptions import TranscriptionAssistanceAnalysis, TranscriptionChange
from app.services.turkish_text import canonical_form, has_unexpected_letter_script, normalized_words, turkish_lower

POLICY_VERSION = "analysis-v3"
# Grammar guard only, never a source of suggested replacements.
# Turkish also negates with verb suffixes (-me/-ma); those are judged by the model, not here.
NEGATION_MARKERS = frozenset({"değil", "yok", "hayır", "hiç", "asla"})


def apply_changes(raw: str, changes: list[TranscriptionChange], selected: set[int]) -> str:
    result = raw
    for index in range(len(changes) - 1, -1, -1):
        change = changes[index]
        if index in selected:
            result = result[:change.start] + change.replacement + result[change.end:]
    return result


# Turkish negates verbs with -mA- (gel-me-di "did not come", iste-m-iyor "does not want").
# Deleting or inserting such a piece is a change of meaning, never a recognition fix.
_NEGATION_PIECES = frozenset({"ma", "me", "mı", "mi", "mu", "mü", "am", "em", "ım", "im", "um", "üm"})


def _flips_suffix_negation(original: str, replacement: str) -> bool:
    for left, right in zip(normalized_words(original).split(), normalized_words(replacement).split(), strict=False):
        longer, shorter = (left, right) if len(left) > len(right) else (right, left)
        if len(longer) - len(shorter) != 2:
            continue
        for index in range(len(longer) - 1):
            piece = longer[index:index + 2]
            if piece in _NEGATION_PIECES and longer[:index] + longer[index + 2:] == shorter:
                return True
    return False


def _fold(text: str) -> str:
    # Alphabet folding and spacing are general comparison rules, not replacements.
    text = turkish_lower(text).replace("ı", "i")
    return "".join(c for c in unicodedata.normalize("NFD", text) if c.isalpha())


def _distance(left: str, right: str) -> int:
    previous = list(range(len(right) + 1))
    for i, a in enumerate(left, 1):
        current = [i]
        for j, b in enumerate(right, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (a != b)))
        previous = current
    return previous[-1]


def _numbers(text: str) -> list[str]:
    groups: list[str] = []
    number = ""
    for c in text + " ":
        if c.isdecimal():
            number += c
        elif number:
            groups.append(number)
            number = ""
    return groups


def _occurrences(raw: str, original: str) -> list[int]:
    positions = []
    start = 0
    while (start := raw.find(original, start)) >= 0:
        end = start + len(original)
        if (start == 0 or not raw[start - 1].isalnum()) and (end == len(raw) or not raw[end].isalnum()):
            positions.append(start)
        start = end
    return positions


def validate_analysis(raw: str, variants: list[str], analysis: TranscriptionAssistanceAnalysis) -> list[TranscriptionChange]:
    """Similarity is a conservative gate, never proof that pronunciation was correct."""
    if analysis.acceptable_variant or normalized_words(raw) in {normalized_words(v) for v in variants}:
        return []
    changes = []
    for candidate in analysis.candidates:
        original, replacement = candidate.original, candidate.replacement
        if original != original.strip() or replacement != replacement.strip():
            raise ValueError("Invalid candidate whitespace")
        positions = _occurrences(raw, original)
        if candidate.occurrence_index >= len(positions):
            raise ValueError("Candidate does not match transcript")
        start = positions[candidate.occurrence_index]
        if not candidate.plausible_stt_error or not candidate.preserves_meaning:
            continue
        if has_unexpected_letter_script(replacement) or replacement != canonical_form(replacement):
            continue
        original_words = normalized_words(original).split()
        replacement_words = normalized_words(replacement).split()
        # Local hypotheses only: no insertion of missing content or whole-answer rewrite.
        if not (1 <= len(original_words) <= 3 and 1 <= len(replacement_words) <= 3):
            continue
        if len(original) > 120 or len(replacement) > 120 or _numbers(original) != _numbers(replacement):
            continue
        left, right = _fold(original), _fold(replacement)
        if not left or not right or original == replacement:
            continue
        if left != right and Counter(w for w in original_words if w in NEGATION_MARKERS) != Counter(w for w in replacement_words if w in NEGATION_MARKERS):
            continue
        if _flips_suffix_negation(original, replacement):
            continue
        size = max(len(left), len(right))
        distance = _distance(left, right)
        # Short prepositions/pronouns cannot be replaced merely because one letter differs.
        if (size <= 2 and distance) or distance > max(1, size // 3):
            continue
        changes.append(TranscriptionChange(
            start=start, end=start + len(original), original=original, replacement=replacement,
            kind=candidate.kind, action="suggested", reason_code="confirm_ambiguous_sound",
            explanation_ru=candidate.explanation_ru, similarity=round(1 - distance / size, 3),
        ))
    changes.sort(key=lambda c: c.start)
    if any(a.end > b.start for a, b in zip(changes, changes[1:], strict=False)):
        raise ValueError("Overlapping candidates")
    if len(apply_changes(raw, changes, set(range(len(changes))))) > 1200:
        raise ValueError("Assisted transcript is too long")
    return changes
