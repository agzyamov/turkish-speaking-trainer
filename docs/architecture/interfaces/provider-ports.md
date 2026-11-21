# Interface: provider ports

The contracts through which the backend uses AI providers. Ports are Python `Protocol` classes in `backend/app/services`. Domain services depend on these, never on an adapter (C-04).

## Ports

### Structured AI (`StructuredAIProvider`, `ai_adapter.py`)

Status: Existing. Parameter names change from `_sr` to `_tr` in Phase 3.

| Operation | Returns (Pydantic schema) | Used for |
|---|---|---|
| `translate_topic_title(text)` | `TopicTitleTranslation` | Title of a personal topic in both interface languages |
| `normalize_topic(text)` | `TopicContext` | Turning a free-text topic into intents and vocabulary |
| `generate_exercise(topic, target_skills, recent_sources, retry_reason)` | `ExerciseGenerationResult` | Exercises for personal topics |
| `analyze_answer(source, transcript, canonical, variants, target_skills, timings, validation_feedback)` | `AnswerAnalysis` | Grading |
| `prepare_phrase(source, canonical)` | `PhrasePreparation` | Canonical Turkish and word hints for a personal phrase |
| `is_available` | `bool` | Whether the adapter is configured |

### Transcription (`TranscriptionProvider`, `transcription_adapter.py`)

Status: Existing.

| Operation | Returns | Used for |
|---|---|---|
| `transcribe(audio, filename, content_type)` | `TranscriptionResponse` | Spoken answers |
| `transcribe_feedback(audio, filename, content_type)` | `FeedbackTranscript` | Spoken feedback; the language is detected, not fixed |
| `for_model(model)` | the same provider on another configured model | The debug admin's diagnostic model choice; makes no call |
| `is_available` | `bool` | |

### Transcription assistance (`TranscriptionAssistanceProvider`)

Status: Existing.

| Operation | Returns | Used for |
|---|---|---|
| `analyze(source, raw_text, canonical, variants)` | `TranscriptionAssistanceAnalysis` | Soft hints on a transcript |

## Adapters

| Port | Adapter | Notes |
|---|---|---|
| Structured AI, Transcription assistance | `anthropic_adapter.py`: Claude through the official `anthropic` SDK, structured outputs parsed into the schema, system prompt cached | Grading uses `ANTHROPIC_GRADING_MODEL`; everything else uses `ANTHROPIC_UTILITY_MODEL` |
| Transcription | `elevenlabs_adapter.py`: ElevenLabs Scribe over HTTPS with language `TARGET_LANGUAGE_CODE` (`tr`) | Spoken feedback omits the language so the provider detects it |

The OpenAI adapters were removed on 2026-11-20.

## Requirements on every adapter

- Returns only schema-validated data, or raises the port's error type with a safe diagnostic. Never returns raw model text for program use.
- Applies a timeout and a bounded retry count from configuration.
- Takes its model id from configuration.
- Reports usage (token counts including cache reads and writes, or audio duration) so the budget guard can compute cost.
- Can estimate the worst-case cost of a request before sending it.
- Handles a model refusal or truncated output as an error, not as a result.
- Does not log request or response content outside the debug-admin diagnostics.

## Adding or replacing a provider

A new adapter for an existing port, chosen by the owner, is routine once the decision is recorded. A new provider, a new port or a new model role is an escalation case (C-23).

## Rationale

See [ADR-0001](../decisions/ADR-0001-claude-and-elevenlabs.md).
