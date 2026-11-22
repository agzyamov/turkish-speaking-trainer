from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.db.topic_phrase_hints import TOPIC_PHRASE_HINTS
from app.db.topic_phrases import TOPIC_PHRASES
from app.models import Exercise, ReviewPhrase, Skill, TopicPhrase, TopicPreset
from app.repositories import SkillRepository, TopicPhraseRepository, TopicPresetRepository


@dataclass(frozen=True)
class SkillSeed:
    key: str
    category: str
    title_ru: str
    explanation_ru: str
    difficulty: float


SKILLS: tuple[SkillSeed, ...] = (
    SkillSeed("vocab.hesap", "vocabulary", "hesap", "Счёт: в кафе, в банке или расчёт.", 0.3),
    SkillSeed("vocab.hemen", "vocabulary", "hemen", "Наречие «сразу, немедленно».", 0.25),
    SkillSeed("vocab.yine_de", "vocabulary", "yine de", "Связка «всё-таки, тем не менее».", 0.45),
    SkillSeed("vocab.lazim", "vocabulary", "lazım / gerek", "«Нужно» в разговорной речи.", 0.35),
    SkillSeed("vocab.ucret", "vocabulary", "ücret", "Плата, стоимость или комиссия.", 0.4),
    SkillSeed("vocab.ulasim", "vocabulary", "ulaşım", "Транспорт, поездки и пересадки.", 0.3),
    SkillSeed("vocab.kira", "vocabulary", "kira", "Аренда жилья и арендная плата.", 0.3),
    SkillSeed("vocab.randevu", "vocabulary", "randevu", "Запись на приём или встреча.", 0.35),
    SkillSeed("vocab.toplanti", "vocabulary", "toplantı", "Встреча или совещание на работе.", 0.35),
    SkillSeed("vocab.tatil", "vocabulary", "tatil", "Отпуск, отдых и выходные.", 0.25),
    SkillSeed("grammar.vowel_harmony", "grammar", "Гармония гласных", "Выбор гласной в аффиксе по последней гласной корня.", 0.4),
    SkillSeed("grammar.consonant_change", "grammar", "Чередование согласных", "Смягчение p/ç/t/k перед гласной и оглушение аффикса после глухой.", 0.55),
    SkillSeed("grammar.present_continuous", "grammar", "Настоящее время на -iyor", "Действие сейчас или в текущий период.", 0.3),
    SkillSeed("grammar.past_definite", "grammar", "Прошедшее время на -di", "Завершённое действие, которое говорящий видел сам.", 0.4),
    SkillSeed("grammar.past_reported", "grammar", "Прошедшее время на -miş", "Узнанное с чужих слов или замеченное по результату.", 0.6),
    SkillSeed("grammar.future", "grammar", "Будущее время на -ecek", "Планы, намерения и обещания.", 0.45),
    SkillSeed("grammar.aorist", "grammar", "Широкое время", "Привычки, общие истины и вежливые предложения.", 0.6),
    SkillSeed("grammar.accusative", "grammar", "Винительный падеж", "Определённый прямой объект: -ı/-i/-u/-ü.", 0.45),
    SkillSeed("grammar.dative", "grammar", "Дательный падеж", "Направление и адресат: -a/-e.", 0.4),
    SkillSeed("grammar.locative", "grammar", "Местный падеж", "Место и время: -da/-de/-ta/-te.", 0.35),
    SkillSeed("grammar.ablative", "grammar", "Исходный падеж", "Откуда и от чего: -dan/-den/-tan/-ten.", 0.45),
    SkillSeed("grammar.genitive_compound", "grammar", "Изафет", "Сочетания существительных: banka kartı, evin kapısı.", 0.6),
    SkillSeed("grammar.possessive", "grammar", "Притяжательные аффиксы", "Мой, твой, наш: çantam, evimiz.", 0.45),
    SkillSeed("grammar.question_particle", "grammar", "Вопросительная частица mı", "Частица mı/mi/mu/mü и её место в предложении.", 0.35),
    SkillSeed("grammar.negation", "grammar", "Отрицание", "Аффикс -me-, değil и yok.", 0.35),
    SkillSeed("grammar.var_yok", "grammar", "var / yok", "Есть и нет: наличие и обладание.", 0.25),
    SkillSeed("grammar.necessity", "grammar", "Необходимость", "-meli, gerekiyor, lazım: что нужно сделать.", 0.5),
    SkillSeed("grammar.ability", "grammar", "Возможность -ebil", "Могу, можно и не могу: -ebil- и -eme-.", 0.5),
    SkillSeed("construction.mek_istiyorum", "construction", "-mek istiyorum", "Выражение желания: хочу сделать.", 0.35),
    SkillSeed("construction.ebilir_misiniz", "construction", "-ebilir misiniz?", "Вежливая просьба к собеседнику.", 0.55),
    SkillSeed("construction.rica", "construction", "Lütfen / rica ederim", "Смягчённая просьба и ответ на благодарность.", 0.4),
    SkillSeed("construction.cunku", "construction", "Çünkü", "Объяснение причины.", 0.35),
    SkillSeed("construction.mek_icin", "construction", "-mek için", "Цель действия: чтобы сделать.", 0.5),
    SkillSeed("construction.ince", "construction", "-ince / -dığında", "Когда что-то произойдёт или произошло.", 0.7),
    SkillSeed("intent.greeting", "communicative_intent", "Поздороваться", "Выбрать уместное приветствие.", 0.15),
    SkillSeed("intent.polite_request", "communicative_intent", "Вежливо попросить", "Сформулировать просьбу без приказного тона.", 0.4),
    SkillSeed("intent.clarify", "communicative_intent", "Уточнить", "Переспросить или запросить детали.", 0.4),
    SkillSeed("intent.explain_reason", "communicative_intent", "Объяснить причину", "Кратко связать действие с причиной.", 0.45),
    SkillSeed("intent.disagree", "communicative_intent", "Тактично возразить", "Не согласиться естественно и вежливо.", 0.55),
    SkillSeed("intent.apologize", "communicative_intent", "Извиниться", "Извинение и короткое объяснение.", 0.3),
    SkillSeed("intent.arrange_time", "communicative_intent", "Договориться о времени", "Предложить и подтвердить время встречи.", 0.45),
    SkillSeed("intent.ask_price", "communicative_intent", "Спросить цену", "Уточнить стоимость или комиссию.", 0.3),
    SkillSeed("intent.report_problem", "communicative_intent", "Сообщить о проблеме", "Описать поломку, симптом или затруднение.", 0.45),
    SkillSeed("intent.give_opinion", "communicative_intent", "Высказать мнение", "Краткая личная оценка и аргумент.", 0.5),
    SkillSeed("pronunciation.dotless_i", "pronunciation", "Различение ı и i", "Грубый сигнал различения ı и i без фонемного диагноза.", 0.6),
    SkillSeed("pronunciation.soft_g", "pronunciation", "Буква ğ", "Грубый сигнал: ğ удлиняет гласную и не звучит как г.", 0.55),
    SkillSeed("fluency.reaction", "fluency", "Быстрый старт ответа", "Начать говорить без долгого извлечения конструкции.", 0.4),
    SkillSeed("fluency.long_pause", "fluency", "Длинная внутренняя пауза", "Сохранять плавность внутри короткой фразы.", 0.5),
    SkillSeed("fluency.self_correction", "fluency", "Самоисправление", "Снизить число повторных перезапусков фразы.", 0.5),
    SkillSeed("fluency.steady_rate", "fluency", "Ровный темп", "Произносить короткую фразу без резких провалов темпа.", 0.45),
)


