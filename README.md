# TurkTalk

A speaking trainer for Turkish at A2 level. The learner sees a phrase in Russian or English, says it in Turkish, and gets a transcript, a grade and a concrete fix. Practice adapts to mistakes with spaced repetition. The interface is in Russian (default) and English, on the web and on Android.

AI spend is capped at **$25 per calendar month** across all users and both providers. When the budget runs out, practice pauses until the next month instead of spending more.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind v4, TanStack Query, i18next; Capacitor for Android (`frontend/`).
- **Backend:** FastAPI, SQLAlchemy 2, Alembic, Pydantic (`backend/`).
- **AI:** Claude for grading and hints, ElevenLabs Scribe for speech-to-text, both behind a budget guard and a usage ledger.
- **Hosting:** Vercel (two projects) and Supabase (Postgres and sign-in), managed with Terraform (`infra/`) and deployed by GitHub Actions after the owner's approval.

## Quick start

Requires [just](https://github.com/casey/just), [uv](https://docs.astral.sh/uv/), Node 22+, pnpm and gitleaks.

```bash
just backend-install frontend-install
cp .env.example .env      # placeholders only; local runs need no real keys
just db-seed              # migrations and the phrase catalogue into local SQLite
just dev-backend          # API on :8000
just dev-frontend         # app on :5173
```

To look at the interface without a backend or keys, `cd frontend && pnpm demo` opens a headed browser against a mocked API.

## Checks

```bash
just check      # secrets, backend (lint, layer rules, tests), frontend (lint, tests, build), Terraform validation
just e2e        # mocked browser tests (needs Chrome)
```

Tests never call a real AI provider.

## Deployment

Production runs only through the approved `production` job in `.github/workflows/deploy.yml`. One-time setup and the deploy flow are in [docs/infrastructure-setup.md](docs/infrastructure-setup.md); the release workflow is in [docs/release-process.md](docs/release-process.md).

## Documentation

- [docs/architecture/](docs/architecture/README.md): architecture views, interfaces, constraints and decisions. Binding for every change.
- [docs/architecture/roadmap.md](docs/architecture/roadmap.md): what is done and what is next.
- [AGENTS.md](AGENTS.md): rules for coding agents.
- [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md): product and design principles.
- [docs/manual-premium-payments.md](docs/manual-premium-payments.md), [docs/account-deletion-runbook.md](docs/account-deletion-runbook.md): operator procedures.
