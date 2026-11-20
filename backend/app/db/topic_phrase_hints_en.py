"""English-source word hints for preset phrases, keyed by the English source; derived from app.db.catalog_tr."""
from app.db.catalog_tr import CATALOG, ordered_hints

ENGLISH_WORD_HINTS: dict[str, dict[str, str]] = {
    p.en: {hint["word_ru"]: hint["translation_tr"] for hint in ordered_hints(p.en, p.hints_en)}
    for phrases in CATALOG.values()
    for p in phrases
}
