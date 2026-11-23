# Allocation view: implementation

Shows where modules live in the repository and how they are built and checked.

## Primary presentation

```text
.
├── AGENTS.md, CLAUDE.md        rules for coding agents
├── .claude/settings.json       agent permissions (sandbox off, ADR-0006)
├── .claude/agents/             Claude Code subagents: backend, frontend, qa, reviewer, docs
├── .githooks/, .gitleaks.toml  secret scanning before every commit
├── justfile                    one entry point for every check
├── .github/workflows/ci.yml    continuous integration
├── .github/workflows/e2e-browsers.yml  Mocked e2e in all browser projects, nightly and on demand
├── .github/workflows/app-e2e.yml  Maestro flows on the iOS simulator app, nightly and on demand (ADR-0014)
├── .github/workflows/deploy.yml  Terraform plan/apply and production deploy after owner approval (ADR-0010)
├── .github/workflows/android-release.yml  Hand-started Android release to a Play testing track (ADR-0012)
├── infra/                      Terraform: Vercel projects and variables, Supabase Auth settings
├── backend/
│   ├── app/                    api, services, repositories, models, db, schemas, prompts
│   ├── alembic/                migrations
│   ├── tests/                  pytest; fakes.py holds the fake providers
│   └── pyproject.toml
├── frontend/
│   ├── src/                    React client
│   ├── e2e/                    Playwright specs
│   ├── android/                Capacitor Android project
│   ├── ios/                    Capacitor iOS project (ADR-0013)
│   └── package.json
├── scripts/                    guards, testlab, benchmarks, build helpers
└── docs/
    ├── architecture/           this documentation (authoritative)
    ├── infrastructure-setup.md
    ├── release-process.md
    └── operator runbooks (payments, account deletion)
```

## Element catalog

| Concern | Tool | Status |
|---|---|---|
| Backend language and packaging | Python 3.12+, `pyproject.toml` | Existing; `uv` with `backend/uv.lock` |
| Backend lint | Ruff (`just backend-lint`) | Existing |
| Backend types | Pyright (`just backend-types`) | Existing, not yet blocking: 111 inherited errors to clear as modules are rewritten |
| Backend formatting | Ruff format | Planned: applied module by module as each is rewritten, to avoid one repository-wide reformat |
| Backend tests | pytest, in-memory SQLite, fake providers | Existing |
| Hosted configuration | Terraform in `infra/` (`just infra`: fmt and validate, no credentials); state in Supabase Postgres, schema `terraform_state` | Existing (ADR-0010) |
| Layer enforcement | import-linter (`just backend-arch`), contracts in `backend/pyproject.toml` | Existing |
| Frontend language and build | TypeScript strict, Vite, pnpm | Existing |
| Frontend lint and format | Biome formats (`frontend/biome.json`, `pnpm format`; `pnpm lint` fails on unformatted code); ESLint lints, because the React hooks rules (including set-state-in-effect) and the C-20 `fetch` rule have no full Biome equivalent | Done (Phase 1) |
| Frontend tests | Vitest + Testing Library; Playwright with mocked API: `just e2e` runs desktop Chromium and is the pull-request job `E2E (mocked)`; `just e2e-all` runs four Playwright projects, nightly and on demand in `.github/workflows/e2e-browsers.yml`: desktop Chromium, desktop WebKit, the iPhone 15 profile (WebKit) and the Pixel 7 profile (Chromium). Per-project skips and known-defect `fixme` marks name a reason from `frontend/e2e/projects.mjs`. Playwright WebKit is not iOS Safari: it does not reproduce iOS permission prompts, Chrome for iOS or in-app browsers, and the device profiles change screen size, user agent and touch, not the operating system (`frontend/e2e/README.md`) | Existing |
| Native app tests | Maestro flows in `frontend/maestro/` on the iOS simulator app (`just e2e-ios`; `scripts/build-ios.sh sim`, `scripts/test-app.sh ios`), signed in with the review account against production, stopping before paid AI calls; nightly and on demand in `.github/workflows/app-e2e.yml` on a macOS runner (ADR-0014) | Existing (iOS); Android flows not yet |
| Frontend boundary enforcement | dependency-cruiser (`frontend/.dependency-cruiser.cjs`, part of `pnpm lint`) and ESLint `no-restricted-globals` for `fetch` | Done (Phase 4) |
| Styling | Tailwind v4 tokens (`src/shared/styles/tokens.css`, the light "tea on the Bosphorus ferry" world, DESIGN.md), the Alegreya Sans display face (`@fontsource/alegreya-sans`) and shadcn/ui components (`src/shared/ui`); the inherited global CSS sits in a lower cascade layer until each screen is migrated | In progress (Phase 4) |
| Secret scanning | gitleaks through `scripts/guard/check-secrets.sh` | Existing (local hook and CI) |
| One command for all checks | `just check` (`justfile`) | Existing; the frontend recipes need dependencies installed |
| Continuous integration | GitHub Actions, `.github/workflows/ci.yml`, path-filtered; `.github/workflows/e2e-browsers.yml` runs the mocked e2e suite in all browser projects nightly and on demand | Existing; not yet run on GitHub |

## Context

Each clone must enable the hook once: `git config core.hooksPath .githooks`. CI runs the same scan, so a skipped hook is still caught before merge.

## Variability guide

Tool versions are pinned in lockfiles. Changing a tool in this table is an escalation case only when it changes how code must be written (for example a new framework); a version bump is routine.

## Rationale

One command runs every check so that agents and humans verify work the same way, and CI runs that same command. See [release-process.md](../../release-process.md) for how checked work reaches users.
