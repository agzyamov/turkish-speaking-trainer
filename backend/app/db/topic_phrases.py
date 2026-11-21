"""Preset topic phrases, derived from the curated Turkish catalogue in app.db.catalog_tr."""
from dataclasses import dataclass

from app.db.catalog_tr import CATALOG, phrase_id


@dataclass(frozen=True)
class TopicPhraseSeed:
    id: str
    topic_id: str
    position: int
    source_ru: str
    canonical_tr: str
    targeted_skill_keys_json: tuple[str, ...]


PHRASES: dict[str, tuple[tuple[str, str], ...]] = {
    topic_id: tuple((p.ru, p.tr) for p in phrases) for topic_id, phrases in CATALOG.items()
}


def phrase_seeds() -> tuple[TopicPhraseSeed, ...]:
    return tuple(
        TopicPhraseSeed(
            id=phrase_id(topic_id, position),
            topic_id=topic_id,
            position=position,
            source_ru=p.ru,
            canonical_tr=p.tr,
            targeted_skill_keys_json=p.skills,
        )
        for topic_id, phrases in CATALOG.items()
        for position, p in enumerate(phrases, start=1)
    )


TOPIC_PHRASES = phrase_seeds()
