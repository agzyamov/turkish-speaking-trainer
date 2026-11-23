# ADR-0012: Android releases to Google Play testing tracks from a hand-started CI job

- Status: Accepted
- Date: 2026-11-23
- Decided by: owner (asked for the same automated upload as in their other published app)

## Context
The first Android bundle (version 1.0, code 1) is built on the owner's Mac with `scripts/build-android.sh` and uploaded to Play Console by hand; Google accepts an app's first bundle no other way. Repeating that for every version depends on one machine holding the upload key, and on manual steps that are easy to get wrong (a reused version code, a build from uncommitted files).

## Decision
- `.github/workflows/android-release.yml` builds, signs and uploads a bundle. It starts **only by hand** (`workflow_dispatch`), only on `main`, and runs in the GitHub environment `play`, which requires the owner's approval. That is the owner's instruction that C-24 asks for.
- It uploads to a **testing track** (internal, closed or open). Promotion to production stays a manual step in Play Console.
- It builds the current `main`, not a tag; the owner starts it when `main` is what should ship and production already runs the matching backend.
- The build is the same `scripts/build-android.sh` the owner runs locally, in two steps: `aab-build` without the key, then `aab-sign`. The workflow passes the version name (an input, for example `1.1`) and a version code (`run number + 1`; code 1 was the hand-uploaded bundle), which `frontend/android/app/build.gradle` accepts as the optional properties `playVersionName` and `playVersionCode`. The numbers written in `build.gradle` stay the defaults for every other build. A release build also shows its Android version name in Settings (`VITE_APP_VERSION`), where other Android builds show `package.json`'s version (ADR-0011).
- The upload key is stored as two secrets of the `play` environment (`ANDROID_UPLOAD_KEYSTORE_B64`, `ANDROID_UPLOAD_KEYSTORE_PASSWORD`), written to the runner's temporary directory for the signing step only, after the build tools have finished, and removed afterwards.
- Google access uses **workload identity federation**: the job proves which repository it runs in and receives a short-lived token for a service account that may release this one app to testing tracks in Play Console. The federation provider accepts only jobs of this repository running in the `play` environment, so a workflow on another branch or without the owner's approval gets no token. No Google key file is stored anywhere. The provider and service account names are the repository variables `PLAY_WORKLOAD_IDENTITY_PROVIDER` and `PLAY_SERVICE_ACCOUNT`.
- `scripts/play-upload.sh` calls the Play Developer API directly (create an edit, upload the bundle, assign it to the track, commit).

## Alternatives considered
- **Upload by hand every time**: no new moving parts, but it keeps the release tied to one machine and to manual version bookkeeping.
- **A service account key file as a secret**: simpler to set up, but a long-lived Google credential in GitHub. Federation gives the same access without one.
- **Fastlane or the Gradle Play Publisher plugin**: a new build dependency for four API calls.
- **Release on every production deploy**: Android changes accumulate between releases (release process, section 5) and each upload goes through Google's review, so a release stays a separate, deliberate action.

## Consequences
- The upload key now exists in two places: the owner's Mac and the `play` environment. Both must be kept; losing both means a key reset through Google Play support.
- A release needs one-time setup by the owner: a Google Cloud project with the Play Developer API, the service account, the federation provider restricted to this repository, the service account invited in Play Console, and the `play` environment. `docs/infrastructure-setup.md` lists the steps.
- The Play Developer API cannot create an app or accept its first bundle, so the first upload stays manual.
- The version code depends on the workflow's run number:
  - failed runs leave gaps, which are harmless because the numbers only have to grow;
  - re-running a finished run reuses its code and is rejected by Play; start a new run instead;
  - renaming or recreating the workflow file restarts the run number, so the offset in the workflow must then be raised;
  - a bundle uploaded by hand with a higher code would collide with later runs, so after the first release hand uploads stop;
  - a local `scripts/build-android.sh aab` still produces code 1 unless `TURKTALK_VERSION_NAME` and `TURKTALK_VERSION_CODE` are set, so it is for inspection, not for upload.
- The job's third-party actions are referenced by version tag, as in the other workflows; pinning them to commit hashes is an open hardening step.
- The Android version name is typed in by the owner for each release and is independent of the web version from semantic-release (ADR-0011).
