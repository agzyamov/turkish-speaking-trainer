# Test audit against the architecture

Audit date: 2026-11-20. Every test file was read and judged against the views, constraints and decisions in this directory. Counts for the inherited suite are as audited; tests added since are listed separately.

## Verdict by suite

| Suite | Files | Keep as is | Adapt | Retire | Questionable |
|---|---|---|---|---|---|
| Backend and tooling (`backend/tests`, `scripts/testing`) | 63 | 22 | 37 | 2 | 2 |
| Frontend unit (`frontend/src/tests`) | 43 | 17 | 24 | 1 | 1 |
| Frontend end-to-end (`frontend/e2e`) | 43 | 5 | 32 | 0 | 7 |

- **Keep**: verifies behaviour the target architecture keeps unchanged.
- **Adapt**: valid purpose, but tied to the previous language, OpenAI, the old brand or today's CSS; changes in the phase shown below.
- **Retire**: verifies something the architecture removes.
- **Questionable**: platform-specific, pins release facts, needs infrastructure the project no longer has, or already fails.

## What must change, by phase

| Phase | Tests affected | Change |
|---|---|---|
| 3 (Turkish) | About 30 backend files, 20 frontend unit files, 12 e2e specs | `_sr` → `_tr` fields; samples → Turkish; `alphabet` field and two-alphabet cases removed; payment country → `turkey` |
| 3 | The old dialect-policy, transcription-adapter and alphabet-conversion tests | Retired 2026-11-20, replaced by `test_turkish_text.py`, the ElevenLabs adapter tests and `turkishText` tests |
| 3 | 12 backend files that constructed the OpenAI adapters | Done 2026-11-20: ported to the Claude and ElevenLabs adapters over fake clients (`backend/tests/providers.py`); OpenAI adapters deleted |
| 4 (frontend restructure) | 11 unit files (about 110 assertions) and 35 e2e files (about 200 class locators, 50 bounding-box checks, 35 hardcoded colors) | Selectors moved from CSS classes and pixel geometry to roles and labels **before** the restyle; pixel and color checks become Phase 6 screenshot baselines |
| 5 (rebrand) | About 15 files | The old brand, domain and package id, the review alias and the previous owner's name and email replaced by the single brand module and synthetic identities |

## Findings that need action before the phase they block

1. **Most end-to-end specs never run.** CI runs only the unit tests. `just e2e` runs one spec (`mocked.spec.mjs`), and that spec fails today: line 160 clicks a control whose text no longer exists in the source. About 30 specs have no runner at all. ADR-0003 relies on the existing tests as a safety net for the restructure; today only the unit tests provide it. Before Phase 4: repair `mocked.spec.mjs`, wire the specs that do not need a device into `just e2e` and CI. Status 2026-11-20: `mocked.spec.mjs` repaired and green locally (17 passed, 1 `fixme`: a pre-existing 2px overlap of the calendar date and count at 1280px, which also fails on the inherited code). It runs in CI as the required job `E2E (mocked)`, together with `settings-account.spec.mjs` and `mobile-premium-cards.spec.mjs` (repaired the same day: Android Premium mock, roles and `data-slot` instead of CSS classes). Status 2026-11-21: `just e2e` (and the CI job) now runs 19 specs, 132 tests, green twice in a row locally: mocked, settings-account, mobile-premium-cards, calendar-legend, custom-content, share-app, week-navigation, lazy-panels, manual-payments, network, localization-fixes, premium-tab, login-layout, startup, feedback-activity, review-access, source-language, context-hints, failure-diagnostics. Most were broken only by mocks missing endpoints added later (`/api/auth/me/android-premium`, `/api/auth/me/preferences`, `/api/admin/payments`); `e2e/accountRoutes.mjs` supplies the first two. Still not wired, because they describe the practice screen before the redesign or the previous language's content (76 failing tests): rewards, result-navigation, practice-layout, desktop-topics, free-daily-limit, premium-limits, bilingual-topics, english-word-hints, misc-phrases, premium-topic-cards (Android case). email-login and landing specs hang on timeouts and need their own look. lifecycle needs Turkish samples; local and local-network need a local backend. Note (2026-11-21): a full-page Playwright screenshot resizes the window, which on desktop flips the app to the phone layout and back and remounts the visible section, losing its local state (for example an open payment form); specs take viewport screenshots before interacting further. The remount itself is a product gap: which Premium form is open now lives in the app (`PremiumUiState`) and survives the switch, resetting only when another section is shown (covered by manual-payments); fields typed inside a form, and other sections' local state, are still lost on a layout switch. The agent runs Playwright outside the OS sandbox through `sandbox.excludedCommands` (`pnpm exec playwright test *`, `pnpm exec playwright install *`), because Chromium must register a Mach service that the sandbox does not allow.
2. **`play-store-assets.spec.mjs`** was a screenshot generator, not a test. Removed 2026-11-20.
3. **Release facts pinned in unit tests.** `androidManifest.test.ts` asserts the version, version code and APK file name; `SettingsView.test.tsx` reads `build.gradle`. Every Android release breaks them. Keep only the permission checks.
4. **Tests that reach across the application boundary.** Resolved 2026-11-20 for `i18n.test.tsx`, which no longer reads backend files. Backend `test_interface_language.py` still reads `frontend/src/locales/phrases.en.json` on purpose: that file is generated from the backend catalogue (`scripts/export_phrases_en.py`) and the test is the check that it is up to date.
5. **Tests that depend on private methods or exact SQL** (`test_attempt_reservations.py`, `test_answer_analyzer.py`, `test_topics_and_sessions_api.py`) will break on internal refactoring without any behaviour change.
6. **Device and Windows-only suites** (`android-*.mjs`, `local*.spec.mjs`, `test_postgres_testlab.py`) need an Android build or a Windows machine. They stay out of CI and are run only on an Android release.
7. **A wording gap in C-15.** An unknown skill key among *demonstrated skills* is discarded, as the constraint says. An unknown skill key on a reported *issue* makes the whole grading fail after one retry (`test_answer_analyzer.py:481-497`). Both are safe; the constraint describes only the first.

