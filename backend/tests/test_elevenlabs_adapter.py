"""ElevenLabs Scribe adapter: request shape, error taxonomy, cost accounting and the spend cap."""
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AIUsageEvent
from app.schemas.ai_usage import ModelPrice
from app.services.budget_guard import UsageContext, usage_context
from app.services.elevenlabs_adapter import ElevenLabsTranscriptionProvider
from app.services.transcription_adapter import TranscriptionServiceError

AUDIO = b"synthetic-audio-bytes"
OK = {"language_code": "tr", "language_probability": 0.99, "text": " Hesap açmak istiyorum. ",
      "words": [{"text": "Hesap", "start": 0.1, "end": 0.6}, {"text": "istiyorum.", "start": 0.7, "end": 2.4}]}


def make_settings(**overrides) -> Settings:
    values = dict(_env_file=None, elevenlabs_api_key="synthetic-key", elevenlabs_stt_model="stt-from-env",
                  ai_price_table={"stt-from-env": ModelPrice(audio_per_minute=0.006)}, ai_monthly_budget_usd=25)
    return Settings(**{**values, **overrides})


@pytest.fixture
def ledger(db_session: Session):
    token = usage_context.set(UsageContext(user_id="user-1", engine=db_session.get_bind()))
    yield db_session
    usage_context.reset(token)


def provider(handler, **settings) -> ElevenLabsTranscriptionProvider:
    return ElevenLabsTranscriptionProvider(make_settings(**settings), transport=httpx.MockTransport(handler))


def events(db: Session) -> list[AIUsageEvent]:
    db.expire_all()
    return list(db.scalars(select(AIUsageEvent)))


def test_sends_turkish_audio_with_env_model_and_returns_trimmed_text(ledger):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=OK)

    result = provider(handler).transcribe(audio=AUDIO, filename="answer.webm", content_type="audio/webm")
    assert result.text == "Hesap açmak istiyorum." and result.review_required is False
    [request] = seen
    body = request.content
    assert request.url.path == "/v1/speech-to-text" and request.headers["xi-api-key"] == "synthetic-key"
    assert b'name="model_id"\r\n\r\nstt-from-env' in body and b'name="language_code"\r\n\r\ntr' in body
    assert b'filename="answer.webm"' in body and AUDIO in body


def test_cost_is_recorded_from_the_measured_audio_length(ledger):
    provider(lambda _r: httpx.Response(200, json=OK)).transcribe(audio=AUDIO, filename="a.webm", content_type="audio/webm")
    [event] = events(ledger)
    assert (event.provider, event.model, event.stt_ms, event.estimated, event.user_id) == ("elevenlabs", "stt-from-env", 2401, False, "user-1")
    assert event.cost_micro_usd == 241  # 2.401 s at $0.006 per minute, rounded up


def test_response_without_timings_is_charged_at_the_worst_case(ledger):
    provider(lambda _r: httpx.Response(200, json={"text": "Merhaba"})).transcribe(audio=AUDIO, filename="a.webm", content_type="audio/webm")
    [event] = events(ledger)
    assert event.estimated is True and event.stt_ms == 130_000


def test_spent_budget_refuses_without_sending_audio(ledger):
    sent = []
    with pytest.raises(TranscriptionServiceError) as raised:
        provider(lambda r: sent.append(r) or httpx.Response(200, json=OK), ai_monthly_budget_usd=0).transcribe(
            audio=AUDIO, filename="a.webm", content_type="audio/webm")
    assert raised.value.code == "transcription_budget_exhausted" and raised.value.failure.reason == "budget_exhausted"
    assert sent == [] and events(ledger) == []


@pytest.mark.parametrize(("status", "code"), [
    (400, "transcription_audio_rejected"), (401, "transcription_provider_auth"), (403, "transcription_provider_auth"),
    (413, "transcription_audio_rejected"), (429, "transcription_rate_limit"), (404, "transcription_provider_error"),
])
def test_provider_statuses_map_to_closed_codes_without_leaking_bodies(ledger, status, code):
    with pytest.raises(TranscriptionServiceError) as raised:
        provider(lambda _r: httpx.Response(status, json={"detail": "provider-private-detail"})).transcribe(
            audio=AUDIO, filename="a.webm", content_type="audio/webm")
    assert raised.value.code == code and "provider-private-detail" not in str(raised.value)
    assert events(ledger) == []