TOPICS: tuple[dict[str, object], ...] = (
    {"id": "misc", "title_ru": "Разное", "description_ru": "Повседневные разговоры, короткие диалоги и разговорные выражения.", "intents_json": [], "vocabulary_json": []},
    {"id": "job-interview", "title_ru": "Собеседование", "description_ru": "Опыт, навыки и условия работы.", "intents_json": ["представиться", "рассказать об опыте", "уточнить условия"], "vocabulary_json": ["iş", "deneyim", "beceri", "maaş"]},
    {"id": "bank", "title_ru": "Банк", "description_ru": "Счёт, карта, документы и комиссии.", "intents_json": ["объяснить цель", "спросить о документах", "уточнить комиссию"], "vocabulary_json": ["hesap", "kart", "ücret", "kimlik"]},
    {"id": "vacation", "title_ru": "Отпуск", "description_ru": "Поездка, впечатления и планы.", "intents_json": ["рассказать о прошлом", "описать место", "обсудить планы"], "vocabulary_json": ["tatil", "yolculuk", "deniz", "otel"]},
    {"id": "cafe", "title_ru": "Кафе", "description_ru": "Заказ, пожелания и оплата.", "intents_json": ["сделать заказ", "уточнить состав", "попросить счёт"], "vocabulary_json": ["menü", "sipariş", "hesap", "bahşiş"]},
    {"id": "work", "title_ru": "Работа", "description_ru": "Задачи, встречи и рабочий день.", "intents_json": ["обсудить задачу", "договориться о времени", "сообщить о задержке"], "vocabulary_json": ["toplantı", "görev", "son tarih", "iş arkadaşı"]},
    {"id": "doctor", "title_ru": "Врач", "description_ru": "Симптомы, запись и рекомендации.", "intents_json": ["описать симптом", "записаться на приём", "уточнить лечение"], "vocabulary_json": ["muayene", "ağrı", "ilaç", "randevu"]},
    {"id": "rent", "title_ru": "Аренда", "description_ru": "Квартира, условия и бытовые проблемы.", "intents_json": ["уточнить условия", "сообщить о поломке", "договориться о ремонте"], "vocabulary_json": ["daire", "kira", "tamir", "ev sahibi"]},
    {"id": "transport", "title_ru": "Транспорт", "description_ru": "Маршрут, билет и пересадка.", "intents_json": ["спросить дорогу", "купить билет", "уточнить расписание"], "vocabulary_json": ["ulaşım", "bilet", "durak", "aktarma"]},
)


