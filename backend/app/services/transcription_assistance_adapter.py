"""Text-only post-STT analysis using the configured text model and a short budget."""
from functools import lru_cache
from typing import Protocol

from app.config import get_settings
from app.schemas.transcriptions import TranscriptionAssistanceAnalysis


class TranscriptionAssistanceProvider(Protocol):
    @property
    def is_available(self) -> bool: ...

    def analyze(self, *, source_ru: str, raw_text: str, canonical_tr: str | None,
                intended_tr_variants: list[str]) -> TranscriptionAssistanceAnalysis: ...


@lru_cache
def get_transcription_assistance_provider() -> TranscriptionAssistanceProvider:
    from app.services.anthropic_adapter import AnthropicTranscriptionAssistanceProvider
    return AnthropicTranscriptionAssistanceProvider(get_settings())
