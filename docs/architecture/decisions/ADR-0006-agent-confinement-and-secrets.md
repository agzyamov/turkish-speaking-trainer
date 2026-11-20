# ADR-0006: Coding agents are confined to the repository; secrets are blocked by tooling

- Status: Accepted
- Date: 2026-11-20
- Decided by: product owner

## Context
The repository is public and most changes are made by coding agents. The owner requires that the agent can reach the project repository and nothing else, and that no secret is ever committed.

## Decision
- `.claude/settings.json` (committed) confines Claude Code: file reads and writes outside the repository are refused; shell commands run in an operating-system sandbox that cannot be switched off from inside a session; network access is limited to package registries and GitHub; personal connectors (mail, drive, calendar, browser control and similar) are disabled; reading `.env` files, keystores and credential folders is denied; pushing, tagging, deploying and Android builds require the owner's approval each time.
- Secrets live only in untracked `.env` files and in host configuration.
- gitleaks runs before every commit through `.githooks/pre-commit` and will run in CI, with project-specific rules for the providers in use.

## Amendment, 2026-11-20

The first version also denied reading every `*.pem` file. That blocked the system and Python certificate bundles, which share the extension, so no HTTPS connection could be made and dependencies could not be installed. The owner approved removing that one rule. Private keys remain blocked from commits by file name and by gitleaks, and the credential folders where keys normally live remain unreadable.

## Alternatives considered
- Rules in prose only: an instruction can be ignored or misread; a sandbox cannot.
- A container or separate machine: stronger isolation, more setup; can be added later without changing this decision.

## Consequences
- The agent cannot read real keys, so live tests against real providers are run by the owner.
- A tool the agent needs from a new network host requires the owner to extend the allow list.
- Each clone must enable the hook once with `git config core.hooksPath .githooks`; CI catches a clone that did not.
- The owner should also enable GitHub secret scanning and push protection on the repository.
