# Setting up TurkTalk on the owner's own infrastructure

What the owner does to run the app on their own accounts (Phase 5). The agent cannot do these steps: they need the owner's accounts, keys and deploy rights (AGENTS.md section 3). Values never go into the repository or a chat; only variable names appear here. Read `docs/architecture/views/deployment.md` for the shape of the deployment.

Recommended split: **Supabase** for the database and sign-in, **two Vercel projects** for the frontend and the FastAPI backend. Supabase cannot run the Python backend (its functions are Deno/TypeScript) or host the single-page app with rewrites; Vercel does both.

## 1. Accounts and keys

| Service | What to create | Where its value goes |
|---|---|---|
| Supabase | A project (region close to the learners). Enable Google and email (OTP) sign-in. | Backend `DATABASE_URL` (transaction pooler URL), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; frontend `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Google Cloud | An OAuth client (web). Authorised redirect: the Supabase callback URL shown in Supabase → Auth → Providers → Google. | Entered in Supabase, not in this repo |
| Supabase → Auth → URL configuration | Site URL: the frontend address. Redirect URLs: `https://<frontend>/`, `https://<frontend>/app`, and for Android `com.turktalk.trainer://auth/callback`. Email-code template: `docs/email-code.html`. | Supabase dashboard |
| Anthropic | An API key in a dedicated workspace. **Set a $25 monthly spend limit on that workspace** (second safety net after the app's own cap, ADR-0002). | Backend `ANTHROPIC_API_KEY` |
| ElevenLabs | An API key. **Set a usage limit** on the account. | Backend `ELEVENLABS_API_KEY` |
| Resend (optional) | SMTP for Supabase email codes, if email sign-in is wanted. | Entered in Supabase; then frontend `VITE_EMAIL_OTP_ENABLED=true` |
| Telegram (optional) | A bot and a chat for admin notifications. | Backend `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |

## 2. Backend Vercel project (`backend/`)

Set every variable listed in the root `.env.example`. The ones that must be chosen by the owner:

- `APP_ENV=production`
- `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` (model ids, prices and budget have working defaults in `.env.example`; keep `AI_MONTHLY_BUDGET_USD` at 25 or lower)
- `CORS_ALLOWED_ORIGIN_REGEX`: a pattern matching the frontend's production and preview origins. The default only matches a Vercel project named `turktalk` (`turktalk.vercel.app`, `turktalk-*.vercel.app`); add a custom domain to the pattern
- `ADMIN_EMAILS`: the owner's sign-in address
- `BRAND_NAME` (default TurkTalk), `PUBLIC_APP_URL` (the frontend address, once there is a domain)
- `REVIEW_LOGIN_USERNAME`, `REVIEW_LOGIN_EMAIL`: only if a store review account is needed
- `MANUAL_PAYMENTS`: only if manual Premium payments are offered (see `docs/manual-premium-payments-2026-10-26.md`)

Then run the migrations against the new database once, from a machine with `DATABASE_URL` set: `cd backend && uv run alembic upgrade head`, and seed the catalogue: `uv run python -m app.db.cli seed`.

## 3. Frontend Vercel project (`frontend/`)

- `VITE_API_BASE_URL`: the backend project's URL (required: there is no `/api` proxy, and a Vercel build fails without an HTTPS value)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_PUBLIC_APP_URL`: the public address for "Share app" (set it in Production only, so previews do not share preview links)
- `VITE_SUPPORT_EMAIL`: the mailbox on the account-deletion page (required before launch; the page shows a placeholder without it)
- `VITE_EMAIL_OTP_ENABLED`: `true` only after email sign-in is configured in Supabase

`frontend/vercel.json` serves the landing page at `/`, the app at `/app` and the legal pages; it has no API proxy, so the backend's `CORS_ALLOWED_ORIGIN_REGEX` must match the frontend's origins. Section URLs use hash history (ADR-0009), so no further routes are needed.

## 4. Before going public

- Review the privacy, terms and account-deletion pages (`frontend/src/LegalPage.tsx`): they name the operator's processors and promises and are a draft.
- Check the name TurkTalk for availability and trademarks (ADR-0005), then change it in `frontend/src/shared/brand.ts` and `BRAND_NAME` if needed.
- Android: the package and deep-link scheme are `com.turktalk.trainer`. Before a build: fill `frontend/.env.android` with the public backend and Supabase values, add `com.turktalk.trainer://auth/callback` to Supabase → Auth → URL configuration → Redirect URLs, run `pnpm android:sync` (it builds in Android mode and refuses empty or local URLs; plain `npx cap sync` would copy a web build pointing at `10.0.2.2`), and create a new upload key (the old product's key and scripts are named `serbotalk-upload`). Icons and the store listing are still the previous product's. Builds happen only on the owner's instruction (C-24).
- Run the live smoke test from the plan with the app budget set to $1: speak an answer, see the transcript and grade, check the spend ledger and the admin usage view, then force the paused state.