## Coverage of the constraints

| Constraint or quality | Covered by a test? |
|---|---|
| C-01, C-03, C-04 layers and SDK imports | Yes: import-linter contracts (`just backend-arch`) |
| C-05 working downgrades | Partly: round trips at about 11 of 24 revisions; no test walks the whole chain |
| C-06, Q-3 audio not stored | Schema level and debug-exception level, yes. New: ElevenLabs adapter test that audio and key never reach logs. No test yet that the `/transcriptions` route writes nothing to disk |
| C-07, Q-4 keys not exposed | Responses and headers, yes. No scan of the built frontend bundle |
| C-09, Q-1 spend cap | Yes, new: `test_budget_guard.py`, `test_architecture_budget.py`, `test_ai_spend_api.py` |
| C-10, Q-2 per-user fairness | Yes, new: per-user daily limit in `test_ai_spend_api.py`; daily phrase quota in `test_users_api.py` |
| C-11 configuration | Model ids and limits, yes. Prices and budget, yes (new) |
| C-12, Q-6 validated output | Yes for both the legacy and the new adapters |
| C-13 timeouts and bounded retries | Yes for the new adapters |
| C-14 no real provider in tests | Partly structural: an autouse fixture gives every test a throwaway spend ledger, and adapter tests use fake clients; nothing blocks the network itself. CI holds no provider keys, which is the actual safeguard |
| C-15 skill catalogue | Yes |
| C-16 versioned prompts | No |
| C-17 Turkish text rules | Yes: `test_turkish_text.py`, plus Turkish casing in hint alignment and suffix-negation guards; `test_turkish_catalog.py` checks every catalogue phrase (script, hints that survive alignment, skill keys) |
| C-19 both locales | One direction only (every English entry is used). Parity test planned for Phase 4 |
| C-20, C-22 frontend boundaries | No (dependency-cruiser, Phases 1 and 4) |
| C-21, Q-10 tokens, accessibility, visual | No (Phase 6) |
| C-26 secrets | Yes: gitleaks hook and CI job |
| C-31 migration compatible with previous backend | No |
| Q-7 clear state when AI is unavailable | Backend yes, including the new budget reasons. Frontend: "AI outage" test and, new, budget-paused messages for the response shapes the backend sends (`App.test.tsx`, `budgetPause.test.ts`), including custom topic creation (ADR-0008, `test_ai_spend_api.py`) |

## Identity and infrastructure left in tests

The previous owner's email was replaced with a synthetic address in the backend tests. Still present in frontend tests and in two tooling tests: the same email, the previous owner's name, the production domain, the Play application id, the review-login alias and a Supabase project reference. None is a credential. They are removed in Phase 5, or earlier when a file is touched.
