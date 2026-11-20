"""Claude adapter: structured output, cost accounting and the spend cap (C-04, C-09, C-11, C-12, C-13)."""
from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AIUsageEvent
from app.schemas.ai_usage import ModelPrice
from app.schemas.topics import TopicTitleTranslation
from app.schemas.transcriptions import TranscriptionAssistanceAnalysis
from app.services.ai_adapter import AIServiceError
from app.services.anthropic_adapter import AnthropicStructuredProvider, AnthropicTranscriptionAssistanceProvider
from app.services.budget_guard import UsageContext, usage_context

PRICES = {
    "grading-from-env": ModelPrice(input_per_mtok=2, output_per_mtok=10, cache_write_per_mtok=2.5, cache_read_per_mtok=0.2),
    "utility-from-env": ModelPrice(input_per_mtok=0.1, output_per_mtok=0.5),
}
TITLE = TopicTitleTranslation(source_language="ru", translated_title="Bank")


def make_settings(**overrides) -> Settings:
    values = dict(_env_file=None, anthropic_api_key="synthetic-key", anthropic_grading_model="grading-from-env",
                  anthropic_utility_model="utility-from-env", ai_price_table=PRICES, ai_monthly_budget_usd=25,
                  anthropic_retry_backoff_seconds=0)
    return Settings(**{**values, **overrides})


class FakeMessages:
    def __init__(self, *, parsed=TITLE, stop_reason="end_turn", error: Exception | None = None, model: str | None = None) -> None:
        self.calls: list[dict] = []
        self.parsed, self.stop_reason, self.error, self.model = parsed, stop_reason, error, model

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        usage = SimpleNamespace(input_tokens=900, output_tokens=120, cache_creation_input_tokens=0, cache_read_input_tokens=700)
        return SimpleNamespace(parsed_output=self.parsed, stop_reason=self.stop_reason, usage=usage, model=self.model or kwargs["model"])


@pytest.fixture
def ledger(db_session: Session):
    token = usage_context.set(UsageContext(user_id="user-1", engine=db_session.get_bind()))
    yield db_session
    usage_context.reset(token)


def provider_with(messages: FakeMessages, **settings) -> AnthropicStructuredProvider:
    provider = AnthropicStructuredProvider(make_settings(**settings))
    provider._client = SimpleNamespace(messages=messages)
    return provider


def events(db: Session) -> list[AIUsageEvent]:
    db.expire_all()
    return list(db.scalars(select(AIUsageEvent)))


