"""Everyday conversational phrases of the "misc" topic, derived from app.db.catalog_tr.misc."""
from app.db.catalog_tr import misc, ordered_hints, phrase_id

MISC_PHRASES: list[dict] = [
    {
        "id": phrase_id("misc", position),
        "source_ru": p.ru,
        "source_en": p.en,
        "canonical_tr": p.tr,
        "hints_ru": {h["word_ru"]: h["translation_tr"] for h in ordered_hints(p.ru, p.hints_ru)},
        "hints_en": {h["word_ru"]: h["translation_tr"] for h in ordered_hints(p.en, p.hints_en)},
    }
    for position, p in enumerate(misc.PHRASES, start=1)
]
