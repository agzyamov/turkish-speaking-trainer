"""Claude adapter for the structured AI port.

The only module that imports the Anthropic SDK (constraint C-04). Every request
goes through the budget guard (C-09); model ids come from settings (C-11).
"""
from __future__ import annotations

import json
import time
from collections.abc import Callable
from typing import Literal

import anthropic

from app.config import Settings
from app.request_metrics import measure_ai_call
from app.schemas import AnswerAnalysis, ExerciseGenerationResult, PhrasePreparation, TopicContext
from app.schemas.attempts import ExplainedAnswerAnalysis
from app.schemas.topics import TopicTitleTranslation
from app.schemas.transcriptions import TranscriptionAssistanceAnalysis
from app.services.ai_adapter import AIServiceError, StructuredSchema, build_instructions, finalize_structured
from app.services.ai_usage import PriceUnknownError, Usage
from app.services.budget_guard import BudgetExhaustedError, BudgetGuard, UserBudgetExhaustedError
from app.services.failure_diagnostics import classify_provider_error, diagnostic, is_provider_timeout
from app.services.interface_language import interface_language
from app.services.model_debug import capture_model_call

PROVIDER = "anthropic"
ModelRole = Literal["grading", "utility"]
# Room the request needs beyond its visible text: the output schema and message framing.
REQUEST_OVERHEAD_TOKENS = 1500


def measured_usage(response) -> Usage | None:
    usage = getattr(response, "usage", None)
    model = getattr(response, "model", None)
    if usage is None or not model:
        return None
    return Usage(
        provider=PROVIDER,
        model=model,
        input_tokens=int(getattr(usage, "input_tokens", 0) or 0),
        output_tokens=int(getattr(usage, "output_tokens", 0) or 0),
        cache_write_tokens=int(getattr(usage, "cache_creation_input_tokens", 0) or 0),
        cache_read_tokens=int(getattr(usage, "cache_read_input_tokens", 0) or 0),
    )


def is_retryable(exc: BaseException) -> bool:
    """Transient failures worth another attempt: timeouts, lost connections, rate limits and server errors."""
    if is_provider_timeout(exc) or isinstance(exc, anthropic.APIConnectionError):
        return True
    return isinstance(exc, anthropic.APIStatusError) and (exc.status_code == 429 or exc.status_code >= 500)


