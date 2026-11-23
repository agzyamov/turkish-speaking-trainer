# Interface: REST API

The contract between the client and the backend. All paths are under `/api`. Every route except `/health` and `/auth/review-login` requires `Authorization: Bearer <Supabase access token>`.

FastAPI generates the exact request and response schemas from `backend/app/schemas`; that generated OpenAPI document is the detailed reference. This page records what exists and the rules every route follows.

## Common rules

- Request headers: `X-Interface-Language: ru|en` selects the language of feedback text; `X-Request-ID` is echoed in diagnostics.
- Errors carry a stable machine-readable code. Clients branch on the code, never on message text.
- Routes marked **AI** can cause a provider call. Each such call goes through the budget guard, which enforces the monthly cap and the per-user daily spend limit.

| Status | Code | Meaning |
|---|---|---|
| 429 | daily limit reached | The user's daily quota is used up |
| 503 | `failure.reason = budget_exhausted` | The monthly AI budget is spent |
| 503 | `failure.reason = user_daily_budget_exhausted` | This user has used their daily share of the AI budget |
| 503 | `code = transcription_budget_exhausted`, `transcription_daily_budget_exhausted` | The same two cases on speech-to-text |
| 503 | `code = topic_translation_unavailable` with `failure.reason` | Custom topic creation failed because of an AI failure; a spent budget shows as the reasons above (ADR-0008) |
| 502/503 | provider failure codes | The provider failed or is not configured |

## Routes

| Method and path | Purpose | AI |
|---|---|---|
| GET `/health` | Liveness | |
| POST `/auth/review-login` | Password sign-in for the store review account | |
| GET `/auth/me` | Profile, role, tier, daily usage | |
| POST `/auth/me/android-premium` | Grants the native-app Premium tier; body `platform` is `android` or `ios` (ADR-0013) | |
| GET, PATCH `/auth/me/preferences` | Soft-hint preference | |
| GET `/admin/users` | Admin: users and their usage | |
| GET `/admin/usage` | Admin: month-to-date AI spend and remaining budget | |
| GET `/topics` | Preset and personal topics | |
| POST `/topics` | Create a personal topic | AI |
| DELETE `/topics/{id}` | Delete a personal topic | |
| POST `/topics/normalize` | Normalise a free-text topic | AI |
| POST `/sessions`, POST `/sessions/start` | Create a session; start returns the first exercise | AI for personal topics |
| GET `/sessions/{id}` | Session state | |
| POST `/sessions/{id}/next-exercise` | Next exercise | AI for personal topics |
| POST `/transcriptions` | Audio to text, optional soft hints | AI |
| POST `/attempts` | Grade an answer; idempotent by client request id | AI unless exact match |
| GET `/custom-phrases`, DELETE `/custom-phrases/{id}` | Personal phrases | |
| GET `/review-phrases`, GET `/review-phrases/summary`, POST `/review-phrases` | Review cards | |
| POST `/review-phrases/prepare` | Canonical Turkish and hints for a personal phrase | AI |
| POST `/exercises/{id}/word-hints` | Reveal a word hint | |
| GET `/learning-words` | Words opened through hints | |
| GET `/statistics/monthly`, `/statistics/phrases`, `/statistics/phrase-topics` | Statistics | |
| POST `/feedback` | Send feedback | |
| POST `/feedback/transcribe` | Voice feedback to text | AI |
| GET `/payments/options`, GET/POST `/payments`, POST `/payments/{id}/report`, POST `/payments/{id}/cancel` | Manual Premium payments | |
| GET `/admin/payments`, PATCH `/admin/payments/{id}` | Admin payment review | |
| `/admin/model-debug*` | Debug-admin diagnostics | |

## Planned contract changes

| Change | Phase |
|---|---|
| Field names ending `_sr` become `_tr` (`canonical_sr`, `transcript_sr`, `translation_sr`, `intended_sr_variants`, `corrected_sr`) | 3 |
| The `alphabet` form field on `/transcriptions` is removed | 3 |
| Payment country value becomes `turkey` | Done (Phase 5, migration `c93e0f1a2b47`) |
| `budget_exhausted` failure reasons and `/admin/usage` were added | 2 (done) |
| `failure` and `retryable` added to custom content errors caused by an AI failure; `code` unchanged (ADR-0008) | 4 (done) |

No client of this product has been released, so these renames need no compatibility period. After the first public release, any change a released client would notice is an escalation case.
