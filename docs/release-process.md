# Release process

How a change gets from an idea to users. It is designed so that small changes move fast, nothing reaches users unchecked, and every release can be traced and undone.

Status: the checks exist locally (`just check`) and as a GitHub Actions workflow. Branch protection on `main` requiring the "Required checks" status is set by the owner in the repository settings.

## 1. Change

1. Start from current `main`: `git fetch origin && git switch -c <type>/<short-name> origin/main`. Types: `feat`, `fix`, `docs`, `chore`, `refactor`.
2. Keep the change small: one purpose per branch. A change that needs more than about 400 changed lines of hand-written code is split.
3. Run `just check` before pushing.
4. If the change touches architecture, update the affected documents in `docs/architecture/` in the same branch.

## 2. Pull request

Every change reaches `main` through a pull request. The description states what changed, why, how it was verified and whether an architecture document or ADR changed.

Required before merge:

| Check | What it proves |
|---|---|
| Secret scan | No credential in the diff |
| Backend: tests, lint, types, layer rules | Behaviour and structure hold |
| Frontend: tests, lint, typecheck, build, boundary rules | Behaviour and structure hold |
| Mocked end-to-end tests | The main flows still work |
| Review | A reviewer (human or reviewer agent) found no blocking issue |

Checks are path-filtered: a docs-only change runs the secret scan and link check only. Merges are squash merges, so `main` has one commit per change.

## 3. Version and changelog

- Versions follow semantic versioning: `MAJOR.MINOR.PATCH`. Before the first public release, versions are `0.x`.
- Commit titles on `main` follow Conventional Commits (`feat: …`, `fix: …`). The changelog and the next version number are derived from them.
- A release is a git tag `vX.Y.Z` on `main` with a GitHub release whose notes are the changelog section.
- Web and backend share one version. Android has its own `versionName` and `versionCode`, changed only on an Android release.

## 4. Web and backend release

Only on the owner's instruction (constraint C-25).

1. Confirm `main` is green.
2. Tag the release.
3. Deploy the backend first. Its build runs database migrations and the catalogue seed under a lock.
4. Deploy the frontend.
5. Smoke-test production: sign in, complete one exercise by typing, complete one by voice, open statistics, check the admin spend view.
6. Record the release in the GitHub release notes: version, commit, time, smoke-test result.

Backward compatibility rule for migrations: a migration must work with the previous backend version still running, so a failed deploy can be rolled back without touching the database. A change that cannot meet this is split into two releases (add, then remove).

## 5. Android release

Only on the owner's explicit instruction, with the version agreed first (constraint C-24). Android changes accumulate between releases. A release builds from a tagged commit, is checked on a device, and is submitted to a testing track before production.

## 6. Rollback

| Problem | Action |
|---|---|
| Bad frontend deploy | Promote the previous deployment in the host |
| Bad backend deploy | Promote the previous deployment; the migration rule above keeps the database compatible |
| Runaway AI spend | Set `AI_MONTHLY_BUDGET_USD` to 0 in the backend environment and redeploy; AI calls stop, the rest of the app keeps working |
| Leaked secret | Revoke the key at the provider first, then remove it from the repository; assume anything pushed to a public repository is compromised |

## 7. Hotfix

Same path as any change, branched from `main`, with a `fix:` title and a patch version. There is no shortcut around the checks.
