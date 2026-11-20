# Architectural constraints and escalation

These rules are binding. A change that would break one is not allowed without an owner decision recorded as an ADR.

The **Enforced by** column says how a violation is caught. "Check" means an automated check that fails the build. "Review" means a human or reviewer agent must catch it. Checks marked "(Phase 1)" or "(Phase 2)" do not exist yet; until they do, the rule is review-only.

## Constraints

### Structure

| ID | Rule | Enforced by |
|---|---|---|
| C-01 | Backend dependencies point one way: `api → services → repositories → models/db`. A lower layer never imports a higher one. | Check: import-linter (`just backend-arch`) |
| C-02 | Routers in `app/api` only validate input, call services and map errors to HTTP. They contain no business rules and no database queries. | Review |
| C-03 | Business rules in `app/services` do not import FastAPI. | Check: import-linter (`just backend-arch`) |
| C-04 | Provider SDKs (`anthropic`, `elevenlabs`, any other AI SDK) are imported only inside adapter modules that implement a provider port. No other module refers to a concrete provider class. | Check: import-linter (`just backend-arch`) |
| C-05 | SQLAlchemy models and Alembic migrations change together. Every migration has a working downgrade. ORM models are never returned directly as API responses. | Review; migration tests |

### Data and privacy

| ID | Rule | Enforced by |
|---|---|---|
| C-06 | Learner audio is never written to the database, files, logs or test fixtures. One exception: for the designated debug admin with debugging switched on, the last 20 recordings may be kept in dedicated binary diagnostic fields for at most 7 days and are deleted when debugging is switched off. Tests use synthetic bytes. | Review |
| C-07 | Provider API keys exist only in the backend environment. They never appear in the frontend bundle, an API response or a log. | Review |
| C-08 | `.env` files, databases, secrets, keystores, build output and dependencies are never committed. | `.gitignore`; review |

### AI use and cost

| ID | Rule | Enforced by |
|---|---|---|
| C-09 | Every call to an AI provider goes through the budget guard, which refuses the call when the monthly budget would be exceeded and records the actual cost afterwards. There is no other path to a provider. | Check: `backend/tests/test_architecture_budget.py` |
| C-10 | No single user can spend more than their daily share of the AI budget. The budget guard enforces a per-user daily spend limit on every AI call, in addition to the daily phrase quota on answer grading. | Check: `backend/tests/test_ai_spend_api.py`; `test_architecture_usage_context.py` asserts every route that can reach a provider carries the spend context |
| C-11 | Model ids, prices and the budget amount come from configuration. None is written into business logic. An account is an administrator only if configuration names it; there are no built-in administrators. | Review; adapter tests assert env-provided model ids |
| C-12 | Every model response the program acts on is validated against a Pydantic schema. Free text from a model is never parsed with regular expressions. | Review |
| C-13 | Every external AI call has a timeout, a bounded number of retries and a safe error. | Review |
| C-14 | Automated tests never call a real AI provider. They use the fakes in `backend/tests/fakes.py` and the fake-client adapters in `backend/tests/providers.py`. | Review; CI has no provider keys |
| C-15 | The model may not add skills to the skill catalogue. Unknown `skill_key` values in model output are discarded. | Existing tests |
| C-16 | Prompts are separate versioned files in `backend/app/prompts`. A changed prompt gets a new version file. | Review |

### Language

| ID | Rule | Enforced by |
|---|---|---|
| C-17 | The target language is standard (Istanbul) Turkish at level A2, written in the Turkish Latin alphabet. Text comparison and casing use Turkish rules (`İ/i`, `I/ı`). | Unit tests (Phase 3) |
| C-18 | A learner's original speech and transcript are kept verbatim. Normalised text is never presented as what the learner said. | Review |
| C-19 | Every interface string exists in Russian and English and is added or changed in both in the same change. | Check: locale key parity test (Phase 4) |

### Frontend

| ID | Rule | Enforced by |
|---|---|---|
| C-20 | The client reaches the backend only through the API client modules. Components do not call `fetch` directly. | Check: dependency-cruiser (Phase 1) |
| C-21 | Colors, spacing, radii, type sizes and motion come from design tokens. Components do not hardcode them. | Review; Impeccable audit |
| C-22 | A feature module does not import from another feature module. Shared code lives in the shared layer. | Check: dependency-cruiser (Phase 4) |

### Platform

| ID | Rule | Enforced by |
|---|---|---|
| C-23 | No new runtime infrastructure (containers, queues, caches, additional services or databases) and no new AI provider without an owner decision. | Review |
| C-24 | No Android sync, build, version change or store submission without an explicit owner instruction. | Review |
| C-25 | No production deployment without an explicit owner instruction. | Review |

### Secrets and agent workspace

| ID | Rule | Enforced by |
|---|---|---|
| C-26 | This repository is public. No credential, token, private key, connection string with a password or real `.env` file is ever committed. | Check: gitleaks pre-commit hook (`.githooks/pre-commit`) and CI job |
| C-27 | A coding agent reads and writes only inside this repository. It does not read `.env` files, keystores or credential folders, and does not use personal connectors (mail, drive, calendar, browser control). | Check: `.claude/settings.json` deny rules; review for shell commands (the OS sandbox is off by the owner's decision, ADR-0006 amendment) |
| C-28 | A coding agent does not weaken its own confinement: no edits to `.claude/settings.json`, `.githooks/`, `.gitleaks.toml` or `scripts/guard/` except on the owner's explicit request, and no `--no-verify` commits. | Sandbox write protection on settings; review |
| C-29 | Secrets are never printed, logged, pasted into a document or sent to an external service. | Review |

### Delivery

| ID | Rule | Enforced by |
|---|---|---|
| C-30 | Every change reaches `main` through a pull request with all required checks green. See [release-process.md](../release-process.md). | Branch protection (owner sets it); review |
| C-31 | A database migration works with the previous backend version still running. | Review |

## Escalation

### When to stop and ask

Stop and ask the human owner before writing the change when any of these is true:

1. The change would break a constraint above.
2. The change adds, removes or re-routes a dependency between layers or modules that the module views do not show.
3. The change adds a runtime dependency, an external service, an AI provider, a model role or a new piece of infrastructure.
4. The change alters an interface in [interfaces/](interfaces/) in a way existing clients would notice.
5. The change alters the database schema in a way not already described by a phase in [roadmap.md](roadmap.md).
6. The change affects a quality requirement in [system-overview.md](system-overview.md), for example anything that could let spend exceed the cap or store audio.
7. The task cannot be done as asked without one of the above.
8. The documents are silent or contradict each other about the area being changed.

Routine work that fits the documented structure does not need escalation: implementing a planned element, fixing a bug inside one module, adding a test, adding an interface string in both locales.

### How to ask

State, in this order:

- what you were asked to do,
- which document and rule it conflicts with, or what the documents fail to cover,
- the options you see, with the consequence of each,
- which one you recommend.

Then wait. Do not implement any option while waiting, and do not work around the constraint.

### After the decision

- Record it as a new ADR in [decisions/](decisions/) using the template there.
- Update the affected views, interfaces and constraints in the same change as the code.
- If the decision retires a constraint, mark it withdrawn with a link to the ADR rather than deleting the row.
