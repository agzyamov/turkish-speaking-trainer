# ADR-0007: Conventions for calling the Claude API

- Status: Accepted in principle; individual rows proposed by the agent and open to owner revision
- Date: 2026-11-20
- Decided by: the product owner asked that the Claude integration follow Anthropic's documentation and best practices. The rows below are the agent's application of that guidance; the owner has not reviewed each one

## Context

The backend moved from OpenAI to Claude (ADR-0001). Several choices in how each request is made affect quality, cost and the accuracy of the spend ledger. Writing them down keeps future changes consistent and lets reviewers check them.

## Decision

All Claude calls are made in `backend/app/services/anthropic_adapter.py` and follow these rules.

| Topic | Convention | Reason |
|---|---|---|
| SDK | The official `anthropic` Python SDK. No OpenAI-compatible shims, no raw HTTP | Typed errors, retries and structured-output parsing come from the SDK |
| Structured output | `client.messages.parse(..., output_format=<Pydantic schema>)`; the result is re-validated with the same schema before use | Output is guaranteed to match the schema; satisfies C-12 |
| Model per role | Grading uses `ANTHROPIC_GRADING_MODEL` (default Claude Sonnet 5.5); hints, topics, phrase preparation and transcript assistance use `ANTHROPIC_UTILITY_MODEL` (default Claude Haiku 5.5) | Grading needs judgement; the other tasks are short and high-volume. Exact model ids, never date-suffixed |
| Thinking | The `thinking` parameter is omitted; the current models then think adaptively | Disabling thinking is rejected by current models; effort is the supported control |
| Effort | Set explicitly per role through `output_config.effort`: grading `medium` (`ANTHROPIC_GRADING_EFFORT`), utility `low` (`ANTHROPIC_UTILITY_EFFORT`) | Defaults differ between models (Haiku 5.5 defaults to `medium`, Sonnet 5.5 to `high`); setting it explicitly makes cost predictable. Grading is the one judgement-sensitive task |
| `max_tokens` | Per role: grading 8000, utility 6000 (`ANTHROPIC_GRADING_MAX_TOKENS`, `ANTHROPIC_UTILITY_MAX_TOKENS`), non-streaming | Thinking counts toward output tokens, so a low ceiling truncates answers into failures. The ceiling is also the worst case the budget guard checks; a higher one would refuse calls sooner under the per-user daily limit |
| Prompt caching | The system prompt (versioned prompt file plus, for tasks that produce Turkish, the shared Turkish standard) is a single block marked `cache_control: ephemeral`; the per-request JSON, including `feedback_language`, goes in the user message after it | The system prompt is identical across requests, so repeated calls read it from cache. Nothing variable (dates, ids, interface language) is placed in the system prompt. The documented minimum cacheable prefix for these models is 512 tokens; check `cache_read_tokens` in the ledger to confirm caching works in production |
| Prompts | Versioned Markdown files in `backend/app/prompts`, written in English: the role and why the task matters first, then input description, rules with their reasons, short examples, and XML-tagged sections. Inputs are declared as data, not instructions | Follows Anthropic's prompting guidance; English keeps prompts maintainable while learner-facing text follows `feedback_language` |
| Stop reasons | `refusal` and `max_tokens` are checked before the parsed output is read and become safe failures | A refusal returns HTTP 200; reading content first would treat it as a result |
| Refusal fallback | Server-side `fallbacks` is **not** enabled | For Claude Sonnet 5.5 it retries only `cyber` and `frontier_llm` declines, which this product does not produce; Claude Haiku 5.5 has no server-side fallback. With fallback on, top-level `usage` covers only the final attempt and the ledger would under-count unless every `usage.iterations` entry were priced. Revisit if refusals appear in the failure logs |
| Timeouts and retries | The SDK makes no retries of its own (`max_retries=0`); the adapter retries timeouts, connection errors, 429 and 5xx up to `ANTHROPIC_MAX_RETRIES` (2), each attempt through the budget guard, with exponential backoff, within a per-call deadline of `ANTHROPIC_CALL_DEADLINE_SECONDS` (25 s). Transcript assistance: 6 s, no retry | Every possibly-billed attempt is recorded (ADR-0002). Grading can make two logical calls (the server re-asks once when the output contradicts the transcript), so the 25 s deadline keeps a request within the 60 s function limit (C-13) |
| Errors | Classified by SDK exception type into the existing failure taxonomy; provider bodies never reach clients or logs | C-29 |
| Cost | Every call goes through the budget guard; cost is computed from `usage` including cache writes and reads | ADR-0002 |

## Alternatives considered

- Tool use with a forced tool for structured output: forced `tool_choice` is rejected by current models, and structured outputs are the documented replacement.
- Streaming responses: not needed for short structured outputs within 16000 tokens; would add complexity to cost measurement.
- One model for every task: see ADR-0001.
- Prompts in Russian, as inherited: workable, but English prompts are easier to review and match the rest of the documentation.

## Consequences

- A change to any row above is an architecture change and follows the escalation procedure.
- Effort and model choices are configuration. The Phase 3 grading evaluation decides whether grading stays on Sonnet 5.5 at `medium`.
- Prompt changes create new version files (C-16); old versions are deleted once nothing loads them.
