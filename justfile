# One entry point for every check. CI runs the same recipes.
# Requires: just, uv, Node 22+, pnpm, gitleaks.

set shell := ["bash", "-euo", "pipefail", "-c"]

py := "uv run --extra dev --frozen"

# List recipes
default:
    @just --list

# Everything that must pass before a pull request
check: secrets backend frontend infra

# --- secrets -----------------------------------------------------------------

# Scan every tracked file for credentials
secrets:
    scripts/guard/check-secrets.sh --all

# --- backend -----------------------------------------------------------------

backend: backend-lint backend-arch backend-test

# Install backend dependencies from the lockfile
backend-install:
    uv sync --project backend --extra dev --frozen

backend-lint:
    cd backend && {{py}} ruff check app tests scripts ../scripts

# Layer rules from docs/architecture/constraints.md
backend-arch:
    cd backend && {{py}} lint-imports

backend-test *args:
    cd backend && {{py}} pytest tests ../scripts/testing -p no:cacheprovider {{args}}

# Type check. Not part of `check` yet: the inherited code has a known backlog.
backend-types:
    cd backend && {{py}} pyright

# --- frontend ----------------------------------------------------------------

frontend: frontend-lint frontend-test frontend-build

frontend-install:
    cd frontend && pnpm install --frozen-lockfile

frontend-lint:
    cd frontend && pnpm lint

frontend-test:
    cd frontend && pnpm test --run

frontend-build:
    cd frontend && pnpm build

# Terraform format and validation; no credentials, no state (ADR-0010)
infra:
    cd infra && terraform fmt -check -recursive && terraform init -backend=false -input=false > /dev/null && terraform validate

# Offline Vercel build of one project as production builds it (backend: Linux only, CI runs both)
vercel-build project:
    scripts/vercel-build-check.sh {{project}}

# Mocked end-to-end tests (needs Chrome)
e2e:
    cd frontend && pnpm test:e2e:mock

# --- run locally -------------------------------------------------------------

# Regenerate frontend/src/locales/phrases.en.json from the Turkish catalogue
content-export:
    cd backend && {{py}} python ../scripts/export_phrases_en.py

# Apply migrations and seed the local SQLite database
db-seed:
    cd backend && {{py}} python -m app.db.cli seed

# Start the backend on :8000
dev-backend:
    cd backend && {{py}} uvicorn app.main:app --reload --port 8000

# Start the frontend on :5173
dev-frontend:
    cd frontend && pnpm dev
