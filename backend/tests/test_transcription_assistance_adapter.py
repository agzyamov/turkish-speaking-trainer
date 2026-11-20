import json

import pytest

from app.schemas.transcriptions import TranscriptionAssistanceAnalysis
from app.services.ai_adapter import AIServiceError
from tests.providers import API_KEY, UTILITY_MODEL, claude_provider, provider_settings


def test_structured_text_analysis_uses_env_model_and_short_separate_budget():
    settings = provider_settings(anthropic_assistance_timeout_seconds=4, anthropic_assistance_max_retries=1,
                                 anthropic_timeout_seconds=30, anthropic_max_retries=3)
    provider, messages = claude_provider({"acceptable_variant": True, "candidates": []}, assistance=True, settings=settings)
    # The assistance budget is its own pair of settings, not the general Claude timeout and retries.
    assert (provider._timeout_seconds, provider._max_retries) == (4, 1)
    result = provider.analyze(source_ru="Задание", raw_text="Текст", canonical_tr="Эталон", intended_tr_variants=["Вариант"])
    assert isinstance(result, TranscriptionAssistanceAnalysis) and result.acceptable_variant
    [call] = messages.calls
    assert call["model"] == UTILITY_MODEL
    assert call["output_format"] is TranscriptionAssistanceAnalysis
    assert json.loads(messages.user_text()) == {"source_ru": "Задание", "raw_text": "Текст", "canonical_tr": "Эталон", "intended_tr_variants": ["Вариант"],
                                              "feedback_language": "ru"}
    assert "You do not have the audio" in messages.system_text()
    assert "Language standard" in messages.system_text()  # the shared Turkish policy follows the versioned prompt
    assert API_KEY not in json.dumps(call, default=str)


@pytest.mark.parametrize(("parsed", "stop_reason"), [
    (None, "end_turn"), ({"text": "free text"}, "end_turn"),
    ({"acceptable_variant": False, "candidates": [{"original": "bad"}]}, "end_turn"),
    (None, "refusal"), ({"acceptable_variant": True, "candidates": []}, "max_tokens"),
])
def test_invalid_structured_output_and_refusal_fail_safely(parsed, stop_reason):
    provider, _messages = claude_provider(parsed, assistance=True, stop_reason=stop_reason)
    with pytest.raises(AIServiceError):
        provider.analyze(source_ru="Задание", raw_text="Текст", canonical_tr=None, intended_tr_variants=[])


def test_timeout_and_sdk_errors_are_wrapped_without_user_text():
    provider, _messages = claude_provider(assistance=True, error=TimeoutError("private transcript"))
    with pytest.raises(AIServiceError, match="Claude request failed") as caught:
        provider.analyze(source_ru="Задание", raw_text="Текст", canonical_tr=None, intended_tr_variants=[])
    assert "private" not in str(caught.value)
    assert caught.value.failure.reason == "timeout" and "private" not in caught.value.failure.model_dump_json()
