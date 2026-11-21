import pytest

from app.services.hint_alignment import aligned_word_hints


def hint(source, target):
    return {"word_ru": source, "translation_tr": target}


def test_short_nonliteral_fragment_replaces_literal_words():
    assert aligned_word_hints("Мне не с кем поговорить.", "Nemam s kim da pričam.", [
        hint("мне", "mi"), hint("мне не с кем", "nemam s kim"),
        hint("не", "ne"), hint("с", "s"), hint("кем", "kim"), hint("поговорить", "da pričam"),
    ]) == [hint("мне не с кем", "nemam s kim"), hint("поговорить", "da pričam")]


def test_complete_words_and_diacritics_and_source_boundaries():
    assert aligned_word_hints("Мне пора идти.", "Nemam vremena.", [hint("мне", "mi")]) == []
    assert aligned_word_hints("Куда идти?", "Kući.", [hint("идти", "kuci")]) == []
    assert aligned_word_hints("Где, у вас?", "Gde imate?", [hint("где у вас", "Gde imate")]) == []
    assert aligned_word_hints("Когда?", "Kad?", [hint("где", "Kad"), hint("?", "?")]) == []


def test_conflicting_repeated_keys_are_not_guessed_and_long_hints_are_withheld():
    assert aligned_word_hints("В Сербию в конце года.", "U Srbiju krajem godine.", [
        hint("в", "u"), hint("в", "krajem"), hint("в Сербию", "U Srbiju"), hint("в конце", "krajem"),
    ]) == [hint("в сербию", "U Srbiju"), hint("в конце", "krajem")]
    assert aligned_word_hints("Мне не с кем сейчас поговорить.", "Nemam s kim sada da pričam.", [
        hint("мне не с кем сейчас", "Nemam s kim sada da pričam"),
        hint("мне не с кем сейчас поговорить", "Nemam s kim"),
    ]) == []


def test_custom_fragment_api_and_one_penalty_without_ai(api_client, db_session):
    from sqlalchemy import select

    from app.models import Exercise, WordLearningItem
    started = api_client.post("/api/sessions/start", json={"topic_id": "bank", "length": 10}).json()
    exercise = db_session.get(Exercise, started["exercise"]["id"])
    exercise.source_ru = "Мне не с кем поговорить."
    exercise.target_hints_json = {"canonical_tr": "Nemam s kim da pričam.",
        "intended_tr_variants": ["Nemam s kim da pričam."], "word_hints": [
            hint("мне не с кем", "nemam s kim"), hint("мне", "mi"), hint("поговорить", "da pričam")]}
    exercise.generation_meta_json = {**exercise.generation_meta_json, "targeted_skill_keys": []}
    db_session.commit()
    url = f"/api/exercises/{exercise.id}/word-hints"
    # Legacy APKs submit individual words; return the construction, never mi.
    legacy = api_client.post(url, json={"word": "мне"})
    assert legacy.status_code == 200
    assert legacy.json()["word_ru"] == "мне не с кем"
    assert legacy.json()["translation_tr"] == "nemam s kim"
    for _ in range(2):
        opened = api_client.post(url, json={"word": "мне не с кем"})
        assert opened.status_code == 200
        assert opened.json()["translation_tr"] == "nemam s kim"
    result = api_client.post("/api/attempts", json={"exercise_id": exercise.id,
        "transcript_tr": "Nemam s kim da pričam.", "hinted_words": ["мне не с кем", "мне не с кем", "мне", "кем"]})
    assert result.status_code == 201, result.text
    assert result.json()["hint_penalty"] == .08
    assert [w.source_ru for w in db_session.scalars(select(WordLearningItem))] == ["мне не с кем"]


def test_legacy_word_requests_never_guess_between_two_fragments():
    from app.services.word_hints import resolve_hint
    hints = [hint("в конце", "krajem"), hint("в Сербию", "u Srbiju")]
    assert resolve_hint(hints, "в") is None
    assert resolve_hint(hints, "в конце") == hints[0]


def test_personal_canonical_never_borrows_preset_english_hints():
    from app.db.topic_phrases import TOPIC_PHRASES
    from app.services.interface_language import interface_language
    from app.services.word_hints import preset_english_source, word_hints_for_language
    phrase = TOPIC_PHRASES[0]
    token = interface_language.set("en")
    try:
        assert preset_english_source(phrase.source_ru, phrase.canonical_tr) is not None
        assert preset_english_source(phrase.source_ru, "Drugačiji prevod.") is None
        assert word_hints_for_language(phrase.source_ru, [], "Drugačiji prevod.") == []
    finally:
        interface_language.reset(token)


def test_new_preparation_prompt_filters_noncanonical_model_hints_and_preserves_canonical():
    from app.schemas.exercises import BilingualPhrasePreparation, PhrasePreparation
    from app.services.ai_adapter import AIServiceError
    from tests.providers import UTILITY_MODEL, claude_provider
    provider, messages = claude_provider(PhrasePreparation(
        intended_tr_variants=["Nemam s kim da pričam."], source_versions={"ru": "Мне не с кем поговорить.", "en": "I have nobody to talk to."}, word_hints=[
            hint("мне", "mi"), hint("мне не с кем", "nemam s kim"), hint("поговорить", "da pričam")]))
    result = provider.prepare_phrase(source_ru="Мне не с кем поговорить.", canonical_tr="Nemam s kim da pričam.")
    assert [h.word_ru for h in result.word_hints] == ["мне не с кем", "поговорить"]
    assert "at most four" in messages.system_text()
    assert messages.last["model"] == UTILITY_MODEL
    assert messages.last["output_format"] is BilingualPhrasePreparation
    with pytest.raises(AIServiceError) as changed:
        provider.prepare_phrase(source_ru="Мне не с кем поговорить.", canonical_tr="Nemam s kim da razgovaram.")
    assert changed.value.failure.reason == "canonical_changed"


def test_turkish_capital_i_keeps_its_hint():
    """C-17: "Ilık" lowercases to "ılık", and "İstanbul'a" stays one word."""
    hints = aligned_word_hints("Тёплую воду, пожалуйста", "Ilık su, lütfen.",
                               [{"word_ru": "тёплую", "translation_tr": "ılık"}, {"word_ru": "воду", "translation_tr": "su"}])
    assert [hint["translation_tr"] for hint in hints] == ["ılık", "su"]
    hints = aligned_word_hints("Я еду в Стамбул завтра утром на поезде", "Yarın sabah trenle İstanbul'a gidiyorum.",
                               [{"word_ru": "в Стамбул", "translation_tr": "İstanbul'a"}, {"word_ru": "завтра утром", "translation_tr": "yarın sabah"}])
    assert [hint["translation_tr"] for hint in hints] == ["İstanbul'a", "yarın sabah"]
