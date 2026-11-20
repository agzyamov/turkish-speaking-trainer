# Allocation view: work assignment

Shows who is responsible for which part and who decides what.

## Primary presentation

| Area | Works on it | Decides |
|---|---|---|
| Product scope, budget, providers, brand, releases | Owner | Owner |
| Architecture documents and constraints | Agent drafts; owner approves any change to a constraint or decision | Owner |
| `backend/` | `backend` subagent | Owner on escalation cases |
| `frontend/` | `frontend` subagent | Owner on escalation cases |
| Tests and verification | `qa` subagent | n/a |
| Review against the architecture | `reviewer` subagent (read-only tools) | n/a |
| `docs/` | `docs` subagent | n/a |
| Turkish content correctness | Agent generates; a native speaker reviews before public launch | Owner |
| Deployments, store submissions, provider consoles, secrets | Owner only | Owner |

## Element catalog

| Role | May | May not |
|---|---|---|
| Any coding agent | Read and change files inside this repository; run local checks | Read or write outside the repository; read `.env` files or other secrets; push, deploy, publish or build Android without being asked; work around a constraint |
| Reviewer agent | Read and report | Edit |
| Owner | Everything | n/a |

The roles are Claude Code subagents defined in `.claude/agents/*.md` (Markdown with YAML frontmatter: `name`, `description`, optional `tools` and `model`; the body is the subagent's instructions). Claude Code loads `CLAUDE.md` into every custom subagent, and `CLAUDE.md` imports `AGENTS.md`, so all roles share one rule set. Tool calls from subagents go through the same permission checks and sandbox as the main session (`.claude/settings.json`). The `reviewer` is limited to read-only tools plus `Bash` for `git` and test commands; its instructions forbid modifying files.

Other coding agents that read `AGENTS.md` directly get the same rules without the Claude-specific role definitions. The previous Codex role files were removed on 2026-11-20 when the project moved to Claude.

## Context

The repository is public. Anything committed is visible to everyone, which is why secrets handling is enforced by tooling and not left to care.

## Variability guide

Roles can be played by different tools or people. The permissions in the table do not change with who plays the role.

## Rationale

Agents are fast but cannot be accountable for money, credentials or public releases, so those stay with the owner, and the agent's reach is limited by the sandbox to the repository. Escalation rules are in [constraints.md](../constraints.md#escalation).
