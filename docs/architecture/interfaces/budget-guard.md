# Interface: budget guard

Status: Existing (`backend/app/services/budget_guard.py`, `ai_usage.py`). Tested with fake providers; not yet exercised against the live providers.

## Purpose

Guarantee that total AI spend in a calendar month never exceeds the configured budget, that no single user takes more than a daily share of it, and that an accurate record of spend exists.

## Resources

| Element | Description |
|---|---|
| `AI_MONTHLY_BUDGET_USD` | The cap across both providers. Default 25. Setting it to 0 stops every AI call. |
| `AI_FREE_USER_DAILY_BUDGET_USD`, `AI_PREMIUM_USER_DAILY_BUDGET_USD` | Per-user limit per UTC day. Defaults 1.0 and 3.0, sized so a learner reaches the daily phrase quota (20 free, 100 Premium) before this limit. Admins are exempt. |
| `AI_PRICE_TABLE` | JSON keyed by model id: `input_per_mtok`, `output_per_mtok`, `cache_write_per_mtok`, `cache_read_per_mtok` in USD per million tokens, and `audio_per_minute` in USD for speech-to-text models |
| `ANTHROPIC_GRADING_MAX_TOKENS`, `ANTHROPIC_UTILITY_MAX_TOKENS`, `AI_MAX_AUDIO_SECONDS` | The ceilings used for worst-case estimates |
| `ai_usage_events` table | One row per provider call: time, user id, purpose, provider, model, input/output/cache tokens, speech duration in ms (`stt_ms`), cost in micro-USD, and whether the cost was estimated |

## Operations

### `BudgetGuard.run(purpose, worst_case, call, measure, billed_on_error) -> result`

The only way an adapter reaches its provider.

1. Price `worst_case` (the most this call could consume). No price for the model: refuse.
2. Read month-to-date spend (UTC calendar month). If `spent + worst_case_cost > budget`, raise `BudgetExhaustedError`. The provider is not called.
3. If the request has a per-user daily limit and `user_spent_today + worst_case_cost` exceeds it, raise `UserBudgetExhaustedError`. The provider is not called.
4. Invoke `call`.
5. `measure(result)` returns the actual usage from the provider's response. Its cost is recorded as one ledger row. If the provider reported no usage, the worst case is recorded and marked estimated.
6. If `call` fails and `billed_on_error(exception)` is true (a timeout after the request was sent), the worst case is recorded and marked estimated. Other failures record nothing.

Worst-case estimates: for Claude, the system prompt's character count priced as a cache write, plus the payload's character count and a fixed overhead priced as input (a token is at least one character), plus the role's output ceiling. For speech-to-text, `AI_MAX_AUDIO_SECONDS`.

Retries are made by the adapter, not inside the provider SDK, so **each attempt** is a separate `run`: checked, and recorded if it may have been billed. A timed-out attempt followed by a successful retry produces two ledger rows.

### `BudgetGuard.status() -> {month_start, budget, spent, remaining}`

Served to admins at `GET /api/admin/usage`.

### Request context

`ai_usage_context` (a FastAPI dependency on every AI router) tells the guard which user is spending, that user's daily limit, and which database holds the ledger. Outside a request, the guard uses the process-wide database and applies only the monthly cap.

## Behaviour guarantees

- **No call without a check.** The guard is invoked inside each adapter, so constructing an adapter by any route does not bypass it. `backend/tests/test_architecture_budget.py` calls every port operation of every production adapter with the budget spent and asserts the provider client is never touched.
- **Bounded overshoot.** Concurrent requests may each pass the check before any records. Spend can exceed the cap by at most the worst-case cost of the calls in flight at that moment.
- **Spend is never under-counted.** Costs round up to the next micro-dollar; missing usage and possibly-billed failures are charged at the worst case.
- **Unknown price is a refusal.** A configured model with no price entry cannot be called.
- **Month and day rollover** need no job: spend is always computed for the current UTC month or day.
- The ledger write uses its own short transaction, so the cost is recorded even if the surrounding request later fails.

## How exhaustion reaches the client

Budget exhaustion travels through the existing failure channel, so every path that already handles "AI unavailable" handles it too (reservations are released, the daily phrase quota is not consumed, personal-topic exercises fall back to local templates).

| Situation | Where it appears |
|---|---|
| Monthly budget spent | `failure.reason = "budget_exhausted"`, `retryable = false`, HTTP 503 |
| User's daily share spent | `failure.reason = "user_daily_budget_exhausted"`, `retryable = false`, HTTP 503 |
| Speech-to-text | `detail.code = "transcription_budget_exhausted"` or `"transcription_daily_budget_exhausted"` |
| Model has no price | `failure.reason = "price_unknown"`; speech-to-text reports `transcription_not_configured` |

Clients branch on `detail.failure.reason` (or `detail.code` for speech-to-text). Exact-match grading needs no provider and keeps working.

## Alerts

When a recorded row takes month-to-date spend across 80% (configurable) and across 100% of the budget, the admin is notified through the existing Telegram notifier. Under concurrency a threshold can occasionally notify twice.

## Operating it

- To stop all AI spend immediately: set `AI_MONTHLY_BUDGET_USD=0` and redeploy.
- Set an independent spend limit in each provider's own console as a backstop.
- Prices must be kept current in `AI_PRICE_TABLE`. If a provider changes its price and the table is stale, recorded spend will be wrong by that difference.

## Rationale

See [ADR-0002](../decisions/ADR-0002-global-monthly-spend-cap.md).
