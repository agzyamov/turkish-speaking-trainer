from __future__ import annotations

import random
import re
from datetime import UTC, datetime
from difflib import SequenceMatcher
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Exercise, ReviewPhrase
from app.repositories import (
    AttemptRepository,
    AttemptRequestRepository,
    ExerciseRepository,
    ReviewPhraseRepository,
    SkillRepository,
    TopicPhraseRepository,
    TopicPresetRepository,
    TrainingSessionRepository,
)
from app.schemas import ExerciseGenerationResult, ExerciseResponse
from app.services.ai_adapter import AIServiceError, StructuredAIProvider
from app.services.hint_alignment import aligned_word_hints
from app.services.review_service import ReviewQueueEmptyError
from app.services.scheduler import Scheduler
from app.services.session_service import SessionCompletedError, SessionNotFoundError, SessionPendingError, SessionService, SessionUnavailableError
from app.services.word_hints import word_hints_for_language


class TopicEmptyError(RuntimeError):
    pass


LOCAL_EXERCISES: dict[str, tuple[tuple[str, tuple[str, ...]], ...]] = {
    "bank": (
        ("Не могли бы вы объяснить размер комиссии?", ("Komisyon tutarını açıklayabilir misiniz?",)),
        ("Я хотел бы открыть счёт сегодня.", ("Bugün bir hesap açmak istiyorum.", "Bugün hesap açmak istiyorum.")),
        ("Какие документы мне нужно принести?", ("Hangi belgeleri getirmem gerekiyor?", "Hangi belgeleri getirmeliyim?")),
    ),
    "cafe": (
        ("Можно мне, пожалуйста, меню?", ("Menüyü alabilir miyim, lütfen?", "Menü alabilir miyim, lütfen?")),
        ("Я хотел бы заказать кофе без сахара.", ("Şekersiz bir kahve sipariş etmek istiyorum.", "Şekersiz bir kahve istiyorum.")),
        ("Не могли бы вы принести счёт?", ("Hesabı getirebilir misiniz?",)),
    ),
    "doctor": (
        ("У меня болит горло уже два дня.", ("İki gündür boğazım ağrıyor.", "Boğazım iki gündür ağrıyor.")),
        ("Я хотел бы записаться на осмотр.", ("Muayene için randevu almak istiyorum.",)),
        ("Нужно ли мне принимать это лекарство?", ("Bu ilacı almam gerekiyor mu?",)),
    ),
    "rent": (
        ("В квартире не работает стиральная машина.", ("Dairede çamaşır makinesi çalışmıyor.",)),
        ("Когда мастер сможет прийти на ремонт?", ("Usta tamir için ne zaman gelebilir?",)),
        ("Не могли бы вы проверить отопление?", ("Kaloriferi kontrol edebilir misiniz?",)),
    ),
    "transport": (
        ("Где мне нужно сделать пересадку?", ("Nerede aktarma yapmam gerekiyor?",)),
        ("Я хотел бы купить билет до центра.", ("Merkeze bir bilet almak istiyorum.",)),
        ("Когда отправляется следующий автобус?", ("Bir sonraki otobüs ne zaman kalkıyor?",)),
    ),
    "job-interview": (
        ("Я работал в этой области два года.", ("Bu alanda iki yıl çalıştım.",)),
        ("Я хотел бы узнать больше об этой работе.", ("Bu iş hakkında daha fazla bilgi almak istiyorum.",)),
        ("Когда я могу начать работать?", ("Ne zaman işe başlayabilirim?",)),
    ),
    "work": (
        ("Не могли бы мы перенести встречу на завтра?", ("Toplantıyı yarına erteleyebilir miyiz?",)),
        ("Мне нужно закончить эту задачу сегодня.", ("Bu görevi bugün bitirmem gerekiyor.", "Bu işi bugün bitirmem gerekiyor.")),
        ("Я немного опоздаю из-за транспорта.", ("Trafik yüzünden biraz gecikeceğim.", "Ulaşım yüzünden biraz gecikeceğim.")),
    ),
    "vacation": (
        ("В прошлом году мы отдыхали у моря.", ("Geçen yıl deniz kenarında tatil yaptık.", "Geçen yıl denize gittik.")),
        ("Я хотел бы посетить этот город снова.", ("Bu şehri tekrar ziyaret etmek istiyorum.",)),
        ("Где вы остановились во время отпуска?", ("Tatilde nerede kaldınız?",)),
    ),
    "general": (
        ("Не могли бы вы повторить немного медленнее?", ("Biraz daha yavaş tekrar edebilir misiniz?",)),
        ("Я хотел бы узнать, когда вы открываетесь.", ("Ne zaman açtığınızı öğrenmek istiyorum.", "Saat kaçta açtığınızı öğrenmek istiyorum.")),
        ("Мне нужно купить продукты после работы.", ("İşten sonra market alışverişi yapmam gerekiyor.",)),
    ),
}

