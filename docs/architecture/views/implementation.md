# Allocation view: implementation

Shows where modules live in the repository and how they are built and checked.

## Primary presentation

```text
.
├── AGENTS.md, CLAUDE.md        rules for coding agents
├── .claude/settings.json       agent sandbox and permissions
├── .githooks/, .gitleaks.toml  secret scanning before every commit
├── justfile                    one entry point for every check
├── .github/workflows/ci.yml    continuous integration
├── backend/
│   ├── app/                    api, services, repositories, models, db, schemas, prompts
│   ├── alembic/                migrations
│   ├── tests/                  pytest; fakes.py holds the fake providers
│   └── pyproject.toml
├── frontend/
│   ├── src/                    React client
│   ├── e2e/                    Playwright specs
│   ├── android/                Capacitor Android project
│   └── package.json
├── scripts/                    guards, testlab, benchmarks, build helpers
└── docs/
    ├── architecture/           this documentation (authoritative)
    ├── release-process.md
    └── (older Russian-language records of the Serbian product)
```

## Element catalog

| Concern | Tool | Status |
|---|---|---|
| Backend language and packaging | Python 3.12+, `pyproject.toml` | Existing; `uv` with `backend/uv.lock` |
| Backend lint | Ruff (`just backend-lint`) | Existing |
| Backend types | Pyright (`just backend-types`) | Existing, not yet blocking: 111 inherited errors to clear as modules are rewritten |
| Backend formatting | Ruff format | Planned: applied module by module as each is rewritten, to avoid one repository-wide reformat |
| Backend tests | pytest, in-memory SQLite, fake providers | Existing |
| Layer enforcement | import-linter (`just backend-arch`), contracts in `backend/pyproject.toml` | Existing |
| Frontend language and build | TypeScript strict, Vite, pnpm | Existing |
| Frontend lint and format | ESLint today; Biome | Changing (Phase 1) |
| Frontend tests | Vitest + Testing Library; Playwright with mocked API | Existing |
| Frontend boundary enforcement | dependency-cruiser | Planned (Phase 1) |
| Styling | Global CSS today; Tailwind v4 tokens and shadcn/ui | Changing (Phase 4) |
| Secret scanning | gitleaks through `scripts/guard/check-secrets.sh` | Existing (local hook and CI) |
| One command for all checks | `just check` (`justfile`) | Existing; the frontend recipes need dependencies installed |
| Continuous integration | GitHub Actions, `.github/workflows/ci.yml`, path-filtered | Existing; not yet run on GitHub |

## Context

Each clone must enable the hook once: `git config core.hooksPath .githooks`. CI runs the same scan, so a skipped hook is still caught before merge.

## Variability guide

Tool versions are pinned in lockfiles. Changing a tool in this table is an escalation case only when it changes how code must be written (for example a new framework); a version bump is routine.

## Rationale

One command runs every check so that agents and humans verify work the same way, and CI runs that same command. See [release-process.md](../../release-process.md) for how checked work reaches users.
