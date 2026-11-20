# Claude Code instructions

@AGENTS.md

## Claude Code specifics

- Your permissions are defined in `.claude/settings.json`. The operating-system sandbox is switched off by the owner (ADR-0006 amendment), so nothing mechanical stops a shell command from reaching outside the repository: keep every command inside it yourself (AGENTS.md section 2). If a command fails on a permission rule, report which rule and stop; widening it is the owner's decision.
- Escalate with a direct question to the owner, as described in `AGENTS.md` section 1 and `docs/architecture/constraints.md`.
- Commit only when the owner asks. Never push on your own.
- Project subagents are in `.claude/agents/`: `backend`, `frontend`, `qa`, `docs` and the read-only `reviewer`. Use `reviewer` before committing a change of any size.
