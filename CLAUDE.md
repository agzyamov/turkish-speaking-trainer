# Claude Code instructions

@AGENTS.md

## Claude Code specifics

- Your sandbox and permissions are defined in `.claude/settings.json`. Commands run inside an operating-system sandbox limited to this repository. If a command fails on a sandbox or permission limit, report which limit it hit and stop; widening it is the owner's decision.
- Escalate with a direct question to the owner, as described in `AGENTS.md` section 1 and `docs/architecture/constraints.md`.
- Commit only when the owner asks. Never push on your own.
