import json

import pytest

from app.schemas import AnswerAnalysis, AnswerIssue, CreateAttemptRequest
from app.schemas.attempts import ExplainedAnswerAnalysis
from app.services.ai_adapter import AIServiceError
from app.services.answer_analyzer import AnswerAnalyzer
from app.services.interface_language import interface_language
from tests.fakes import FakeAIProvider
from tests.providers import GRADING_MODEL, claude_provider


def analysis(issue):
    return AnswerAnalysis(
        verdict="mostly_correct", semantic_score=.9, grammar_score=.8,
        lexical_score=.8, naturalness_score=.8, fluency_score=1,
        corrected_tr="Molim vas, popravi odgovor.", short_feedback_ru="Есть неточность.",
        detailed_feedback_ru="Проверьте форму слова.", issues=[AnswerIssue(**issue)],
    )


def test_new_ai_contract_requires_reason_but_stored_legacy_issues_are_readable():
    issue = dict(type="grammar", skill_key="grammar.form", severity=.2, confidence=.9,
                 evidence="poprave", correction="popravi")
    legacy = analysis(issue).model_dump()
    explanation = "Здесь обращение к одному человеку: нужна форма повелительного наклонения."
    explained = {**legacy, "issues": [{**legacy["issues"][0], "explanation_ru": explanation}]}
    provider, messages = claude_provider(results=[legacy, explained])
    arguments = dict(source_ru="Исправь ответ.", transcript_tr="poprave odgovor",
                     canonical_tr="popravi odgovor", intended_tr_variants=[], target_skills=[], timings={})
    with pytest.raises(AIServiceError):
        provider.analyze_answer(**arguments)
    result = provider.analyze_answer(**arguments)
    assert result.issues[0].explanation_ru == explanation
    assert len(messages.calls) == 2
    assert messages.last["output_format"] is ExplainedAnswerAnalysis
    assert messages.last["model"] == GRADING_MODEL
    assert "do not lower it or invent an issue to make it match the reference" in messages.system_text()
    assert messages.last["output_config"] == {"effort": "medium"}  # grading effort (ADR-0007)
    assert AnswerAnalysis.model_validate(analysis(issue).model_dump()).issues[0].explanation_ru is None


@pytest.mark.parametrize("language", ["ru", "en"])
def test_ai_contract_accepts_explained_errors_without_curriculum_keys(language):
    model = analysis(dict(type="grammar", skill_key=None, severity=.2, confidence=.9,
                          evidence="poprave", correction="popravi", explanation_ru="Use the singular imperative."))
    provider, messages = claude_provider(model.model_dump())
    token = interface_language.set(language)
    try:
        result = provider.analyze_answer(source_ru="Исправь ответ.", transcript_tr="poprave odgovor",
                                        canonical_tr="popravi odgovor", intended_tr_variants=[], target_skills=[], timings={})
    finally:
        interface_language.reset(token)
    assert result.issues[0].skill_key is None
    assert result.issues[0].explanation_ru
    assert "every `skill_key` is null" in messages.system_text()
    # The learner's language travels in the request, so the cached system prompt is the same for ru and en.
    assert json.loads(messages.user_text())["feedback_language"] == language
    assert "feedback_language" in messages.system_text()


@pytest.mark.parametrize("issue_type,evidence,correction,explanation", [
    ("grammar", "poprave", "popravi", "При обращении к одному человеку нужна форма повелительного наклонения."),
    ("vocabulary", "kupim", "prodajem", "Первое слово означает покупку, а задание говорит о продаже."),
    ("naturalness", "ja se zovem", "zovem se", "Местоимение задаёт акцент; нейтральное представление не требует акцента на говорящем."),
])
def test_per_issue_reason_survives_canonical_alignment_and_token_feedback(issue_type, evidence, correction, explanation):
    model = analysis(dict(type=issue_type, skill_key="grammar.form", severity=.2, confidence=.9,
                          evidence=evidence, correction=correction, explanation_ru=explanation))
    canonical = f"{correction} odgovor."
    transcript = f"{evidence} odgovor."
    result = AnswerAnalyzer(FakeAIProvider(available=True, analysis_result=model)).analyze(
        source_ru="Задание", transcript_tr=transcript, canonical_tr=canonical,
        intended_tr_variants=[canonical], target_skills=[{"key": "grammar.form"}],
        timing=CreateAttemptRequest(exercise_id="fixture", transcript_tr=transcript),
    )
    assert result.issues[0].explanation_ru == explanation
    assert result.corrected_tr == canonical
    assert result.pronunciation_score is None
