from __future__ import annotations

from functools import lru_cache
from typing import Protocol

from app.config import get_settings
from app.schemas import TranscriptionResponse
from app.services.failure_diagnostics import DiagnosticFailure, diagnostic


class TranscriptionServiceError(DiagnosticFailure):
    """Safe application-level error for unavailable speech transcription."""

    def __init__(self, code: str = "transcription_unavailable", failure=None) -> None:
        self.code = code if code in {
            "transcription_unavailable", "transcription_not_configured", "transcription_timeout",
            "transcription_connection", "transcription_empty", "transcription_invalid_response",
            "transcription_unexpected_script", "transcription_audio_rejected",
            "transcription_provider_auth", "transcription_rate_limit", "transcription_provider_error",
            "transcription_budget_exhausted", "transcription_daily_budget_exhausted",
        } else "transcription_unavailable"
        if failure is None:
            reasons = {"transcription_timeout": "timeout", "transcription_connection": "connection",
                       "transcription_rate_limit": "rate_limit", "transcription_provider_auth": "authentication",
                       "transcription_not_configured": "not_configured"}
            if self.code in {"transcription_budget_exhausted", "transcription_daily_budget_exhausted"}:
                failure = diagnostic("external_model", "budget", "budget_exhausted" if self.code == "transcription_budget_exhausted"
                                     else "user_daily_budget_exhausted", retryable=False)
            elif self.code in {"transcription_empty", "transcription_invalid_response", "transcription_unexpected_script"}:
                failure = diagnostic("response_parse", "structured_output", "missing_output" if self.code == "transcription_empty" else "invalid_schema")
            else:
                failure = diagnostic("external_model", "configuration" if self.code == "transcription_not_configured" else "provider_request",
                                     reasons.get(self.code, "provider_failure"), retryable=self.code not in {"transcription_provider_auth", "transcription_not_configured"})
        super().__init__(self.code, failure)


class TranscriptionProvider(Protocol):
    @property
    def is_available(self) -> bool: ...

    def transcribe(self, *, audio: bytes, filename: str, content_type: str) -> TranscriptionResponse: ...

    def transcribe_feedback(self, *, audio: bytes, filename: str, content_type: str): ...

    def for_model(self, model: str) -> TranscriptionProvider:
        """The same provider using another configured model (the admin's diagnostic choice)."""
        ...


@lru_cache
def get_transcription_provider() -> TranscriptionProvider:
    from app.services.elevenlabs_adapter import ElevenLabsTranscriptionProvider
    return ElevenLabsTranscriptionProvider(get_settings())
