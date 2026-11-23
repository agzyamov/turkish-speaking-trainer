# Allocation view: deployment

Shows where each component runs and what configuration it needs.

## Primary presentation

| Component | Runs on | Source | Configuration (names only; values live in the host, never in git) |
|---|---|---|---|
| Frontend web | Vercel project (static) | `frontend/` | `VITE_API_BASE_URL` (required: `vercel.json` has no API proxy, the browser calls the backend directly under CORS), `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_EMAIL_OTP_ENABLED`, `VITE_PUBLIC_APP_URL`, `VITE_SUPPORT_EMAIL` |
| Backend API | Vercel project (Python function, 60 s limit) | `backend/` | `APP_ENV`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CORS_ALLOWED_ORIGIN_REGEX`, `BRAND_NAME`, `PUBLIC_APP_URL`, `ADMIN_EMAILS`, `REVIEW_LOGIN_EMAIL` (optional), `TELEGRAM_*`, provider and budget settings below |
| Database | Supabase PostgreSQL (transaction pooler) | Alembic migrations in `backend/alembic` | managed by Supabase |
| Auth | Supabase Auth | Supabase dashboard | Google OAuth client, Apple Services ID and client secret (optional, ADR-0013), email sender |
| iOS app | App Store (not yet published); built and uploaded by hand from Xcode with the owner's Apple Developer account (ADR-0013) | `frontend/ios` | Bundle id `com.turktalk.trainer`; same native build settings as Android (`frontend/.env.android`); Sign in with Apple needs the Apple provider configured in Supabase |
| Android app | Google Play (not yet published for this product); uploads to testing tracks by the hand-started `android-release.yml` job in the `play` environment (ADR-0012) | `frontend/android` | Package `com.turktalk.trainer`; API and Supabase URLs and the support mailbox fixed at build time from `frontend/.env.android`; upload key and Google federation settings in the `play` environment and repository variables |

Provider and budget settings on the backend (Planned, Phase 2):

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | Claude key, backend only |
| `ANTHROPIC_GRADING_MODEL` | Model id for answer grading |
| `ANTHROPIC_UTILITY_MODEL` | Model id for hints, topics and phrase preparation |
| `ELEVENLABS_API_KEY` | Scribe key, backend only |
| `ELEVENLABS_STT_MODEL` | Speech-to-text model id |
| `AI_MONTHLY_BUDGET_USD` | The hard cap; default 25 |
| `AI_PRICE_TABLE` | JSON of per-model token prices and per-minute audio price |

## Element catalog

| Environment | Database | AI | Auth | Status |
|---|---|---|---|---|
| Local | SQLite file | fakes, or real keys from an untracked `.env` | Supabase or testlab fixture | Existing |
| Testlab | SQLite | fakes | local fixture | Existing |
| CI | SQLite | fakes only; no provider keys present | fixture | Planned (Phase 1) |
| Production | Supabase PostgreSQL | Claude and ElevenLabs | Supabase | Phase 5: the owner's own projects, set up; first deploy pending. |

## Context

All production infrastructure belongs to the product owner's accounts. Agents do not hold credentials for any of it; deployment is done or explicitly triggered by the owner (C-25).

## How configuration reaches the hosts

Everything in the tables above except the Supabase project itself is declared in Terraform (`infra/`, ADR-0010): both Vercel projects, their variables, the optional custom domain and Supabase Auth settings. Secrets are secrets of the GitHub `production` environment, passed as sensitive `TF_VAR_*`; AI models, prices and the budget are in `infra/settings.auto.tfvars`. State is in the same Supabase Postgres, schema `terraform_state` (`pg` backend, session pooler). The `production` job of `.github/workflows/deploy.yml` applies Terraform and deploys backend then frontend with the Vercel CLI, after CI passes on `main` and the owner approves the run. Vercel projects have no git connection.

## Variability guide

- Model ids, prices and the budget change in `infra/settings.auto.tfvars` with no application code change; the next approved deploy applies them.
- A second, independent limit should be set in each provider's own console (Anthropic workspace spend limit, ElevenLabs usage limit) as a backstop to the application cap.

## Rationale

Serverless hosting and a managed database were inherited and are kept: they suit a low-traffic product with a small fixed budget, and changing them would add risk without serving any stated quality. Database migrations run in the backend build step under an advisory lock so two builds cannot migrate at once.
