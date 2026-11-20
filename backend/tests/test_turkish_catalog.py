"""The curated Turkish catalogue is complete, well-formed and its hints survive alignment.

Run one topic while authoring: `just backend-test -k "turkish_catalog and bank"`.
"""
import re
from importlib import import_module

import pytest

from app.db.catalog_tr import _WORD, ordered_hints
from app.db.catalog_tr.model import P
from app.db.seed import SKILLS
from app.services.hint_alignment import WORD, aligned_word_hints
from app.services.turkish_text import has_unexpected_letter_script

TOPICS = {
    "job-interview": "job_interview",
    "bank": "bank",
    "vacation": "vacation",
    "cafe": "cafe",
    "work": "work",
    "doctor": "doctor",
    "rent": "rent",
    "transport": "transport",
    "misc": "misc",
}
SKILL_KEYS = {skill.key for skill in SKILLS}
# Skills a phrase can be tagged with; pronunciation and fluency come from audio, not from text.
TAGGABLE = {key for key in SKILL_KEYS if not key.startswith(("pronunciation.", "fluency."))}
CYRILLIC = re.compile(r"[А-Яа-яЁё]")
TURKISH_ONLY_LETTERS = re.compile(r"[çğıöşüÇĞİÖŞÜ]")


def _phrases(module: str) -> tuple[P, ...]:
    return import_module(f"app.db.catalog_tr.{module}").PHRASES


def test_catalogue_tokeniser_matches_hint_alignment() -> None:
    assert _WORD.pattern == WORD.pattern


@pytest.mark.parametrize("topic", TOPICS)
def test_topic_phrases_are_complete_and_well_formed(topic: str) -> None:
    phrases = _phrases(TOPICS[topic])
    assert len(phrases) == (50 if topic == "misc" else 20)
    for field in ("ru", "en", "tr"):
        assert len({getattr(p, field) for p in phrases}) == len(phrases), f"duplicate {field} in {topic}"
    for p in phrases:
        assert CYRILLIC.search(p.ru), p.ru
        assert not CYRILLIC.search(p.en), p.en
        assert not has_unexpected_letter_script(p.tr), p.tr
        assert p.tr == p.tr.strip() and "  " not in p.tr, p.tr
        assert p.tr[-1] in ".?!", p.tr
        assert 1 <= len(p.skills) <= 3 and set(p.skills) <= TAGGABLE, (p.tr, p.skills)
        if topic == "misc":
            assert len(p.tr.split()) >= 6, p.tr


@pytest.mark.parametrize("topic", TOPICS)
@pytest.mark.parametrize("language", ["ru", "en"])
def test_every_authored_hint_survives_alignment(topic: str, language: str) -> None:
    for p in _phrases(TOPICS[topic]):
        source = p.ru if language == "ru" else p.en
        authored = p.hints_ru if language == "ru" else p.hints_en
        assert len(authored) >= 2, (source, "needs at least two hints")
        hints = ordered_hints(source, authored)
        kept = aligned_word_hints(source, p.tr, hints)
        dropped = [h for h in hints if h not in kept]
        assert not dropped, f"{source!r} -> {p.tr!r}: dropped {dropped}"
        assert kept == hints
        for hint in hints:
            assert not CYRILLIC.search(hint["translation_tr"]), hint


def test_catalogue_uses_turkish_letters() -> None:
    combined = " ".join(p.tr for module in TOPICS.values() for p in _phrases(module))
    assert TURKISH_ONLY_LETTERS.search(combined)