LOCAL_WORD_TRANSLATIONS = {
    "я": "ben", "мы": "biz", "вы": "siz", "мне": "bana", "меня": "beni",
    "можно": "mümkün", "хотел": "istiyorum", "хотела": "istiyorum",
    "нужно": "gerekiyor", "где": "nerede", "когда": "ne zaman",
    "какие": "hangi", "этой": "bu", "эту": "bu", "это": "bu", "после": "sonra",
    "сегодня": "bugün", "завтра": "yarın", "два": "iki", "дня": "gün", "года": "yıl",
    "году": "yıl", "город": "şehir", "снова": "tekrar", "открыть": "açmak", "счёт": "hesap",
    "комиссии": "komisyon", "размер": "tutar", "объяснить": "açıklamak", "документы": "belgeler",
    "принести": "getirmek", "меню": "menü", "пожалуйста": "lütfen", "заказать": "sipariş etmek",
    "кофе": "kahve", "сахара": "şeker", "болит": "ağrıyor", "горло": "boğaz",
    "записаться": "randevu almak", "осмотр": "muayene", "принимать": "almak", "лекарство": "ilaç",
    "квартире": "dairede", "работает": "çalışıyor", "стиральная": "çamaşır", "машина": "makine",
    "мастер": "usta", "прийти": "gelmek", "ремонт": "tamir", "проверить": "kontrol etmek",
    "отопление": "kalorifer", "пересадку": "aktarma", "купить": "almak", "билет": "bilet",
    "центра": "merkez", "отправляется": "kalkıyor", "следующий": "bir sonraki", "автобус": "otobüs",
    "работал": "çalıştım", "области": "alan", "узнать": "öğrenmek", "больше": "daha fazla",
    "работе": "iş", "начать": "başlamak", "работать": "çalışmak", "перенести": "ertelemek",
    "встречу": "toplantı", "закончить": "bitirmek", "задачу": "görev", "немного": "biraz",
    "опоздаю": "gecikeceğim", "транспорта": "ulaşım", "прошлом": "geçen", "отдыхали": "tatil yaptık",
    "моря": "deniz", "посетить": "ziyaret etmek", "остановились": "kaldınız", "отпуска": "tatil",
    "повторить": "tekrar etmek", "медленнее": "daha yavaş", "открываетесь": "açıyorsunuz",
    "продукты": "market alışverişi", "работы": "iş",
}


