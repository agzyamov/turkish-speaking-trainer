# ADR-0001: Claude for language tasks, ElevenLabs Scribe for speech-to-text

- Status: Accepted
- Date: 2026-11-20
- Decided by: product owner

## Context
The inherited app used OpenAI for everything. The owner wants to spend Anthropic Claude API credits. Claude does not transcribe audio, so spoken answers need a second provider.

## Decision
- Claude handles grading, hints, phrase preparation and topic handling, through the official `anthropic` SDK with structured outputs.
- Two model roles, both set by environment variable: a grading model (default Claude Sonnet 5.5) and a utility model (default Claude Haiku 5.5).
- ElevenLabs Scribe handles speech-to-text with language `tr`.
- Both sit behind the existing provider ports.

## Alternatives considered
- Keep OpenAI: no new code, but does not use the owner's credits.
- OpenAI or Deepgram for speech-to-text: Scribe had the lowest Turkish error rate found (3.1% on FLEURS). That figure is the vendor's own; no independent Turkish benchmark was found.
- Typed answers only: removes the product's main purpose.
- One Claude model for everything: Opus for all tasks roughly halves how many answers fit in the budget; Haiku for grading risks weaker grammar feedback.

## Consequences
- Two provider accounts and two keys to manage.
- The grading model choice is provisional until the Phase 3 eval on Turkish answers; changing it is a configuration change.
- Scribe's accuracy on learner Turkish must be verified in Phase 3. The port makes a swap cheap if it falls short.
