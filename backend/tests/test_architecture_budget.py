"""Architecture test for C-09: no path reaches an AI provider without passing the budget guard.

Every operation of every production adapter is called with the budget spent. Each must refuse,
and the provider client must see no request. A new adapter operation that skips the guard fails here.
"""
import inspect
from types import SimpleNamespace

import httpx
import pytest

from app.config import Settings
from app.schemas.ai_usage import ModelPrice
from app.schemas.topics import TopicContext
from app.services.ai_adapter import AIServiceError, StructuredAIProvider, get_ai_provider
from app.services.anthropic_adapter import AnthropicStructuredProvider, AnthropicTranscriptionAssistanceProvider
from app.services.budget_guard import UsageContext, usage_context
from app.services.elevenlabs_adapter import ElevenLabsTranscriptionProvider
from app.services.transcription_adapter import TranscriptionProvider, TranscriptionServiceError, get_transcription_provider
from app.services.transcription_assistance_adapter import TranscriptionAssistanceProvider, get_transcription_assistance_provider

SPENT = Settings(_env_file=None, anthropic_api_key="k", anthropic_grading_model="g", anthropic_utility_model="u",
                 elevenlabs_api_key="k", elevenlabs_stt_model="s", ai_monthly_budget_usd=0,
                 ai_price_table={"g": ModelPrice(input_per_mtok=2, output_per_mtok=10), "u": ModelPrice(input_per_mtok=1, output_per_mtok=1),
                                 "s": ModelPrice(audio_per_minute=0.006)})
TOPIC = TopicContext(id="bank", source="preset", title_ru="Банк", description_ru="В банке", normalized_prompt_context="bank")
ARGUMENTS = {
    "translate_topic_title": dict(text="Банк"),
    "normalize_topic": dict(text="Банк"),
    "generate_exercise": dict(topic=TOPIC, target_skills=[], recent_sources=[]),
    "analyze_answer": dict(source_ru="a", transcript_tr="b", canonical_tr="b", intended_tr_variants=["b"], target_skills=[], timings={}),
    "prepare_phrase": dict(source_ru="a"),
    "analyze": dict(source_ru="a", raw_text="b", canonical_tr="b", intended_tr_variants=["b"]),
    "transcribe": dict(audio=b"x", filename="a.webm", content_type="audio/webm"),
    "transcribe_feedback": dict(audio=b"x", filename="a.webm", content_type="audio/webm"),
}


def operations(port) -> list[str]:
    return [name for name, member in inspect.getmembers(port, inspect.isfunction) if not name.startswith("_")]


class Tripwire:
    """Stands in for a provider client and records any attempt to use it."""
    def __init__(self) -> None:
        self.touched = False
        self.messages = SimpleNamespace(parse=self._touch)

    def _touch(self, *_args, **_kwargs):
        self.touched = True
        raise AssertionError("provider was called with the budget spent")


@pytest.fixture(autouse=True)
def ledger(db_session):
    token = usage_context.set(UsageContext("user-1", db_session.get_bind()))
    yield
    usage_context.reset(token)


@pytest.mark.parametrize("operation", operations(StructuredAIProvider))
def test_claude_operations_are_guarded(operation):
    provider, wire = AnthropicStructuredProvider(SPENT), Tripwire()
    provider._client = wire
    with pytest.raises(AIServiceError) as raised:
        getattr(provider, operation)(**ARGUMENTS[operation])
    assert raised.value.failure.reason == "budget_exhausted" and wire.touched is False


@pytest.mark.parametrize("operation", operations(TranscriptionAssistanceProvider))
def test_claude_assistance_operations_are_guarded(operation):
    provider, wire = AnthropicTranscriptionAssistanceProvider(SPENT), Tripwire()
    provider._client = wire
    with pytest.raises(AIServiceError) as raised:
        getattr(provider, operation)(**ARGUMENTS[operation])
    assert raised.value.failure.reason == "budget_exhausted" and wire.touched is False


@pytest.mark.parametrize("operation", operations(TranscriptionProvider))
def test_elevenlabs_operations_are_guarded(operation):
    sent = []
    provider = ElevenLabsTranscriptionProvider(SPENT, transport=httpx.MockTransport(lambda r: sent.append(r) or httpx.Response(200, json={"text": "x"})))
    with pytest.raises(TranscriptionServiceError) as raised:
        getattr(provider, operation)(**ARGUMENTS[operation])
    assert raised.value.code == "transcription_budget_exhausted" and sent == []


def test_every_port_operation_is_covered_by_this_file():
    for port in (StructuredAIProvider, TranscriptionAssistanceProvider, TranscriptionProvider):
        assert set(operations(port)) <= set(ARGUMENTS), f"add arguments for new {port.__name__} operations"


def test_the_application_is_wired_to_the_guarded_adapters_only():
    assert type(get_ai_provider()) is AnthropicStructuredProvider
    assert type(get_transcription_assistance_provider()) is AnthropicTranscriptionAssistanceProvider
    assert type(get_transcription_provider()) is ElevenLabsTranscriptionProvider
