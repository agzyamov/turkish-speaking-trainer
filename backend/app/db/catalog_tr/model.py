"""Shape of one curated Turkish catalogue phrase.

Each phrase is authored once, here, with its Russian and English sources, the
canonical Turkish answer and tap-to-reveal hints for both source languages. The
legacy modules (`topic_phrases`, `topic_phrase_hints`, `topic_phrases_en`,
`topic_phrase_hints_en`, `misc_phrases`) and `frontend/src/locales/phrases.en.json`
are derived from this catalogue (C-17, C-19).

Hint rules, checked by `backend/tests/test_turkish_catalog.py`:
- a key is a lowercase, contiguous fragment of the source sentence, 1 to 4 words;
- a value is a contiguous run of 1 to 5 whole words of the canonical answer;
- keys of one phrase never overlap in the source sentence.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class P:
    ru: str
    en: str
    tr: str
    hints_ru: dict[str, str] = field(default_factory=dict)
    hints_en: dict[str, str] = field(default_factory=dict)
    skills: tuple[str, ...] = ()