class ForeignCatalogError(RuntimeError):
    """The database holds a skill catalogue this product does not define."""


def seed_catalog(session: Session) -> tuple[int, int, int]:
    skill_repo = SkillRepository(session)
    topic_repo = TopicPresetRepository(session)
    phrase_repo = TopicPhraseRepository(session)
    skills_added = 0
    topics_added = 0
    phrases_added = 0

    # A database seeded with another catalogue has learner history tied to its
    # skills and phrases. It is never converted in place: seed a fresh database.
    known = {item.key for item in SKILLS}
    foreign = sorted(set(session.scalars(select(Skill.key))) - known)
    if foreign:
        raise ForeignCatalogError(
            f"Database holds {len(foreign)} skills this catalogue does not define (for example {foreign[0]!r}). "
            "Seed a fresh database; a database with another catalogue is not converted in place."
        )

    for item in SKILLS:
        skill = skill_repo.get_by_key(item.key)
        if skill is None:
            skill_repo.add(Skill(**item.__dict__))
            skills_added += 1
        else:
            skill.category, skill.title_ru = item.category, item.title_ru
            skill.explanation_ru, skill.difficulty = item.explanation_ru, item.difficulty

    for item in TOPICS:
        topic = topic_repo.get(item["id"])
        if topic is None:
            topic_repo.add(TopicPreset(**item))
            topics_added += 1
        else:
            topic.description_ru = item["description_ru"]
            topic.intents_json = list(item["intents_json"])
            topic.vocabulary_json = list(item["vocabulary_json"])

    for item in TOPIC_PHRASES:
        phrase = phrase_repo.get(item.id)
        values = {
            "topic_id": item.topic_id,
            "position": item.position,
            "source_ru": item.source_ru,
            "canonical_tr": item.canonical_tr,
            "word_hints_json": TOPIC_PHRASE_HINTS[item.id],
            "targeted_skill_keys_json": list(item.targeted_skill_keys_json),
            "enabled": True,
        }
        if phrase is None:
            phrase_repo.add(TopicPhrase(id=item.id, **values))
            phrases_added += 1
        else:
            for key, value in values.items():
                setattr(phrase, key, value)

    phrase_hints = {item.id: TOPIC_PHRASE_HINTS[item.id] for item in TOPIC_PHRASES}
    catalog = {item.id: item for item in TOPIC_PHRASES}
    for phrase in session.scalars(select(ReviewPhrase)):
        item = catalog.get(phrase.topic_phrase_id)
        if (item and phrase.source_ru == item.source_ru
                and next(iter(phrase.intended_tr_variants_json), "") == item.canonical_tr
                and phrase.word_hints_json != phrase_hints[item.id]):
            phrase.word_hints_json = phrase_hints[item.id]
            flag_modified(phrase, "updated_at")
    for exercise in session.scalars(select(Exercise)):
        topic_phrase_id = exercise.generation_meta_json.get("topic_phrase_id")
        item = catalog.get(topic_phrase_id)
        canonical = exercise.target_hints_json.get("canonical_tr") or next(iter(exercise.target_hints_json.get("intended_tr_variants", [])), "")
        if item and exercise.source_ru == item.source_ru and canonical in ("", item.canonical_tr):
            exercise.target_hints_json = {
                **exercise.target_hints_json,
                "word_hints": phrase_hints[topic_phrase_id],
            }

    return skills_added, topics_added, phrases_added
