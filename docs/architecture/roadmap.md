# Conversion roadmap

The codebase started as SerboTalk, a Russian/English → Serbian trainer running on OpenAI. It is being converted to a Turkish trainer running on Claude and ElevenLabs. "Planned (Phase N)" in the views refers to these phases.

| Phase | Outcome | Status |
|---|---|---|
| 0 | Architecture documentation and agent guardrails (this directory, `AGENTS.md`, `CLAUDE.md`, agent sandbox, secret scanning) | Done |
| 1 | Tooling baseline: `uv` + lockfile, Ruff, Pyright, Biome, pinned frontend dependencies, `justfile`, GitHub Actions, architecture checks | In progress: backend done; frontend pending |
| 2 | Claude and ElevenLabs adapters behind the provider ports; usage ledger; budget guard with a $25 monthly cap on every AI entry point | Backend done and tested with fakes; not yet run against the live providers. Legacy OpenAI adapters and their tests are still present and are removed in Phase 3. Client "budget spent" screen pending (Phase 4) |
| 3 | Turkish language: text policy, prompts, `_sr` → `_tr` rename, re-authored content, grading eval | Not started |
| 4 | Frontend restructure: Tailwind v4 tokens, shadcn/ui, TanStack Router and Query, i18next, `App.tsx` split by feature | Not started |
| 5 | Rebrand to the working name TurkTalk and move to the owner's own infrastructure | Not started |
| 6 | UX verification with the Impeccable skill, accessibility checks and screenshot baselines | Not started |

Update the Status column as phases land.