def test_request_uses_env_models_cached_prompt_and_schema(ledger):
    messages = FakeMessages()
    assert provider_with(messages).translate_topic_title("Банк") == TITLE
    [call] = messages.calls
    assert call["model"] == "utility-from-env"
    assert call["output_format"] is TopicTitleTranslation
    assert call["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert call["output_config"] == {"effort": "low"}
    assert "Банк" in call["messages"][0]["content"] and "Банк" not in call["system"][0]["text"]


def test_measured_usage_is_recorded_with_cache_pricing(ledger):
    provider_with(FakeMessages()).translate_topic_title("Банк")
    [event] = events(ledger)
    assert (event.provider, event.model, event.user_id, event.estimated) == ("anthropic", "utility-from-env", "user-1", False)
    assert (event.input_tokens, event.output_tokens, event.cache_read_tokens) == (900, 120, 700)
    assert event.cost_micro_usd == 900 * 0.1 + 120 * 0.5 + 700 * 0.1


def test_spent_budget_refuses_without_calling_claude(ledger):
    messages = FakeMessages()
    with pytest.raises(AIServiceError) as raised:
        provider_with(messages, ai_monthly_budget_usd=0).translate_topic_title("Банк")
    assert raised.value.failure.reason == "budget_exhausted" and raised.value.failure.retryable is False
    assert messages.calls == [] and events(ledger) == []


def test_unpriced_model_refuses_without_calling_claude(ledger):
    messages = FakeMessages()
    with pytest.raises(AIServiceError) as raised:
        provider_with(messages, anthropic_utility_model="unpriced").translate_topic_title("Банк")
    assert raised.value.failure.reason == "price_unknown" and messages.calls == []


@pytest.mark.parametrize(("stop_reason", "parsed", "reason"), [
    ("refusal", None, "model_refusal"),
    ("max_tokens", None, "incomplete_output"),
    ("end_turn", None, "missing_output"),
])
def test_unusable_responses_fail_safely_and_are_still_charged(ledger, stop_reason, parsed, reason):
    with pytest.raises(AIServiceError) as raised:
        provider_with(FakeMessages(parsed=parsed, stop_reason=stop_reason)).translate_topic_title("Банк")
    assert raised.value.failure.reason == reason
    assert len(events(ledger)) == 1


def test_timeout_is_charged_at_worst_case_and_other_failures_are_free(ledger):
    with pytest.raises(AIServiceError) as raised:
        provider_with(FakeMessages(error=TimeoutError()), anthropic_max_retries=0).translate_topic_title("Банк")
    assert raised.value.failure.reason == "timeout"
    [event] = events(ledger)
    assert event.estimated is True and event.output_tokens == 6000
    with pytest.raises(AIServiceError):
        provider_with(FakeMessages(error=ValueError("bad"))).translate_topic_title("Банк")
    assert len(events(ledger)) == 1


def test_unconfigured_adapter_reports_not_configured():
    provider = AnthropicStructuredProvider(make_settings(anthropic_api_key=None))
    assert provider.is_available is False
    with pytest.raises(AIServiceError) as raised:
        provider.translate_topic_title("Банк")
    assert raised.value.failure.reason == "not_configured"


def test_assistance_uses_the_short_time_budget_and_utility_model(ledger):
    provider = AnthropicTranscriptionAssistanceProvider(make_settings(anthropic_assistance_timeout_seconds=4))
    assert (provider._timeout_seconds, provider._max_retries) == (4, 0)
    result = TranscriptionAssistanceAnalysis(acceptable_variant=True, candidates=[])
    messages = FakeMessages(parsed=result)
    provider._client = SimpleNamespace(messages=messages)
    assert provider.analyze(source_ru="Мне нужен счёт.", raw_text="Treba mi račun.", canonical_tr="Treba mi račun.",
                            intended_tr_variants=["Treba mi račun."]) == result
    assert messages.calls[0]["model"] == "utility-from-env"


def test_default_factories_return_the_claude_adapters():
    from app.services.ai_adapter import get_ai_provider
    from app.services.transcription_assistance_adapter import get_transcription_assistance_provider
    assert isinstance(get_ai_provider(), AnthropicStructuredProvider)
    assert isinstance(get_transcription_assistance_provider(), AnthropicTranscriptionAssistanceProvider)


def _sdk_client(handler):
    import anthropic
    import httpx2
    return anthropic.Anthropic(api_key="synthetic-key", max_retries=0,
                               http_client=httpx2.Client(transport=httpx2.MockTransport(handler)))


def test_real_sdk_serializes_every_schema_and_parses_a_response(ledger):
    """Runs the real SDK over a mocked transport: no network, but the true request and response shapes."""
    import json

    import httpx2

    from app.schemas import ExerciseGenerationResult, TopicContext
    from app.schemas.attempts import ExplainedAnswerAnalysis
    from app.schemas.exercises import BilingualPhrasePreparation

    seen: list[dict] = []

    def handler(request):
        body = json.loads(request.content)
        seen.append(body)
        assert request.headers["x-api-key"] == "synthetic-key"
        if len(seen) > 1:
            return httpx2.Response(400, json={"type": "error", "error": {"type": "invalid_request_error", "message": "stop"}})
        return httpx2.Response(200, json={
            "id": "msg_1", "type": "message", "role": "assistant", "model": body["model"], "stop_reason": "end_turn",
            "stop_sequence": None, "content": [{"type": "text", "text": TITLE.model_dump_json()}],
            "usage": {"input_tokens": 50, "output_tokens": 9, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0},
        })

    provider = AnthropicStructuredProvider(make_settings())
    provider._client = _sdk_client(handler)
    assert provider.translate_topic_title("Банк") == TITLE
    assert seen[0]["output_config"]["effort"] == "low" and seen[0]["output_config"]["format"]["type"] == "json_schema"
    assert seen[0]["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert events(ledger)[0].input_tokens == 50

    for schema in (TopicContext, ExerciseGenerationResult, ExplainedAnswerAnalysis, BilingualPhrasePreparation, TranscriptionAssistanceAnalysis):
        with pytest.raises(AIServiceError) as raised:
            provider._parse(prompt_name="topic_normalizer_v2.md", role="utility", payload={"x": 1}, schema=schema)
        assert raised.value.failure.reason == "provider_status", schema.__name__
    assert len(seen) == 6


def test_each_retry_attempt_is_checked_and_recorded_separately(ledger):
    """A timed-out attempt may have been billed, so it is recorded before the retry is made."""
    calls = []

    class FlakyMessages(FakeMessages):
        def parse(self, **kwargs):
            calls.append(kwargs)
            if len(calls) == 1:
                raise TimeoutError()
            return super().parse(**kwargs)

    provider = provider_with(FlakyMessages())
    assert provider.translate_topic_title("Банк") == TITLE
    first, second = sorted(events(ledger), key=lambda event: event.estimated, reverse=True)
    assert (first.estimated, first.output_tokens) == (True, 6000) and (second.estimated, second.output_tokens) == (False, 120)
    assert all("timeout" in call for call in calls)


def test_retries_stop_at_the_configured_count_and_the_sdk_does_not_retry_on_its_own(ledger):
    messages = FakeMessages(error=TimeoutError())
    with pytest.raises(AIServiceError):
        provider_with(messages, anthropic_max_retries=2).translate_topic_title("Банк")
    assert len(messages.calls) == 3 and len(events(ledger)) == 3
    assert AnthropicStructuredProvider(make_settings()).client.max_retries == 0


def test_a_permanent_error_is_not_retried(ledger):
    import anthropic
    import httpx2
    denied = anthropic.AuthenticationError("bad key", response=httpx2.Response(401, request=httpx2.Request("POST", "https://x")), body=None)
    messages = FakeMessages(error=denied)
    with pytest.raises(AIServiceError):
        provider_with(messages).translate_topic_title("Банк")
    assert len(messages.calls) == 1


def test_no_retry_is_started_when_the_deadline_leaves_too_little_time(ledger):
    messages = FakeMessages(error=TimeoutError())
    provider = provider_with(messages)
    provider._deadline_seconds = 2
    with pytest.raises(AIServiceError):
        provider.translate_topic_title("Банк")
    assert len(messages.calls) == 1


def test_grading_uses_its_own_ceiling_and_effort(ledger):
    from app.schemas.attempts import ExplainedAnswerAnalysis
    analysis = ExplainedAnswerAnalysis(verdict="correct", semantic_score=1, grammar_score=1, lexical_score=1, naturalness_score=1,
                                       fluency_score=1, corrected_tr="Bir kahve lütfen.", short_feedback_ru="Верно.", detailed_feedback_ru="Верно.")
    messages = FakeMessages(parsed=analysis)
    provider_with(messages).analyze_answer(source_ru="Кофе, пожалуйста.", transcript_tr="Bir kahve lütfen.", canonical_tr="Bir kahve lütfen.",
                                           intended_tr_variants=[], target_skills=[], timings={})
    assert (messages.calls[0]["max_tokens"], messages.calls[0]["output_config"]) == (8000, {"effort": "medium"})
    assert messages.calls[0]["model"] == "grading-from-env"


def test_topic_title_prompt_does_not_carry_the_turkish_standard(ledger):
    messages = FakeMessages()
    provider_with(messages).translate_topic_title("Банк")
    assert "Language standard" not in messages.calls[0]["system"][0]["text"]