class ExerciseGenerator:
    def __init__(self, db: Session, ai: StructuredAIProvider, user_id: str = "00000000-0000-0000-0000-000000000001", scheduler: Scheduler | None = None) -> None:
        self.db = db
        self.user_id = user_id
        self.sessions = TrainingSessionRepository(db, user_id)
        self.attempts = AttemptRepository(db, user_id)
        self.attempt_requests = AttemptRequestRepository(db, user_id)
        self.exercises = ExerciseRepository(db, user_id)
        self.review_phrases = ReviewPhraseRepository(db, user_id)
        self.topic_phrases = TopicPhraseRepository(db)
        self.topics = TopicPresetRepository(db, user_id)
        self.skills = SkillRepository(db)
        self.ai = ai
        self.scheduler = scheduler or Scheduler()

    def generate_next(self, session_id: str, client_request_id: UUID | None = None) -> ExerciseResponse:
        training_session = self.sessions.get_owned_for_update(session_id)
        if training_session is None:
            raise SessionNotFoundError(session_id)
        request_id = str(client_request_id) if client_request_id else None
        if request_id:
            existing = self.exercises.get_by_client_id(session_id, request_id)
            if existing is not None:
                if existing.generation_meta_json.get("custom_content_deleted"):
                    raise SessionUnavailableError(session_id)
                return self._response(existing)
        if training_session.status == "completed":
            raise SessionCompletedError(session_id)
        if training_session.status != "active":
            raise SessionUnavailableError(session_id)
        if not training_session.normalized_topic_json.get("review_carousel"):
            requested_length = int(training_session.normalized_topic_json.get("session_length", 20))
            if self.attempt_requests.count_checked_or_reserved_exercises(session_id, datetime.now(UTC)) >= requested_length:
                if self.attempts.count_checked_exercises(session_id) >= requested_length:
                    raise SessionCompletedError(session_id)
                raise SessionPendingError(session_id)
        topic = SessionService.topic_snapshot(training_session)
        review_payload = training_session.normalized_topic_json.get("review_phrase")
        if review_payload:
            return self._review_exercise(training_session.id, review_payload, request_id)
        if training_session.normalized_topic_json.get("review_carousel"):
            return self._next_review_exercise(training_session.id, request_id)
        self.review_phrases.activate_due(datetime.now(UTC))
        recent = self.exercises.list_recent(session_id, limit=20)
        skills = self.skills.list_for_training(self.user_id)
        skill_catalog = {skill.key: skill for skill in skills}
        targets = self.scheduler.select_target_skills(
            skills[:200], topic, recent, user_id=self.user_id
        )
        target_keys = [skill.key for skill in targets]
        target_payload = [
            {"key": skill.key, "category": skill.category, "title_ru": skill.title_ru}
            for skill in targets
        ]
        recent_sources = [exercise.source_ru for exercise in recent]
        selected_phrase = self._select_topic_phrase(topic.id, recent_sources)
        if isinstance(selected_phrase, ReviewPhrase):
            return self._review_exercise(training_session.id, self._review_payload(selected_phrase), request_id)
        catalog_phrase = selected_phrase
        if catalog_phrase is not None:
            target_keys = [key for key in catalog_phrase.targeted_skill_keys_json if key in skill_catalog]
            result = ExerciseGenerationResult(
                source_ru=catalog_phrase.source_ru,
                topic_fit=f"Постоянный каталог A2 для темы «{topic.title_ru}».",
                intended_tr_variants=[catalog_phrase.canonical_tr],
                targeted_skills=target_keys,
                difficulty=0.5,
                novelty_signature=f"catalog:{catalog_phrase.id}",
                word_hints=catalog_phrase.word_hints_json,
            )
        else:
            if topic.source == "general":
                result = self._generate(topic, target_payload, target_keys, recent_sources)
                catalog_phrase = None
            else:
                raise TopicEmptyError
        entity = self._save_exercise(
            Exercise(
                session_id=session_id,
                client_request_id=request_id,
                source_ru=result.source_ru,
                targeted_skill_ids=[skill_catalog[key].id for key in target_keys if key in skill_catalog],
                target_hints_json={
                    "intended_tr_variants": result.intended_tr_variants,
                    "canonical_tr": result.intended_tr_variants[0],
                    "word_hints": [hint.model_dump() for hint in result.word_hints],
                },
                generation_meta_json={
                    "topic_fit": result.topic_fit,
                    "difficulty": result.difficulty,
                    "novelty_signature": result.novelty_signature,
                    "expected_level": result.expected_level,
                    "targeted_skill_keys": target_keys,
                    "topic_phrase_id": catalog_phrase.id if catalog_phrase else None,
                    "topic_id": topic.id if catalog_phrase else None,
                },
            )
        )
        return self._response(entity)

    def _select_topic_phrase(self, topic_id: str, recent_sources: list[str]):
        phrases = [
            *self.topic_phrases.list_for_topic(topic_id, self.user_id),
            *(phrase for phrase in self.review_phrases.list_active_for_topic(topic_id)
              if phrase.topic_phrase_id is None),
        ]
        if not phrases:
            return None
        recent_normalized = {self._normalize(source) for source in recent_sources}
        fresh = [phrase for phrase in phrases if self._normalize(phrase.source_ru) not in recent_normalized]
        candidates = fresh or phrases
        return random.choice(candidates)

    def _next_review_exercise(self, session_id: str, request_id: str | None = None) -> ExerciseResponse:
        self.review_phrases.activate_due(datetime.now(UTC))
        phrases = self.review_phrases.list_active()
        if not phrases:
            raise ReviewQueueEmptyError
        recent_ids = {
            str(item.generation_meta_json.get("review_phrase_id"))
            for item in self.exercises.list_recent(session_id, limit=8)
            if item.generation_meta_json.get("review_phrase_id")
        }
        candidates = [phrase for phrase in phrases if phrase.id not in recent_ids] or phrases
        phrase = random.choice(candidates)
        return self._review_exercise(session_id, self._review_payload(phrase), request_id)

    @staticmethod
    def _review_payload(phrase) -> dict:
        return {
            "id": phrase.id,
            "source_ru": phrase.source_ru,
            "intended_tr_variants": phrase.intended_tr_variants_json,
            "word_hints": phrase.word_hints_json,
            "targeted_skill_keys": phrase.targeted_skill_keys_json,
            "topic_id": phrase.topic_id,
            "topic_phrase_id": phrase.topic_phrase_id,
        }

    def _review_exercise(self, session_id: str, payload: dict, request_id: str | None = None) -> ExerciseResponse:
        # A resumed session may contain an older snapshot of corrected hints.
        current = self.review_phrases.get_owned(str(payload["id"]))
        if current is not None:
            payload = self._review_payload(current)
        target_keys = list(payload.get("targeted_skill_keys", []))
        catalog = {skill.key: skill for skill in self.skills.list(limit=500)}
        entity = self._save_exercise(
            Exercise(
                session_id=session_id,
                client_request_id=request_id,
                source_ru=str(payload["source_ru"]),
                targeted_skill_ids=[catalog[key].id for key in target_keys if key in catalog],
                target_hints_json={
                    "intended_tr_variants": list(payload.get("intended_tr_variants", [])),
                    "canonical_tr": next(iter(payload.get("intended_tr_variants", [])), None),
                    "word_hints": list(payload.get("word_hints", [])),
                },
                generation_meta_json={
                    "topic_fit": "Фраза из персонального списка повторения.",
                    "difficulty": 0.5,
                    "novelty_signature": f"review:{payload['id']}",
                    "expected_level": "A2",
                    "targeted_skill_keys": target_keys,
                    "review_phrase_id": str(payload["id"]),
                    "topic_id": payload.get("topic_id"),
                    "topic_phrase_id": payload.get("topic_phrase_id"),
                },
            )
        )
        return self._response(entity)

    def _save_exercise(self, entity: Exercise) -> Exercise:
        try:
            return self.exercises.add(entity)
        except IntegrityError:
            request_id = entity.client_request_id
            self.db.rollback()
            if request_id:
                existing = self.exercises.get_by_client_id(entity.session_id, request_id)
                if existing is not None:
                    return existing
            raise

    def _response(self, entity: Exercise) -> ExerciseResponse:
        from app.services.interface_language import interface_language
        from app.services.source_versions import SourceLanguageService, exercise_source
        versions = SourceLanguageService(self.db, self.ai, self.user_id).ensure(entity)
        language = interface_language.get()
        topic_id = entity.generation_meta_json.get("topic_id")
        topic = self.topics.get_visible(topic_id) if topic_id and entity.generation_meta_json.get("review_phrase_id") else None
        canonical = entity.target_hints_json.get("canonical_tr") or next(iter(entity.target_hints_json.get("intended_tr_variants", [])), "")
        return ExerciseResponse(
            topic_id=topic_id,
            topic_title_ru=topic.title_ru if topic else None,
            id=entity.id,
            session_id=entity.session_id,
            source_ru=entity.source_ru,
            source_en=versions.en if versions else None,
            source_versions=versions,
            source_text=exercise_source(entity, language),
            source_language=language,
            source_hints=aligned_word_hints(entity.source_ru, canonical, list(entity.target_hints_json.get("word_hints", []))),
            targeted_skills=list(entity.generation_meta_json.get("targeted_skill_keys", [])),
            difficulty=float(entity.generation_meta_json.get("difficulty", 0.5)),
            word_hints=getattr(versions, 'hints_' + language) if versions else word_hints_for_language(entity.source_ru, list(entity.target_hints_json.get("word_hints", [])), canonical),
        )

    def _generate(
        self,
        topic,
        target_payload: list[dict[str, str]],
        target_keys: list[str],
        recent_sources: list[str],
    ) -> ExerciseGenerationResult:
        if self.ai.is_available:
            try:
                result = ExerciseGenerationResult.model_validate(
                    self.ai.generate_exercise(
                        topic=topic,
                        target_skills=target_payload,
                        recent_sources=recent_sources,
                    )
                )
                retry_reason = None
                if not self._is_russian_source(result.source_ru):
                    retry_reason = "source_ru must be entirely in Russian, written in Cyrillic, with no Turkish words or Latin letters."
                elif self._too_similar(result.source_ru, recent_sources):
                    retry_reason = "The sentence is too similar to a recent one; choose a different situation and wording."
                if retry_reason:
                    result = ExerciseGenerationResult.model_validate(
                        self.ai.generate_exercise(
                            topic=topic,
                            target_skills=target_payload,
                            recent_sources=recent_sources,
                            retry_reason=retry_reason,
                        )
                    )
                if self._is_russian_source(result.source_ru) and not self._too_similar(result.source_ru, recent_sources):
                    return result.model_copy(update={"targeted_skills": target_keys})
            except AIServiceError:
                pass
        return self._local_fallback(topic.id, topic.title_ru, target_keys, recent_sources)

    @staticmethod
    def _local_fallback(
        topic_id: str,
        topic_title: str,
        target_keys: list[str],
        recent_sources: list[str],
    ) -> ExerciseGenerationResult:
        templates = LOCAL_EXERCISES.get(topic_id, LOCAL_EXERCISES["general"])
        recent_normalized = {ExerciseGenerator._normalize(source) for source in recent_sources}
        index = next(
            (i for i, (source, _) in enumerate(templates) if ExerciseGenerator._normalize(source) not in recent_normalized),
            len(recent_sources) % len(templates),
        )
        source, variants = templates[index]
        return ExerciseGenerationResult(
            source_ru=source,
            topic_fit=f"Локальный A2 fallback для темы «{topic_title}».",
            intended_tr_variants=list(variants),
            targeted_skills=target_keys,
            difficulty=0.5,
            novelty_signature=f"local:{topic_id}:{index}",
            word_hints=ExerciseGenerator._local_word_hints(source),
        )

    @staticmethod
    def _local_word_hints(source: str) -> list[dict[str, str]]:
        words = re.findall(r"[А-Яа-яЁё]+", source)
        return [
            {"word_ru": word, "translation_tr": LOCAL_WORD_TRANSLATIONS[word.casefold()]}
            for word in words
            if word.casefold() in LOCAL_WORD_TRANSLATIONS
        ]

    @classmethod
    def _too_similar(cls, source: str, recent_sources: list[str]) -> bool:
        normalized = cls._normalize(source)
        return any(SequenceMatcher(None, normalized, cls._normalize(recent)).ratio() >= 0.82 for recent in recent_sources)

    @staticmethod
    def _normalize(value: str) -> str:
        return re.sub(r"[^а-яёa-z0-9]+", " ", value.casefold()).strip()

    @staticmethod
    def _is_russian_source(value: str) -> bool:
        return re.search(r"[А-Яа-яЁё]", value) is not None and re.search(r"[A-Za-z]", value) is None
