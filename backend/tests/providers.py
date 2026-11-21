"""Production adapters wired to fake provider clients, for adapter-level tests.

No network and no real SDK client: the Claude adapter gets a recording stand-in
for ``client.messages`` and the ElevenLabs adapter an ``httpx.MockTransport``.
"""
from __future__ import annotations

from types import SimpleNamespace

import httpx

from app.config import Settings
from app.schemas.ai_usage import ModelPrice
from app.services.anthropic_adapter import AnthropicStructuredProvider, AnthropicTranscriptionAssistanceProvider
from app.services.elevenlabs_adapter import ElevenLabsTranscriptionProvider

GRADING_MODEL = "grading-from-env"
UTILITY_MODEL = "utility-from-env"
STT_MODEL = "stt-from-env"
API_KEY = "synthetic-key"
PRICES = {
    GRADING_MODEL: ModelPrice(input_per_mtok=2, output_per_mtok=10),
    UTILITY_MODEL: ModelPrice(input_per_mtok=0.1, output_per_mtok=0.5),
    STT_MODEL: ModelPrice(audio_per_minute=0.006),
}


def provider_settings(**overrides) -> Settings:
    values = dict(
        _env_file=None, anthropic_api_key=API_KEY, anthropic_grading_model=GRADING_MODEL, anthropic_utility_model=UTILITY_MODEL,
        elevenlabs_api_key=API_KEY, elevenlabs_stt_model=STT_MODEL, ai_price_table=PRICES, ai_monthly_budget_usd=25,
        anthropic_retry_backoff_seconds=0,
    )
    return Settings(**{**values, **overrides})


class FakeClaudeMessages:
    """Stands in for ``anthropic.Anthropic().messages``. Records each ``parse`` call's keyword arguments."""

    def __init__(self, parsed=None, *, stop_reason: str = "end_turn", error: Exception | None = None, results: list | None = None) -> None:
        self.calls: list[dict] = []
        self.parsed, self.stop_reason, self.error = parsed, stop_reason, error
        self.results = list(results) if results is not None else None  # one parsed result (or exception) per call

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        parsed = self.parsed
        if self.results is not None:
            parsed = self.results.pop(0)
            if isinstance(parsed, Exception):
                raise parsed
        usage = SimpleNamespace(input_tokens=100, output_tokens=20, cache_creation_input_tokens=0, cache_read_input_tokens=0)
        return SimpleNamespace(parsed_output=parsed, stop_reason=self.stop_reason, usage=usage, model=kwargs["model"])

    @property
    def last(self) -> dict:
        return self.calls[-1]

    def system_text(self, index: int = -1) -> str:
        return self.calls[index]["system"][0]["text"]

    def user_text(self, index: int = -1) -> str:
        return self.calls[index]["messages"][0]["content"]


def claude_provider(parsed=None, *, assistance: bool = False, settings: Settings | None = None, **fake) -> tuple[AnthropicStructuredProvider, FakeClaudeMessages]:
    messages = FakeClaudeMessages(parsed, **fake)
    cls = AnthropicTranscriptionAssistanceProvider if assistance else AnthropicStructuredProvider
    provider = cls(settings or provider_settings())
    provider._client = SimpleNamespace(messages=messages)
    return provider, messages


def elevenlabs_provider(handler=None, *, text: str = "Hesap açmak istiyorum.", settings: Settings | None = None) -> tuple[ElevenLabsTranscriptionProvider, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    def default(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"text": text, "language_code": "tr", "words": [{"text": text, "start": 0.0, "end": 1.5}]})

    def record(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return (handler or default)(request)

    return ElevenLabsTranscriptionProvider(settings or provider_settings(), transport=httpx.MockTransport(record)), requests
