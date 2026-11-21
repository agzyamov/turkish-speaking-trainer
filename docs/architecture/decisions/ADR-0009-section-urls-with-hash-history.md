# ADR-0009: Section URLs with hash history

- Status: Accepted, pending the owner's confirmation (users of the deployed app will see the new URLs)
- Date: 2026-11-21
- Decided by: the agent, under the owner's standing instruction to finish Phase 4 without asking ("го до конца уже"); the owner can revisit it at the hosting change in Phase 5

## Context

ADR-0003 plans TanStack Router. The app's sections (practice, statistics with its phrase page, Premium, settings, admin) were plain React state, so a section had no URL, a reload always opened practice, and the browser's Back button left the app.

The hosting routes in `frontend/vercel.json` are explicit: `/app` and the legal pages are rewritten to `index.html`; any other path returns 404. Path URLs such as `/app/statistics` would need new hosting routes, and changing hosted configuration needs the owner (AGENTS.md section 3). The native Android app loads `index.html` from the device, where path URLs do not apply, and moves between panels with a horizontal pager.

## Decision

- TanStack Router (`frontend/src/appRouter.tsx`) holds the current section as its location; `useSection()` (`frontend/src/useSection.ts`) reads it and navigates. TrainerApp still renders every section itself; routes have no components.
- The browser uses **hash history**: `/app#/statistics`, `/app#/statistics/phrases`, `/app#/premium`, `/app#/settings`, `/app#/admin`; `/app` (no hash) is practice. No hosting route changes.
- The native Android app uses **memory history**; its pager still decides the visible panel, and nothing in the device URL changes.
- One router per signed-in account (created under the account-keyed provider), like the query cache.
- Leaving practice by any route (header, browser Back, a link) stops a recording in progress.
- The admin section exists only for administrators: a link to it opens practice for everyone else (the backend refuses the data anyway).
- On Android the pager owns the panels and the statistics page is local state, so the device's in-memory location does not decide what is shown.
- The legal pages keep their real paths (`/privacy`, `/terms`, `/delete-account`), checked before the router.

## Consequences

- Sections can be linked and survive a reload; the browser's Back and Forward move between sections.
- Hash URLs are less clean than paths. Moving to path URLs later means adding hosting routes for each section (owner decision) and switching `createHashHistory` to `createBrowserHistory`; the route tree and `useSection()` stay as they are.
- Topic chooser versus practice on a phone is still panel state, not a route.

## Alternatives considered

- **Path history now:** cleaner URLs, but needs a hosting change before it works on the deployed site; deep links would 404 until then.
- **Memory history everywhere:** no URL change at all, so none of the benefits.
