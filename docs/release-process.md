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

| Commit messages | Every commit title follows Conventional Commits (commitlint), so the version and release notes come out right |

Checks are path-filtered: a docs-only change runs the secret scan and commit lint only. Pull requests are merged with a merge commit; the branch's commits keep their titles, which feed the release notes.

## 3. Version and changelog

Automated by semantic-release (ADR-0011, `.releaserc.json`).

- Versions follow semantic versioning: `MAJOR.MINOR.PATCH`. The first TurkTalk release is `v1.0.0`.
- Commit titles follow Conventional Commits; CI rejects others. The type sets the next version:

  | Commit title | Release |
  |---|---|
  | `fix: …`, `perf: …` | patch |
  | `feat: …` | minor |
  | `feat!: …` or a `BREAKING CHANGE:` footer | major |
  | `docs`, `chore`, `ci`, `refactor`, `test`, `style`, `build` | none |

- A release is a git tag `vX.Y.Z` on the deployed commit with a GitHub release whose notes are generated from those commits. It is created by the production job after a successful deploy, never by hand.
- Web and backend share one version: `/api/health` reports it, Settings shows it. Android has its own `versionName` and `versionCode`, changed only on an Android release.

## 4. Web and backend release

Only on the owner's instruction (constraint C-25).

Merging to `main` starts it; the owner approves the `production` job in Actions (ADR-0010). The job then:

1. Works out the version (the next release, or the last tag if nothing releasable changed).
2. Applies Terraform.
3. Deploys the backend first. Its build runs database migrations and the catalogue seed under a lock. Checks `/api/health`.
4. Deploys the frontend and checks `/app`.
5. Tags the deployed commit and publishes the GitHub release.

Then the owner smoke-tests production: sign in, complete one exercise by typing, one by voice, open statistics, check the admin spend view.

Backward compatibility rule for migrations: a migration must work with the previous backend version still running, so a failed deploy can be rolled back without touching the database. A change that cannot meet this is split into two releases (add, then remove).

## 5. Android release

Only on the owner's explicit instruction, with the version agreed first (constraint C-24). Android changes accumulate between releases. A release is checked on a device first (a test APK from `scripts/build-android.sh apk`) and is submitted to a testing track before production.

The first bundle of an app is uploaded in Play Console by hand. After that the owner starts **Actions → Android release to Google Play → Run workflow** on `main`, gives the version name (for example `1.1`), the track and the status, and approves the `play` environment (ADR-0012). The job builds the current `main` with `scripts/build-android.sh`, signs with the upload key and uploads to the chosen testing track; promotion to production is done in Play Console. Start it only when production already runs the backend this `main` needs. On the owner's Mac the same script builds a test APK, and the bundle for the first, hand-made upload.

## 6. Rollback

| Problem | Action |
|---|---|
| Bad frontend deploy | Promote the previous deployment in the host |
| Bad backend deploy | Promote the previous deployment; the migration rule above keeps the database compatible |
| Runaway AI spend | Set `AI_MONTHLY_BUDGET_USD` to 0 in the backend environment and redeploy; AI calls stop, the rest of the app keeps working |
| Leaked secret | Revoke the key at the provider first, then remove it from the repository; assume anything pushed to a public repository is compromised |

## 7. Hotfix

Same path as any change, branched from `main`, with a `fix:` title and a patch version. There is no shortcut around the checks.