def test_server_errors_are_retried_a_bounded_number_of_times(ledger):
    calls = []

    def flaky(_request):
        calls.append(1)
        return httpx.Response(503) if len(calls) == 1 else httpx.Response(200, json=OK)

    assert provider(flaky, elevenlabs_max_retries=1).transcribe(audio=AUDIO, filename="a.webm", content_type="audio/webm").text
    assert len(calls) == 2
    calls.clear()
    with pytest.raises(TranscriptionServiceError) as raised:
        provider(lambda _r: calls.append(1) or httpx.Response(503), elevenlabs_max_retries=1).transcribe(
            audio=AUDIO, filename="a.webm", content_type="audio/webm")
    assert raised.value.code == "transcription_provider_error" and len(calls) == 2


def test_timeout_is_reported_and_charged_as_possibly_billed(ledger):
    def slow(request):
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(TranscriptionServiceError) as raised:
        provider(slow, elevenlabs_max_retries=0).transcribe(audio=AUDIO, filename="a.webm", content_type="audio/webm")
    assert raised.value.code == "transcription_timeout"
    assert events(ledger)[0].estimated is True


@pytest.mark.parametrize(("body", "code"), [({"text": "   "}, "transcription_empty"), ({"words": []}, "transcription_invalid_response"),
                                             (["not", "an", "object"], "transcription_invalid_response")])
def test_unusable_bodies_fail_safely(ledger, body, code):
    with pytest.raises(TranscriptionServiceError) as raised:
        provider(lambda _r: httpx.Response(200, json=body)).transcribe(audio=AUDIO, filename="a.webm", content_type="audio/webm")
    assert raised.value.code == code


def test_feedback_transcription_lets_the_provider_detect_the_language(ledger):
    seen = []
    result = provider(lambda r: seen.append(r) or httpx.Response(200, json=OK)).transcribe_feedback(
        audio=AUDIO, filename="feedback.webm", content_type="audio/webm")
    assert result.text == "Hesap açmak istiyorum." and b"language_code" not in seen[0].content


def test_unconfigured_or_unpriced_adapter_is_not_configured(ledger):
    assert ElevenLabsTranscriptionProvider(make_settings(elevenlabs_api_key=None)).is_available is False
    with pytest.raises(TranscriptionServiceError) as raised:
        provider(lambda _r: httpx.Response(200, json=OK), ai_price_table={}).transcribe(audio=AUDIO, filename="a.webm", content_type="audio/webm")
    assert raised.value.code == "transcription_not_configured"


def test_audio_and_key_never_reach_the_logs(ledger, caplog):
    caplog.set_level("DEBUG")
    provider(lambda _r: httpx.Response(200, json=OK)).transcribe(audio=AUDIO, filename="a.webm", content_type="audio/webm")
    assert AUDIO.decode() not in caplog.text and "synthetic-key" not in caplog.text


def test_default_factory_returns_the_elevenlabs_adapter():
    from app.services.transcription_adapter import get_transcription_provider
    assert isinstance(get_transcription_provider(), ElevenLabsTranscriptionProvider)


def test_each_retry_attempt_is_recorded_separately(ledger):
    calls = []

    def flaky(request):
        calls.append(request)
        if len(calls) == 1:
            raise httpx.ReadTimeout("slow", request=request)
        return httpx.Response(200, json=OK)

    provider(flaky, elevenlabs_max_retries=1).transcribe(audio=AUDIO, filename="a.webm", content_type="audio/webm")
    assert len(calls) == 2
    assert sorted(event.estimated for event in events(ledger)) == [False, True]


def test_model_override_shares_one_http_client():
    base = provider(lambda _r: httpx.Response(200, json=OK))
    first, second = base.for_model("stt-alt"), base.for_model("stt-alt")
    assert first.client is base.client and second.client is base.client
    assert first.settings.elevenlabs_stt_model == "stt-alt"
