# ADR-0011: Releases derived from commit titles by semantic-release, published by the production job

- Status: Accepted
- Date: 2026-11-22
- Decided by: owner ("нормальный релиз менеджмент сделаем = семантик релиз")

## Context
Production deploys run from CI after the owner's approval (ADR-0010), but nothing recorded what was deployed: no tags, no GitHub releases, and the version shown in the app was the previous product's Android `1.45`. `docs/release-process.md` already asked for semantic versioning, Conventional Commits and a `vX.Y.Z` tag per release, done by hand.

## Decision
- **semantic-release** computes the version from the commit titles since the last `v*` tag (`feat` → minor, `fix`/`perf` → patch, `!` or `BREAKING CHANGE` → major; other types release nothing) and publishes the tag and a GitHub release with generated notes. Configuration: `.releaserc.json`; tooling pinned in the root `package.json` and `package-lock.json` (release tooling only, Node 26).
- It runs **inside the approved `production` job** of `.github/workflows/deploy.yml`: a dry run before deploying gives the version, the backend gets it as `APP_VERSION` (shown by `/api/health` and the API title), the frontend build as `VITE_APP_VERSION` (shown in Settings); after both deploys and their checks pass, the real run tags exactly the deployed commit. The owner's approval of the deploy is the instruction to tag (AGENTS.md section 3). No commit is pushed back to `main`; versions live in tags only.
- **commitlint** (`commitlint.config.mjs`, Conventional Commits) checks every pull request's commits in CI (job "Commit messages", part of "Required checks").
- The first TurkTalk release, `v1.0.0`, was tagged by hand on the first production deploy; semantic-release continues from it, so the previous product's history never enters release notes.
- Android keeps its own `versionName`/`versionCode`, changed only on an Android release (C-24); its builds show `package.json`'s version.

## Alternatives considered
- **release-please**: a release pull request per version. More ceremony, and the release would be cut on merge, not on deploy, so a tag could name code that never reached production.
- **Tags by hand**: what the process already said; it did not happen.
- **Version bumps committed to `main`** (`@semantic-release/git`): needs a bot allowed to push past branch protection, and adds a commit per release. Not needed while the version is injected at build time.

## Consequences
- Every deploy that contains a `feat` or `fix` produces a tag and release notes; deploys of only `docs`/`chore`/`ci`/`refactor`/`test` keep the last version.
- Commit titles are now part of the product's interface: a wrong type gives a wrong version. commitlint guards the format, review guards the meaning.
- The production job needs `contents: write` (tags and releases only); it still runs only after approval, on `main`.
- If `main` moves on while a deploy is waiting, semantic-release skips tagging that run and the next deploy releases.
