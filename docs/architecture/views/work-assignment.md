# Allocation view: work assignment

Shows who is responsible for which part and who decides what.

## Primary presentation

| Area | Works on it | Decides |
|---|---|---|
| Product scope, budget, providers, brand, releases | Owner | Owner |
| Architecture documents and constraints | Agent drafts; owner approves any change to a constraint or decision | Owner |
| `backend/` | Backend agent role | Owner on escalation cases |
| `frontend/` | Frontend agent role | Owner on escalation cases |
| Tests and verification | QA agent role | n/a |
| Review | Reviewer agent role (read-only) | n/a |
| `docs/` | Docs agent role | n/a |
| Turkish content correctness | Agent generates; a native speaker reviews before public launch | Owner |
| Deployments, store submissions, provider consoles, secrets | Owner only | Owner |

## Element catalog

| Role | May | May not |
|---|---|---|
| Any coding agent | Read and change files inside this repository; run local checks | Read or write outside the repository; read `.env` files or other secrets; push, deploy, publish or build Android without being asked; work around a constraint |
| Reviewer agent | Read and report | Edit |
| Owner | Everything | n/a |

Agent role definitions for Codex are in `.codex/agents/`. Claude Code uses `CLAUDE.md` and `.claude/settings.json`. Both read `AGENTS.md`.

## Context

The repository is public. Anything committed is visible to everyone, which is why secrets handling is enforced by tooling and not left to care.

## Variability guide

Roles can be played by different tools or people. The permissions in the table do not change with who plays the role.

## Rationale

Agents are fast but cannot be accountable for money, credentials or public releases, so those stay with the owner, and the agent's reach is limited by the sandbox to the repository. Escalation rules are in [constraints.md](../constraints.md#escalation).
