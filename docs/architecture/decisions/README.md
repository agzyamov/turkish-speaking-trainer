# Architecture decisions

One file per decision. Decisions are never edited to say something different; a new decision supersedes an old one and the old one's status is updated to point at it.

| ADR | Decision | Status |
|---|---|---|
| [0001](ADR-0001-claude-and-elevenlabs.md) | Claude for language tasks, ElevenLabs Scribe for speech-to-text | Accepted |
| [0002](ADR-0002-global-monthly-spend-cap.md) | One global monthly spend cap enforced in the application | Accepted |
| [0003](ADR-0003-frontend-upgrade-in-place.md) | Upgrade the frontend in place instead of rebuilding it | Accepted |
| [0004](ADR-0004-turkish-text-policy.md) | Standard Turkish, Latin alphabet, Russian and English as source languages | Accepted |
| [0005](ADR-0005-working-brand.md) | Working brand name held in one place | Accepted |
| [0006](ADR-0006-agent-confinement-and-secrets.md) | Coding agents are confined to the repository; secrets are blocked by tooling | Accepted |
| [0007](ADR-0007-claude-api-conventions.md) | Conventions for calling the Claude API (structured outputs, caching, effort, refusals) | Accepted |
| [0008](ADR-0008-budget-reason-on-custom-content-errors.md) | Budget reason added to custom content errors (topic creation), code unchanged | Accepted |
| [0009](ADR-0009-section-urls-with-hash-history.md) | Sections as URLs: TanStack Router with hash history in the browser, memory history on Android | Accepted |
| [0010](ADR-0010-infrastructure-as-code-and-ci-deploy.md) | Terraform in `infra/` with state in the project's Supabase Postgres; production deploys from CI after the owner's approval | Accepted |
| [0011](ADR-0011-semantic-release.md) | Versions, tags and GitHub releases derived from commit titles by semantic-release, published by the approved production job | Accepted |
| [0012](ADR-0012-android-releases-from-ci.md) | Android releases to Google Play testing tracks from a hand-started CI job, with keyless Google access | Accepted |
| [0013](ADR-0013-ios-app.md) | An iOS app as a third Capacitor shell, with Sign in with Apple and the same Premium gift as Android | Accepted |

## Template

```markdown
# ADR-NNNN: title

- Status: Proposed | Accepted | Superseded by ADR-NNNN
- Date: YYYY-MM-DD
- Decided by: who

## Context
What forced a decision.

## Decision
What was decided.

## Alternatives considered
Each option and why it was not chosen.

## Consequences
What becomes easier, what becomes harder, what must now be true.
```
