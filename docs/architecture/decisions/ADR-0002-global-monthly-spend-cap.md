# ADR-0002: One global monthly spend cap enforced in the application

- Status: Accepted
- Date: 2026-11-20
- Decided by: product owner

## Context
The inherited backend recorded no usage and capped nothing. Only one of seven AI endpoints had a per-user quota. The owner requires a hard maximum of $25 per month.

## Decision
- Every provider call passes through a budget guard that checks month-to-date spend before the call and records measured cost after it, in a database ledger.
- The cap is global across all users and both providers, per UTC calendar month, default $25, set by environment variable.
- Prices come from configuration.
- When the cap is reached, AI features return `budget_exhausted` until the next month; features that need no AI keep working.
- Every AI endpoint also enforces the per-user daily quota.

## Amendment, 2026-11-20 (implementation)

- The guard is invoked inside each adapter, not by the services that use them. A service in the inherited code builds its own adapter instance, which would have bypassed a guard placed in front of the port.
- Per-user fairness is a daily spend limit enforced by the guard on every AI call (free and Premium amounts set by configuration, admins exempt). The plan had been to copy the daily phrase quota onto each AI endpoint, but that quota counts graded answers and would not have limited transcription or topic calls made without grading.
- Exhaustion is reported through the existing failure channel as `failure.reason` instead of a new top-level error type, so existing recovery paths apply unchanged.
- Server-side refusal fallback to a second model is not enabled: a fallback model is billed at a different rate and would complicate cost measurement. A refusal is treated as a failed call.

## Alternatives considered
- Rely on the provider console's spend limit only: not available uniformly across both providers, gives users an opaque failure, and cannot cover two providers under one figure. Kept as a backstop.
- Per-user budgets only: fair, but does not bound the total.
- In-memory counter: wrong on serverless, where instances share nothing.

## Consequences
- Each AI call costs one extra read and one write to the database.
- Spend can exceed the cap by at most the worst-case cost of calls in flight at the same moment.
- A public app with a $25 cap will pause for everyone when the month's budget is spent. That is accepted.
- New AI features must be added through the guard; an architecture test enforces it.
