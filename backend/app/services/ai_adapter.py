from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.config import get_settings
from app.schemas import AnswerAnalysis, ExerciseGenerationResult, PhrasePreparation, TopicContext, WordHint
from app.schemas.attempts import ExplainedAnswerAnalysis
from app.schemas.topics import TopicTitleTranslation
from app.schemas.transcriptions import TranscriptionAssistanceAnalysis
from app.services.failure_diagnostics import DiagnosticFailure, diagnostic
from app.services.hint_alignment import aligned_word_hints
from app.services.turkish_text import validate_generated_target

PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"


class AIServiceError(DiagnosticFailure):
    """Provider/parse failure with safe structured diagnostics."""
    def __init__(self, message: str, failure=None):
        super().__init__(message, failure or diagnostic("external_model", "provider_request", "provider_failure"))


class StructuredAIProvider(Protocol):
    @property
    def is_available(self) -> bool: ...

    def translate_topic_title(self, text: str) -> TopicTitleTranslation: ...

    def normalize_topic(self, text: str) -> TopicContext: ...

    def generate_exercise(
        self,
        *,
        topic: TopicContext,
        target_skills: list[dict[str, str]],
        recent_sources: list[str],
        retry_reason: str | None = None,
    ) -> ExerciseGenerationResult: ...

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
    ) -> AnswerAnalysis: ...

    def prepare_phrase(self, *, source_ru: str, canonical_tr: str | None = None) -> PhrasePreparation: ...


@lru_cache
def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8").strip()


StructuredSchema = (
    type[TopicTitleTranslation] | type[TopicContext] | type[ExerciseGenerationResult] | type[AnswerAnalysis]
    | type[ExplainedAnswerAnalysis] | type[PhrasePreparation] | type[TranscriptionAssistanceAnalysis]
)


# The topic title task translates between Russian and English only; the Turkish standard does not apply.
TASKS_WITHOUT_TURKISH_OUTPUT = frozenset({"topic_title_translation_v1.md"})


def build_instructions(prompt_name: str) -> str:
    """The system prompt for one operation: the versioned prompt plus the shared language policy."""
    # Learner-facing language travels in the request as feedback_language, so the system prompt
    # stays identical across requests and is served from the prompt cache (ADR-0007).
    instructions = load_prompt(prompt_name)
    if prompt_name in TASKS_WITHOUT_TURKISH_OUTPUT:
        return instructions
    return instructions + "\n\n" + load_prompt("turkish_standard_v1.md")


def finalize_structured(result, payload: dict[str, object]):
    """Checks every adapter applies to validated model output before it reaches a service."""
    try:
        validate_generated_target(result)
    except ValueError as exc:
        raise AIServiceError("Generated Turkish violates the text policy", diagnostic("response_parse", "target_policy", "script_violation")) from exc
    if isinstance(result, (PhrasePreparation, ExerciseGenerationResult)):
        canonical = next(iter(result.intended_tr_variants), "")
        if payload.get("canonical_tr") and canonical != payload["canonical_tr"]:
            raise AIServiceError("Canonical answer changed during hint preparation", diagnostic("response_parse", "grounding", "canonical_changed"))
        source = str(payload.get("source_ru", getattr(result, "source_ru", "")))
        result.word_hints = [WordHint.model_validate(item) for item in aligned_word_hints(
            source, canonical, [hint.model_dump() for hint in result.word_hints])]
    return result


@lru_cache
def get_ai_provider() -> StructuredAIProvider:
    from app.services.anthropic_adapter import AnthropicStructuredProvider
    return AnthropicStructuredProvider(get_settings())
