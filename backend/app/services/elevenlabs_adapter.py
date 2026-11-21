"""ElevenLabs Scribe adapter for the transcription port.

The only module that talks to ElevenLabs (constraint C-04). Every request goes
through the budget guard (C-09). Audio is held in memory for the call and never
stored or logged (C-06).
"""
from __future__ import annotations

from hashlib import sha256

import httpx

from app.config import Settings
from app.request_metrics import measure_ai_call
from app.schemas import TranscriptionResponse
from app.services.ai_usage import PriceUnknownError, Usage
from app.services.budget_guard import BudgetExhaustedError, BudgetGuard, UserBudgetExhaustedError
from app.services.model_debug import capture_model_call
from app.services.transcription_adapter import TranscriptionServiceError

PROVIDER = "elevenlabs"
STATUS_CODES = {
    400: "transcription_audio_rejected", 413: "transcription_audio_rejected", 422: "transcription_audio_rejected",
    401: "transcription_provider_auth", 403: "transcription_provider_auth",
    429: "transcription_rate_limit",
}


class _RetryableStatus(Exception):
    def __init__(self, status_code: int) -> None:
        super().__init__(status_code)
        self.status_code = status_code


def measured_usage(model: str):
    """Billing is by audio length; the end of the last recognised word is the measured length."""
    def measure(body: dict) -> Usage | None:
        ends = [word.get("end") for word in body.get("words") or [] if isinstance(word, dict)]
        ends = [end for end in ends if isinstance(end, (int, float))]
        if not ends:
            return None  # the guard then charges the worst case
        return Usage(provider=PROVIDER, model=model, stt_ms=int(max(ends) * 1000) + 1)
    return measure


class ElevenLabsTranscriptionProvider:
    def __init__(self, settings: Settings, *, transport: httpx.BaseTransport | None = None) -> None:
        self.settings = settings
        self._transport = transport
        self._client: httpx.Client | None = None

    @property
    def is_available(self) -> bool:
        return bool(self.settings.elevenlabs_api_key and self.settings.elevenlabs_stt_model)

    @property
    def client(self) -> httpx.Client:
        if not self.is_available:
            raise TranscriptionServiceError("transcription_not_configured")
        if self._client is None:
            self._client = httpx.Client(
                base_url=self.settings.elevenlabs_base_url,
                timeout=self.settings.elevenlabs_timeout_seconds,
                headers={"xi-api-key": self.settings.elevenlabs_api_key or ""},
                transport=self._transport,
            )
        return self._client

    def for_model(self, model: str) -> ElevenLabsTranscriptionProvider:
        scoped = ElevenLabsTranscriptionProvider(self.settings.model_copy(update={"elevenlabs_stt_model": model}), transport=self._transport)
        if self.is_available:
            scoped._client = self.client  # one shared connection pool; only the model differs
        return scoped

    def transcribe(self, *, audio: bytes, filename: str, content_type: str) -> TranscriptionResponse:
        return TranscriptionResponse(text=self._transcribe("speech_to_text", audio, filename, content_type, self.settings.target_language_code))

    def transcribe_feedback(self, *, audio: bytes, filename: str, content_type: str):
        from app.schemas.feedback import FeedbackTranscript
        # Feedback may be spoken in any language, so the language is left for the provider to detect.
        return FeedbackTranscript(text=self._transcribe("speech_to_text.feedback", audio, filename, content_type, None))

    def _post(self, client: httpx.Client, model: str, audio: bytes, filename: str, content_type: str, language: str | None) -> dict:
        """One HTTP attempt. Retries happen in ``_transcribe`` so each attempt is budget-checked and recorded."""
        data = {"model_id": model, "tag_audio_events": "false"}
        if language:
            data["language_code"] = language
        response = client.post("/v1/speech-to-text", data=data, files={"file": (filename, audio, content_type)})
        if response.status_code >= 400:
            raise _RetryableStatus(response.status_code)
        body = response.json()
        if not isinstance(body, dict):
            raise TranscriptionServiceError("transcription_invalid_response")
        return body

    def _transcribe(self, operation: str, audio: bytes, filename: str, content_type: str, language: str | None) -> str:
        try:
            client = self.client
            model = self.settings.elevenlabs_stt_model or ""
            worst_case = Usage(provider=PROVIDER, model=model, stt_ms=int(self.settings.ai_max_audio_seconds * 1000))
            with capture_model_call(operation, model, {
                "model_id": model, "language_code": language, "content_type": content_type,
                "audio_bytes": len(audio), "audio_sha256": sha256(audio).hexdigest(),
            }, self.settings.elevenlabs_api_key) as debug, measure_ai_call():
                # Kept only for the debug admin with debugging on (the C-06 exception); a no-op otherwise.
                debug.attach_audio(audio, content_type)
                guard = BudgetGuard(self.settings)
                attempts = self.settings.elevenlabs_max_retries + 1
                for attempt in range(attempts):
                    try:
                        body = guard.run(
                            purpose=operation,
                            worst_case=worst_case,
                            call=lambda: self._post(client, model, audio, filename, content_type, language),
                            measure=measured_usage(model),
                            billed_on_error=lambda exc: isinstance(exc, httpx.TimeoutException),
                        )
                        break
                    except (httpx.TransportError, _RetryableStatus) as exc:
                        transient = isinstance(exc, httpx.TransportError) or exc.status_code >= 500
                        if not transient or attempt == attempts - 1:
                            raise
                debug.received({"text": body.get("text"), "language_code": body.get("language_code"),
                                "language_probability": body.get("language_probability")})
            text = body.get("text")
            if not isinstance(text, str):
                raise TranscriptionServiceError("transcription_invalid_response")
            if not text.strip():
                raise TranscriptionServiceError("transcription_empty")
            return text.strip()
        except TranscriptionServiceError:
            raise
        except UserBudgetExhaustedError as exc:
            raise TranscriptionServiceError("transcription_daily_budget_exhausted") from exc
        except BudgetExhaustedError as exc:
            raise TranscriptionServiceError("transcription_budget_exhausted") from exc
        except PriceUnknownError as exc:
            raise TranscriptionServiceError("transcription_not_configured") from exc
        except httpx.TimeoutException as exc:
            raise TranscriptionServiceError("transcription_timeout") from exc
        except httpx.TransportError as exc:
            raise TranscriptionServiceError("transcription_connection") from exc
        except _RetryableStatus as exc:
            raise TranscriptionServiceError(STATUS_CODES.get(exc.status_code, "transcription_provider_error")) from exc
        except (ValueError, TypeError, AttributeError) as exc:
            raise TranscriptionServiceError("transcription_invalid_response") from exc
        except Exception as exc:
            raise TranscriptionServiceError() from exc
