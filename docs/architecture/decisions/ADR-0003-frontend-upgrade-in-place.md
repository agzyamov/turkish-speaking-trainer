# ADR-0003: Upgrade the frontend in place instead of rebuilding it

- Status: Accepted
- Date: 2026-11-20
- Decided by: product owner, on the agent's researched recommendation

## Context
The owner asked for the best current tooling and whether the frontend should be rebuilt. The frontend's frameworks (React 19, Vite 8, TypeScript strict, Capacitor 8) are current. Its structure is not: one 1,092-line component, global CSS with 196 distinct hardcoded colors, no router, no data layer, Russian strings used as translation keys.

## Decision
Keep the application and its logic. Replace the presentation layers inside it, one screen at a time:
- Tailwind v4 design tokens and shadcn/ui components on Radix primitives,
- TanStack Router and TanStack Query,
- i18next with stable keys,
- `App.tsx` split into feature modules.

Voice recording, the recording state machine and request-race handling are kept as they are.

## Amendment, 2026-11-20: new visual world and a display font

- Decided by: the agent, under the owner's standing instruction to decide without asking (owner may revise).
- The redesign follows Impeccable's process: a critique of the practice screen (19/40), then a direction from its concept-seed roll, built code-led and checked by its finish reviewer. The world is an Istanbul tea house in the evening: strong-tea ground, walnut surfaces, porcelain ink, tea-amber accent, tulip-glass gold for rewards, leaf green, pomegranate red, Bosphorus blue. Tokens live in `frontend/src/shared/styles/tokens.css`; DESIGN.md records the system.
- New runtime dependency `@fontsource/alegreya-sans` (OFL font files) for the phrase display face; it covers Cyrillic, Latin and Turkish, which Impeccable's own font fetcher (Latin only) does not. Three weights ship; browsers load only the subsets a page uses, but all subsets are in the Android bundle.
- During migration the practice card and Settings use the new world while the shell (header, topic list, statistics, premium) keeps the legacy navy stylesheet; those screens move next.

## Alternatives considered
- Rebuild from scratch: would choose the same frameworks, so gains nothing there, while discarding 43 unit test files and about 40 end-to-end specs that encode hard-won behaviour, at the same time the language conversion touches every string and type.
- Leave the structure alone: cheapest, but the single component cannot be changed safely and the styling cannot pass a design audit.

## Consequences
- Old and new styling coexist during migration; each migrated screen deletes its old CSS.
- Existing tests keep guarding behaviour throughout.
- The frontend layer rules in the layered view become enforceable only once the split is done.
