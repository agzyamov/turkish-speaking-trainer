from uuid import UUID, uuid4

import httpx2
import pytest
from anthropic import APIStatusError, APITimeoutError
from fastapi import FastAPI
from fastapi.exceptions import ResponseValidationError
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.schemas import AnswerAnalysis, AnswerIssue, CreateAttemptRequest
from app.services.ai_adapter import AIServiceError
from app.services.answer_analyzer import AnalysisUnavailableError, AnswerAnalyzer
from app.services.failure_diagnostics import classify_provider_error, diagnostic, diagnostic_context
from tests.fakes import FakeAIProvider
from tests.providers import claude_provider


@pytest.mark.parametrize("status,code,reason,retryable", [
    (429, "rate_limit_error", "rate_limit", True), (402, "billing_error", "quota", False), (429, "billing_error", "quota", False),
    (401, "authentication_error", "authentication", False), (403, "permission_error", "authentication", False),
    (500, "api_error", "provider_status", True), (529, "overloaded_error", "provider_status", True),
    (400, "invalid_request_error", "provider_status", False),
])
def test_provider_status_taxonomy_is_safe(status, code, reason, retryable):
    response = httpx2.Response(status, request=httpx2.Request("POST", "https://example.invalid"))
    exc = APIStatusError("PRIVATE secret raw transcript", response=response, body={"type": "error", "error": {"type": code, "message": "PRIVATE"}})
    failure = classify_provider_error(exc)
    assert (failure.kind, failure.stage, failure.reason, failure.retryable) == ("external_model", "provider_request", reason, retryable)
    assert failure.provider_status == status
    assert "PRIVATE" not in failure.model_dump_json()


def test_timeout_and_schema_errors_are_different():
    assert classify_provider_error(APITimeoutError(request=httpx2.Request("POST", "https://example.invalid"))).reason == "timeout"
    assert classify_provider_error(ValueError("PRIVATE invalid JSON")).kind == "response_parse"


@pytest.mark.parametrize("language", ["ru", "en"])
def test_punctuation_rejection_retries_with_feedback_and_preserves_original(language, caplog):
    from app.services.interface_language import interface_language
    transcript, evidence, correction = "Da li radiš. Radim sada.", "Da li radiš.", "Da li radiš?"
    invalid = AnswerAnalysis(verdict="mostly_correct", semantic_score=.98, grammar_score=.98,
        lexical_score=1, naturalness_score=.98, fluency_score=1, corrected_tr="Da li radiš? Radim trenutno.",
        short_feedback_ru="Synthetic", detailed_feedback_ru="Synthetic", issues=[AnswerIssue(
            type="naturalness", skill_key=None, severity=.1, confidence=1, evidence=evidence, correction=correction)])
    valid = invalid.model_copy(update={"verdict": "correct", "issues": []})
    calls = []
    class AI(FakeAIProvider):
        def analyze_answer(self, **kwargs):
            calls.append(kwargs)
            return invalid if len(calls) == 1 else valid
    token = interface_language.set(language)
    try:
        result = AnswerAnalyzer(AI(available=True)).analyze(source_ru="Synthetic source", transcript_tr=transcript,
            canonical_tr="Da li radiš? Radim trenutno.", intended_tr_variants=[], target_skills=[],
            timing=CreateAttemptRequest(exercise_id="synthetic", transcript_tr=transcript))
    finally:
        interface_language.reset(token)
    assert result.verdict == "correct" and result.issues == []
    assert len(calls) == 2 and "validation_feedback" not in calls[0]
    assert calls[1]["validation_feedback"] == "non_lexical_correction"
    assert calls[1]["transcript_tr"] == calls[0]["transcript_tr"] == transcript  # The retry sees the learner's own words.
    assert "non_lexical_correction" in caplog.text
    assert "Synthetic source" not in caplog.text and transcript not in caplog.text


