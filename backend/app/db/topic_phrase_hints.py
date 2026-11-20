"""Russian-source word hints for preset phrases, derived from app.db.catalog_tr."""
from app.db.catalog_tr import CATALOG, ordered_hints, phrase_id

TOPIC_PHRASE_HINTS: dict[str, list[dict[str, str]]] = {
    phrase_id(topic_id, position): ordered_hints(p.ru, p.hints_ru)
    for topic_id, phrases in CATALOG.items()
    for position, p in enumerate(phrases, start=1)
}
