# ADR-0008: Budget reason on custom content errors

- Status: Accepted
- Date: 2026-11-20
- Decided by: the product owner, on the agent's recommendation

## Context

When the AI budget is spent, the client shows a "practice paused" message (Q-7). It recognises the case from `detail.code` on speech-to-text routes and from `detail.failure.reason` on Claude routes.

Creating a custom topic calls Claude to translate the title. On any AI failure, `topic_service` raised `CustomContentError("topic_translation_unavailable")`, and its handler returned only `{"detail": {"code": ...}}`. The budget reason was lost, so a learner whose budget was spent saw "could not translate the topic title, try again", which invites pointless retries.

## Decision

The `CustomContentError` handler in `backend/app/main.py` adds the diagnostic of the AI failure that caused the error, when there is one:

```json
{"detail": {"code": "topic_translation_unavailable", "retryable": false,
            "failure": {"kind": "external_model", "stage": "budget", "reason": "budget_exhausted", "...": "..."}}}
```

- `code` is unchanged, so a released client keeps working.
- `failure` and `retryable` are added only when an AI failure caused the error; other custom content errors are unchanged.
- The failure is recorded like every other diagnostic and the response is `Cache-Control: no-store`.
- The frontend (`budgetPause.ts`) already reads `failure.reason`, so the paused message appears with no further client change.

## Alternatives considered

- **New codes such as `topic_budget_exhausted`:** clearer, but a released client would no longer recognise the error and would show a generic message.
- **Let the budget failure bypass `CustomContentError`:** reaches the generic `DiagnosticFailure` handler, which changes the code to `budget_exhausted` and breaks the same released clients.
- **Leave it:** learners would keep retrying a call that cannot succeed until the next day or month.

## Consequences

- Every AI-backed route the client uses now identifies a spent budget, either by `code` (speech-to-text) or by `failure.reason` (Claude).
- Adding a field is not a breaking change; removing it later would be.
- `backend/tests/test_ai_spend_api.py` pins the shape; `frontend/src/tests/budgetPause.test.ts` pins the client reading.
