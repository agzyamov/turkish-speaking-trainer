# Rules for coding agents

These rules apply to the whole repository and to every coding agent working in it.

The project is a Turkish speaking trainer being converted from a Serbian one. The state of that conversion is in [docs/architecture/roadmap.md](docs/architecture/roadmap.md).

## 1. The architecture documents are binding

Before changing code, read:

1. [docs/architecture/constraints.md](docs/architecture/constraints.md): the numbered rules and the escalation procedure.
2. The views for the area you are changing, found through [docs/architecture/README.md](docs/architecture/README.md).

Then:

- Make the change fit the documented architecture.
- **If it does not fit, or the documents do not cover it, stop and ask the human owner.** Say what you were asked to do, which rule or gap is in the way, the options with their consequences, and which you recommend. Do not implement any option while waiting, and do not work around the rule.
- After the owner decides, record the decision as an ADR in `docs/architecture/decisions/` and update the affected views in the same change.

Cases that always need the owner: breaking a constraint; a new dependency between layers; a new runtime dependency, service, AI provider or model role; a change a released client would notice; a schema change not in the roadmap; anything that could let AI spend exceed the cap or store learner audio.

## 2. Stay inside the repository; never touch secrets

This repository is public.

- Read and write only inside this repository.
- Do not read `.env` files, keystores or credential folders. Do not ask the owner to paste a secret into the conversation. Configuration is described by variable name only; `.env.example` holds placeholders.
- Never commit, print, log or send a secret anywhere. The pre-commit hook runs gitleaks; do not bypass it with `--no-verify`.
- Do not edit `.claude/settings.json`, `.githooks/`, `.gitleaks.toml` or `scripts/guard/` unless the owner explicitly asks.
- Do not use personal connectors or browser control.
- If you find something that looks like a real secret in the repository, stop and tell the owner; do not quote it.

## 3. Actions that need the owner's instruction each time

- Pushing, tagging, opening or merging pull requests.
- Deploying anything, running migrations against a hosted database, changing hosted configuration.
- Android sync, build, version change or store submission.
- Any call to a real AI provider that spends money.

## 4. How to work

- Work in small vertical slices and leave the app runnable after each one.
- Start each slice from current `origin/main` on its own branch. Follow [docs/release-process.md](docs/release-process.md).
- Models and Alembic migrations change together; every migration has a downgrade.
- Every interface string is added or changed in Russian and English in the same change.
- New and changed UI uses the shared design tokens and components.
- Tests: unit tests for business logic, integration tests for API and database, component tests for UI. Tests never call a real AI provider; use `backend/tests/fakes.py`.
- Do not describe planned features as done. When a Planned element lands, update its status in the views and the phase status in the roadmap.
- Preserve unrelated changes you did not make.

## 5. Working efficiently

- Read the architecture documents instead of re-exploring the codebase; they say where things live.
- Run the narrowest check that covers your change while iterating (one test file, one package), and the full check once before handing over.
- Do not rebuild, redeploy or re-run end-to-end suites for a change that only touches documentation.
- Keep changes small enough to review in one sitting; split larger work.
- Report plainly: what changed, which checks ran with their results, what was not done.

## 6. Verification before you say it is done

Run the full check and report the actual result. If a check fails or was not run, say so. Do not claim a check passed that you did not run.

From the repository root:

```bash
just check            # everything: secrets, backend, frontend
just backend          # lint, layer rules, tests
just backend-test -k name   # one narrow test run while iterating
just frontend         # lint, tests, build
just secrets          # secret scan
```

## 7. Older documents

`README.md`, `docs/decisions.md`, `docs/audit-roadmap.md`, the release notes under `docs/` and the spec docx describe the Serbian product and its history, mostly in Russian. They are kept as a record. Where they disagree with `docs/architecture/` or this file, this file and `docs/architecture/` win.
