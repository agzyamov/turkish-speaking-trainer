import re

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.seed import SKILLS, TOPICS, ForeignCatalogError, seed_catalog
from app.db.topic_phrase_hints import TOPIC_PHRASE_HINTS
from app.db.topic_phrases import TOPIC_PHRASES
from app.models import Exercise, Skill, TopicPhrase, TopicPreset, TrainingSession
from app.schemas import WordHint
from app.services.hint_alignment import aligned_word_hints, target_words


def test_seed_is_complete_and_idempotent(db_session: Session) -> None:
    assert 40 <= len(SKILLS) <= 60
    assert len(TOPICS) == 9
    assert len(TOPIC_PHRASES) == 210
    assert len(TOPIC_PHRASE_HINTS) == 210
    assert all(TOPIC_PHRASE_HINTS[item.id] for item in TOPIC_PHRASES)
    for item in TOPIC_PHRASES:
        assert aligned_word_hints(item.source_ru, item.canonical_tr, TOPIC_PHRASE_HINTS[item.id]) == TOPIC_PHRASE_HINTS[item.id]
        assert all(hint["translation_tr"] != "перевод недоступен" for hint in TOPIC_PHRASE_HINTS[item.id])
        assert all(not re.search(r"[А-Яа-яЁё]", WordHint.model_validate(hint).translation_tr) for hint in TOPIC_PHRASE_HINTS[item.id])
        canonical_tokens = set(target_words(item.canonical_tr))
        for hint in TOPIC_PHRASE_HINTS[item.id]:
            hint_tokens = set(target_words(hint["translation_tr"]))
            assert hint_tokens <= canonical_tokens
    assert all(
        len([item for item in TOPIC_PHRASES if item.topic_id == topic["id"]]) == 20
        for topic in TOPICS
        if topic["id"] != "misc"
    )
    assert len([item for item in TOPIC_PHRASES if item.topic_id == "misc"]) == 50

    assert seed_catalog(db_session) == (50, 9, 210)
    assert seed_catalog(db_session) == (0, 0, 0)
    assert db_session.scalar(select(func.count()).select_from(Skill)) == 50
    assert db_session.scalar(select(func.count()).select_from(TopicPreset)) == 9
    assert db_session.scalar(select(func.count()).select_from(TopicPhrase)) == 210
    rent_phrase = db_session.get(TopicPhrase, "rent-01")
    assert rent_phrase is not None
    assert {hint["word_ru"]: hint["translation_tr"] for hint in rent_phrase.word_hints_json}["светлую"] == "aydınlık"

    training = TrainingSession(normalized_topic_json={})
    db_session.add(training)
    db_session.flush()
    exercise = Exercise(
        session_id=training.id,
        source_ru=rent_phrase.source_ru,
        target_hints_json={"word_hints": [{"word_ru": "светлую", "translation_tr": "перевод недоступен"}]},
        generation_meta_json={"topic_phrase_id": "rent-01"},
    )
    db_session.add(exercise)
    db_session.flush()

    assert seed_catalog(db_session) == (0, 0, 0)
    assert {hint["word_ru"]: hint["translation_tr"] for hint in exercise.target_hints_json["word_hints"]}["светлую"] == "aydınlık"


def test_seed_refuses_a_database_with_a_foreign_catalogue(db_session: Session) -> None:
    db_session.add(Skill(key="construction.foreign_skill", category="construction", title_ru="Foreign skill",
                         explanation_ru="Вежливое выражение желания.", difficulty=0.5))
    db_session.flush()
    with pytest.raises(ForeignCatalogError, match="fresh database"):
        seed_catalog(db_session)
    assert db_session.scalar(select(func.count()).select_from(TopicPhrase)) == 0


def test_reseeding_refreshes_skill_text_and_topic_vocabulary(db_session: Session) -> None:
    seed_catalog(db_session)
    skill = db_session.scalar(select(Skill).where(Skill.key == "grammar.future"))
    skill.explanation_ru = "Устаревшее объяснение."
    db_session.get(TopicPreset, "bank").vocabulary_json = ["eski"]
    db_session.flush()
    assert seed_catalog(db_session) == (0, 0, 0)
    assert skill.explanation_ru == next(s.explanation_ru for s in SKILLS if s.key == "grammar.future")
    assert db_session.get(TopicPreset, "bank").vocabulary_json == next(t["vocabulary_json"] for t in TOPICS if t["id"] == "bank")