class AnthropicStructuredProvider:
    def __init__(self, settings: Settings, *, timeout_seconds: float | None = None, max_retries: int | None = None,
                 deadline_seconds: float | None = None, sleep: Callable[[float], None] = time.sleep) -> None:
        self.settings = settings
        self._timeout_seconds = settings.anthropic_timeout_seconds if timeout_seconds is None else timeout_seconds
        self._max_retries = settings.anthropic_max_retries if max_retries is None else max_retries
        self._deadline_seconds = settings.anthropic_call_deadline_seconds if deadline_seconds is None else deadline_seconds
        self._sleep = sleep
        self._client: anthropic.Anthropic | None = None

    @property
    def is_available(self) -> bool:
        return bool(self.settings.anthropic_api_key and self.settings.anthropic_grading_model and self.settings.anthropic_utility_model)

    @property
    def client(self) -> anthropic.Anthropic:
        if not self.is_available:
            raise AIServiceError("Claude is not configured", diagnostic("external_model", "configuration", "not_configured", retryable=False))
        if self._client is None:
            # Retries are made here, outside the SDK, so each attempt passes the budget guard and is recorded.
            self._client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key, timeout=self._timeout_seconds, max_retries=0)
        return self._client

    def _model(self, role: ModelRole) -> str:
        model = self.settings.anthropic_grading_model if role == "grading" else self.settings.anthropic_utility_model
        return model or ""

    def translate_topic_title(self, text: str) -> TopicTitleTranslation:
        return self._parse(
            prompt_name="topic_title_translation_v1.md", role="utility", schema=TopicTitleTranslation,
            payload={"title": text, "interface_language": interface_language.get()},
        )

    def normalize_topic(self, text: str) -> TopicContext:
        return self._parse(
            prompt_name="topic_normalizer_v2.md", role="utility", schema=TopicContext,
            payload={"user_topic_ru": text, "target_level": "A2"},
        )

    def generate_exercise(
        self,
        *,
        topic: TopicContext,
        target_skills: list[dict[str, str]],
        recent_sources: list[str],
        retry_reason: str | None = None,
    ) -> ExerciseGenerationResult:
        return self._parse(
            prompt_name="exercise_generator_v3.md", role="utility", schema=ExerciseGenerationResult,
            payload={
                "topic": topic.model_dump(),
                "target_skills": target_skills,
                "recent_source_ru": recent_sources,
                "retry_reason": retry_reason,
            },
        )

    def analyze_answer(
        self,
        *,
        source_ru: str,
        transcript_tr: str,
        canonical_tr: str | None,
        intended_tr_variants: list[str],
        target_skills: list[dict[str, str]],
        timings: dict[str, object],
        validation_feedback: str | None = None,
    ) -> AnswerAnalysis:
        return self._parse(
            prompt_name="answer_analyzer_v7.md", role="grading", schema=ExplainedAnswerAnalysis,
            payload={
                "source_text": source_ru,
                "feedback_language": interface_language.get(),
                "previous_validation_failure": validation_feedback,
                "transcript_tr": transcript_tr,
                "canonical_tr": canonical_tr,
                "intended_tr_variants": intended_tr_variants,
                "target_skills": target_skills,
                "timings": timings,
                "target_level": "A2",
            },
        )

    def prepare_phrase(self, *, source_ru: str, canonical_tr: str | None = None) -> PhrasePreparation:
        from app.schemas.exercises import BilingualPhrasePreparation
        return self._parse(
            prompt_name="phrase_preparation_v5.md", role="utility", schema=BilingualPhrasePreparation,
            payload={"source_ru": source_ru, "canonical_tr": canonical_tr, "target_level": "A2"},
        )

    def _parse(self, *, prompt_name: str, role: ModelRole, payload: dict[str, object], schema: StructuredSchema):
        try:
            client = self.client
            model = self._model(role)
            instructions = build_instructions(prompt_name)
            input_json = json.dumps(payload, ensure_ascii=False)
            grading = role == "grading"
            max_tokens = self.settings.anthropic_grading_max_tokens if grading else self.settings.anthropic_utility_max_tokens
            effort = self.settings.anthropic_grading_effort if grading else self.settings.anthropic_utility_effort
            # A token is at least one character, so character counts bound the input from above. The system
            # prompt is priced as a cache write, the dearest way it can be billed.
            worst_case = Usage(provider=PROVIDER, model=model, output_tokens=max_tokens, cache_write_tokens=len(instructions),
                               input_tokens=len(input_json) + REQUEST_OVERHEAD_TOKENS)
            with capture_model_call(prompt_name, model, {
                "model": model, "system": instructions, "input": input_json,
                "output_format": schema.model_json_schema(), "max_tokens": max_tokens,
            }, self.settings.anthropic_api_key) as debug, measure_ai_call():
                request = dict(
                    model=model,
                    max_tokens=max_tokens,
                    # The prompt is identical across requests, so it is cached; the payload varies and follows it.
                    system=[{"type": "text", "text": instructions, "cache_control": {"type": "ephemeral"}}],
                    messages=[{"role": "user", "content": input_json}],
                    output_format=schema,
                    output_config={"effort": effort},
                )
                response = self._guarded_with_retries(client, request, prompt_name, worst_case)
                debug.received(response)
            stop_reason = getattr(response, "stop_reason", None)
            if stop_reason == "refusal":
                raise AIServiceError("Model declined the request", diagnostic("external_model", "provider_request", "model_refusal", retryable=False))
            if stop_reason == "max_tokens":
                raise AIServiceError("Model output incomplete", diagnostic("response_parse", "structured_output", "incomplete_output"))
            parsed = getattr(response, "parsed_output", None)
            if parsed is None:
                raise AIServiceError("Claude returned no structured output", diagnostic("response_parse", "structured_output", "missing_output"))
            result = schema.model_validate(parsed.model_dump() if hasattr(parsed, "model_dump") else parsed)
            return finalize_structured(result, payload)
        except AIServiceError:
            raise
        except UserBudgetExhaustedError as exc:
            raise AIServiceError("Daily AI allowance is used up", diagnostic("external_model", "budget", "user_daily_budget_exhausted", retryable=False)) from exc
        except BudgetExhaustedError as exc:
            raise AIServiceError("Monthly AI budget is spent", diagnostic("external_model", "budget", "budget_exhausted", retryable=False)) from exc
        except PriceUnknownError as exc:
            raise AIServiceError("No price is configured for the model", diagnostic("external_model", "configuration", "price_unknown", retryable=False)) from exc
        except Exception as exc:
            raise AIServiceError("Claude request failed", classify_provider_error(exc)) from exc


    def _guarded_with_retries(self, client: anthropic.Anthropic, request: dict, purpose: str, worst_case: Usage):
        """One logical call: each attempt is budget-checked and recorded; all attempts fit within the deadline."""
        guard = BudgetGuard(self.settings)
        deadline = time.monotonic() + self._deadline_seconds
        attempt = 0
        while True:
            timeout = min(self._timeout_seconds, deadline - time.monotonic())
            try:
                return guard.run(
                    purpose=purpose,
                    worst_case=worst_case,
                    call=lambda timeout=timeout: client.messages.parse(**request, timeout=timeout),
                    measure=measured_usage,
                    billed_on_error=is_provider_timeout,
                )
            except Exception as exc:
                attempt += 1
                backoff = self.settings.anthropic_retry_backoff_seconds * 2 ** (attempt - 1)
                # Give up when out of attempts, or when too little time is left for a useful attempt.
                if not is_retryable(exc) or attempt > self._max_retries or deadline - time.monotonic() - backoff < 3:
                    raise
                self._sleep(backoff)


class AnthropicTranscriptionAssistanceProvider(AnthropicStructuredProvider):
    """Soft hints on a transcript: same model access, a much shorter time budget."""

    def __init__(self, settings: Settings) -> None:
        timeout = settings.anthropic_assistance_timeout_seconds
        retries = settings.anthropic_assistance_max_retries
        super().__init__(settings, timeout_seconds=timeout, max_retries=retries, deadline_seconds=timeout * (retries + 1) + 1)

    def analyze(self, *, source_ru: str, raw_text: str, canonical_tr: str | None,
                intended_tr_variants: list[str]) -> TranscriptionAssistanceAnalysis:
        return self._parse(
            prompt_name="transcription_assistance_v4.md", role="utility", schema=TranscriptionAssistanceAnalysis,
            payload={"source_ru": source_ru, "raw_text": raw_text, "canonical_tr": canonical_tr,
                     "intended_tr_variants": intended_tr_variants, "feedback_language": interface_language.get()},
        )
