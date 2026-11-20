# Glossary

| Term | Meaning |
|---|---|
| Adapter | A module that implements a provider port for one specific provider, for example the Claude adapter |
| ADR | Architecture decision record: one decision, its context and its consequences |
| Attempt | One graded answer to one exercise |
| Budget guard | The backend service every AI call passes through; it refuses calls that would exceed the monthly budget and records what each call cost |
| Canonical answer | The stored reference Turkish translation of a phrase |
| Exact match | An answer that equals an accepted variant after normalisation; graded without an AI call |
| Exercise | One phrase shown to the learner in a session, with a snapshot of its hints |
| Learner model | Per-user, per-skill mastery state used by the scheduler |
| Port | A Python `Protocol` describing what the backend needs from a kind of provider, independent of who supplies it |
| Preset topic | A built-in topic with a fixed phrase list |
| Review phrase | A phrase on a learner's spaced-repetition schedule |
| Skill | An entry in the controlled catalogue of vocabulary, grammar and construction items a phrase exercises |
| Soft hints | Optional AI assistance that suggests corrections to a transcript before grading |
| Source language | The language the phrase is shown in: Russian or English |
| Target language | The language the learner answers in: Turkish |
| Testlab | A local test environment with fake auth and fake AI |
| Usage ledger | The `ai_usage_events` table: one row per AI call with its measured usage and cost |
| Word hint | The Turkish fragment for one word of the source phrase, revealed on tap at a score penalty |
