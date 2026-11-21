# ADR-0005: Working brand name held in one place

- Status: Accepted
- Date: 2026-11-20
- Decided by: product owner

## Context
The product needs its own name, Android application id and domain, but the owner has not chosen them yet.

## Decision
Use the working name `TurkTalk` and application id `com.turktalk.trainer`. Keep name, id, URLs and support contact in one frontend module and one set of backend settings so the final choice is a single change.

## Consequences
- No domain, store listing or Android build is made under the working name.
- The name must be checked for availability and trademark conflicts by the owner before it is used publicly.
