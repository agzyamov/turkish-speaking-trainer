# ADR-0014: End-to-end tests of the native app with Maestro

- Status: Accepted
- Date: 2026-11-23
- Decided by: owner (asked for automated app tests "like Playwright" instead of clicking through the simulator; accepted Maestro, a review account for the tests, and nightly runs on macOS runners)

## Context
Playwright covers the web client in desktop and mobile browser engines (`e2e-browsers.yml`), but not the native shells: the iOS and Android apps add native permission prompts, the sign-in deep link and their own layout. The first manual iOS check found a real defect (the production backend did not yet accept `platform: "ios"`), and manual clicking in the simulator does not scale.

## Decision
- **Maestro** drives the installed app on an iOS simulator through flows in `frontend/maestro/` (YAML). It sees both native iOS views and the WebView content, so one flow covers a native prompt and the web interface. It is a test tool on the developer machine and the CI runner only; nothing ships with the app.
- `scripts/test-app.sh ios` runs the flows; `scripts/build-ios.sh sim` builds an unsigned simulator app into `artifacts/`; `just e2e-ios` does both.
- The flows sign in with a **review account** (a normal Supabase user created by `scripts/create-review-account.sh`) against the production backend. Its password is generated and never printed; it lives in the owner's Keychain and in the repository secret `REVIEW_LOGIN_PASSWORD`; the address is the secret `REVIEW_LOGIN_EMAIL`. The same account serves app-store reviewers through "Вход для проверки".
- The flows stop before anything that calls a paid AI provider: they type no answers and end before "Завершить запись", so no recording is sent for transcription. C-14 now lists the routes these flows must not reach; nothing enforces it except review, because production has the provider keys.
- Unsigned simulator builds for these tests are an exception to C-24; store builds still need the owner's instruction.
- CI: `.github/workflows/app-e2e.yml` runs nightly and on demand on a macOS runner. Pull requests do not run it, because macOS minutes cost about ten times Linux minutes. Runners have no audio input, so flows tagged `needs-microphone` run only on the owner's Mac.

## Alternatives considered
- **Appium with XCUITest**: more control and wider language support, but a server, drivers and much more setup for the same flows.
- **Native XCUITest in the Xcode project**: no new tool, but Swift tests for iOS only, and Android would need a separate suite.
- **Mocked backend for the app tests**: hermetic, but needs a way to point the release build at a mock and to fake Supabase sign-in; the review account against production also checks the deployed backend.

## Consequences
- New test tooling: Maestro (installed with Homebrew locally and with Maestro's installer in CI) and Java 21.
- The tests depend on production and on the review account; if either is down or the password secret is missing, the nightly run fails.
- The simulator takes the microphone and its permission from the Mac, so the iOS permission prompt may not appear there; the prompt and live speech recognition stay a check on a real iPhone.
- Google and Apple sign-in are not automated.
- Android flows are not added yet; Maestro can run the same flows on an emulator later.
- Maestro writes typed text, the password included, into its debug output. `scripts/test-app.sh` keeps that output in a temporary folder and masks the password before moving it to `artifacts/maestro/`; the workflow does not upload it. Before this was in place, early local runs left unmasked logs in `~/.maestro/tests`; they were deleted.
- The review account is shared with app-store reviewers, and its server-side state persists between runs (interface language, personal topics, statistics). A reviewer who switches the language to English or creates a topic starting with "Банк" can make the flows fail; nightly runs also add sessions to that account's statistics. A separate test account would remove this if it becomes a problem.
- The flows sign in by typing the email, which goes straight to Supabase; the backend's `turktalkreview` alias that reviewers use is not exercised.