def test_invalid_retry_has_parse_failure_not_provider_outage():
    analysis = AnswerAnalysis(verdict="mostly_correct", semantic_score=.9, grammar_score=.9, lexical_score=.9,
        naturalness_score=.9, fluency_score=1, corrected_tr="Radim trenutno.", short_feedback_ru="Synthetic",
        detailed_feedback_ru="Synthetic", issues=[AnswerIssue(type="meaning", skill_key=None, severity=.1,
        confidence=1, evidence="Radim.", correction="Radim?")])
    ai = FakeAIProvider(available=True, analysis_result=analysis)
    token = diagnostic_context.set(str(uuid4()))
    try:
        with pytest.raises(AnalysisUnavailableError) as error:
            AnswerAnalyzer(ai).analyze(source_ru="Synthetic", transcript_tr="Radim sada.",
                canonical_tr="Radim trenutno.", intended_tr_variants=[], target_skills=[],
                timing=CreateAttemptRequest(exercise_id="synthetic", transcript_tr="Radim sada."))
        assert error.value.failure.kind == "response_parse"
        assert error.value.failure.reason == "non_lexical_correction"
        assert error.value.failure.diagnostic_id == diagnostic_context.get()
        assert ai.analysis_calls == 2
    finally:
        diagnostic_context.reset(token)


def test_adapter_classifies_schema_failure_and_sends_retry_feedback():
    provider, messages = claude_provider({"invalid": "PRIVATE"})
    with pytest.raises(AIServiceError) as error:
        provider.analyze_answer(source_ru="Synthetic", transcript_tr="Synthetic", canonical_tr=None,
            intended_tr_variants=[], target_skills=[], timings={}, validation_feedback="non_lexical_correction")
    assert error.value.failure.kind == "response_parse"
    assert error.value.failure.stage == "structured_output"
    assert '"previous_validation_failure": "non_lexical_correction"' in messages.user_text()
    assert error.value.failure.reason == "invalid_schema"
    assert "PRIVATE" not in error.value.failure.model_dump_json() and "PRIVATE" not in str(error.value)


@pytest.mark.parametrize("exception,stage,reason", [
    (ResponseValidationError([{"type": "missing", "loc": ["response", "PRIVATE"], "input": "PRIVATE"}]), "serialization", "serialization_failed"),
    (OperationalError("PRIVATE SQL", {}, Exception("PRIVATE secret")), "persistence", "persistence_failed"),
    (RuntimeError("PRIVATE transcript"), "server_return", "server_return_failed"),
])
def test_return_failures_never_leak_and_keep_request_id(exception, stage, reason):
    from app.main import persistence_failed, record_request_timing, response_validation_failed, unhandled_return_failed
    local = FastAPI()
    local.middleware("http")(record_request_timing)
    local.add_exception_handler(ResponseValidationError, response_validation_failed)
    local.add_exception_handler(OperationalError, persistence_failed)
    local.add_exception_handler(Exception, unhandled_return_failed)
    @local.get("/synthetic")
    def endpoint():
        raise exception
    request_id = str(uuid4())
    with TestClient(local, raise_server_exceptions=False) as client:
        response = client.get("/synthetic", headers={"X-Request-ID": request_id})
    assert response.status_code == 500
    assert response.headers["X-Request-ID"] == request_id
    failure = response.json()["detail"]["failure"]
    assert (failure["kind"], failure["stage"], failure["reason"]) == ("response_return", stage, reason)
    assert failure["diagnostic_id"] == request_id
    assert "PRIVATE" not in response.text


def test_failed_attempt_exposes_correlated_metadata_without_charging_attempt(api_client, db_session):
    from sqlalchemy import func, select

    from app.main import app
    from app.models import Attempt
    from app.services.ai_adapter import get_ai_provider
    from tests.test_attempts_api import _exercise
    exercise = _exercise(api_client)
    class AI(FakeAIProvider):
        def analyze_answer(self, **_kwargs):
            raise AIServiceError("PRIVATE", diagnostic("external_model", "provider_request", "quota", retryable=False))
    app.dependency_overrides[get_ai_provider] = lambda: AI(available=True)
    request_id = str(uuid4())
    response = api_client.post("/api/attempts", json={"exercise_id": exercise["id"], "transcript_tr": "Synthetic unmatched words."}, headers={"X-Request-ID": request_id})
    assert response.status_code == 503
    detail = response.json()["detail"]
    assert detail["code"] == "analysis_unavailable" and detail["retryable"] is False
    assert detail["failure"]["kind"] == "external_model" and detail["failure"]["reason"] == "quota"
    assert detail["failure"]["diagnostic_id"] == response.headers["X-Request-ID"] == request_id
    assert "PRIVATE" not in response.text
    assert db_session.scalar(select(func.count()).select_from(Attempt)) == 0


def test_bad_request_id_is_replaced_and_context_is_reset(api_client):
    response = api_client.get("/api/health", headers={"X-Request-ID": "PRIVATE unsafe value"})
    UUID(response.headers["X-Request-ID"])
    assert diagnostic_context.get() is None
