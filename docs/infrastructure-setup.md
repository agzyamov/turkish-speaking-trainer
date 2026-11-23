# Setting up TurkTalk on the owner's own infrastructure

What the owner does once so that CI can manage and deploy TurkTalk (Phase 5, ADR-0010). Values never go into the repository or a chat; only names appear here. The shape of the deployment is in `docs/architecture/views/deployment.md`.

- **Supabase**: database and sign-in. The project is made by hand; Terraform manages its Auth settings.
- **Vercel**: two projects, the frontend (`frontend/`) and the FastAPI backend (`backend/`). Terraform creates or adopts them and sets every variable.
- **Terraform state** lives in the same Supabase Postgres, schema `terraform_state` (it contains keys, so it never goes into git). No extra service.
- **GitHub Actions**: validates Terraform on pull requests; after CI passes on `main` and the owner approves, it plans, applies and deploys.

## 1. Accounts (done)

| Service | What exists |
|---|---|
| Supabase | A project. Note its **reference** (the subdomain of its URL), its **publishable key**, the **transaction pooler URL** (for the backend) and the **session pooler URL** (for the Terraform state). |
| Google Cloud | An OAuth web client. Authorised redirect URI: the Supabase callback URL shown in Supabase → Auth → Providers → Google. Note the **client id** and **client secret**. |
| Anthropic | An API key in a dedicated workspace with a **$25 monthly spend limit** (backstop to the app's cap, ADR-0002). |
| ElevenLabs | An API key with a **usage limit**. Note the current Scribe model id. |

## 2. Vercel projects and tokens

1. Create two empty Vercel projects **without connecting git** (this deployment: `turktalk-app` and `turktalk-api`). If they already exist and are connected to git, Terraform will disconnect them. Delete any environment variables set on them by hand: Terraform creates every variable and fails on duplicates.
2. For each project note its **id** (Project → Settings → General, `prj_…`) and its **production domain** (Project → Settings → Domains, e.g. `turktalk-abc.vercel.app`). Do not assume `<name>.vercel.app`: `turktalk.vercel.app` already belongs to someone else.
3. Team Settings → General → **Team ID** (`team_…`).
4. Account Settings → Tokens: a token scoped to that team → `VERCEL_API_TOKEN`.
5. Supabase → Account → Access Tokens: a personal access token → `SUPABASE_ACCESS_TOKEN`.

## 3. GitHub repository settings

**Environment.** Settings → Environments → New environment `production`:
- Required reviewers: the owner. Every production deploy waits for "Approve".
- Deployment branches and tags: `main` only.

**Secrets: only as secrets of the `production` environment** (Settings → Environments → production → Environment secrets). Never as repository secrets: those are readable by any branch's workflow without an approval.

| Secret | Value |
|---|---|
| `TERRAFORM_STATE_DATABASE_URL` | Supabase **session pooler** URL (Connect → Session pooler, port 5432) with `?sslmode=require`. Terraform creates the `terraform_state` schema on first run |
| `VERCEL_API_TOKEN` | Vercel token |
| `SUPABASE_ACCESS_TOKEN` | Supabase access token |
| `DATABASE_URL` | Supabase transaction pooler URL |
| `ANTHROPIC_API_KEY` | Anthropic key |
| `ELEVENLABS_API_KEY` | ElevenLabs key |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ADMIN_EMAILS` | The owner's sign-in email (comma-separated if several) |
| `REVIEW_LOGIN_EMAIL` | Optional. Email of a Supabase user created for Google Play reviewers: Authentication → Users → Add user, with a long random password and "Auto Confirm User" ticked; it must not be one of `ADMIN_EMAILS`. When set, "Review access" on the sign-in screen accepts the username `turktalkreview` and that user's password; when empty it answers "unavailable". A secret so the address stays out of public logs |
| `TELEGRAM_BOT_TOKEN` | Optional, admin notifications |

**Variables** (Settings → Secrets and variables → Actions → Variables; not secret, visible in public logs):

| Variable | Value |
|---|---|
| `VERCEL_TEAM_ID` | `team_…` |
| `EXISTING_FRONTEND_PROJECT_ID`, `EXISTING_BACKEND_PROJECT_ID` | The two `prj_…` ids |
| `FRONTEND_PROJECT_NAME`, `BACKEND_PROJECT_NAME` | The projects' current names (defaults `turktalk-app`, `turktalk-api`; a different value renames the project) |
| `FRONTEND_HOST`, `API_HOST` | The production domains from step 2.2, host only (no `https://`). A custom frontend domain is attached by Terraform; DNS is set at the registrar |
| `SUPABASE_PROJECT_REF`, `SUPABASE_PUBLISHABLE_KEY` | From the Supabase project |
| `GOOGLE_CLIENT_ID` | Google OAuth client id |
| `SUPPORT_EMAIL` | Mailbox shown on the account-deletion page |
| `TELEGRAM_CHAT_ID` | Optional |

With the GitHub CLI, from the owner's own terminal (it asks for each value without echoing it): `gh secret set ANTHROPIC_API_KEY --env production`, `gh variable set SUPABASE_PROJECT_REF`, and so on.

**Settings in the repository.** In `infra/settings.auto.tfvars` set `elevenlabs_stt_model` to the current Scribe model id and add its `audio_per_minute` price to `ai_price_table`; the plan fails while it is empty. The same file holds the models, prices, the monthly budget (at most 25 USD) and other backend settings (`extra_backend_env`, names as in `.env.example`).

## 4. Deployments

1. Pull requests touching `infra/` get **Deploy → Terraform validate** (format and validation, no secrets). Pull requests touching `backend/`, `frontend/` or `infra/main.tf` get **CI → Vercel build** for both projects: an offline `vercel build` with the framework and root directory from `infra/main.tf`, so a broken build fails there and not in production.
2. After a merge, when CI passes on `main`, **Deploy → Production** waits: Actions → the run → Review deployments → Approve (or Reject to skip this push).
3. The job prints the Terraform plan and applies exactly it, deploys the backend (its production build runs the migrations and the catalogue seed), checks `/api/health`, deploys the frontend and checks `/app`, then tags the deployed commit and publishes the GitHub release when the commits call for a new version (ADR-0011). The environment link on the run opens the site. Read the first plan carefully: adopting hand-made projects may change their settings (for example the framework preset of the backend).

To deploy without a code change: Actions → Deploy → Run workflow (still waits for approval).

Terraform owns both Vercel projects and all their variables, the custom domain, and Supabase Auth: site URL, redirect URLs (`https://<frontend>/`, `https://<frontend>/app`, `com.turktalk.trainer://auth/callback`) and the Google provider. Change these in `infra/`, not in dashboards: the next apply puts the declared values back. CORS admits only the production web origin.

Still by hand in Supabase: the email-code template (`docs/email-code.html`) and SMTP, if email sign-in is wanted.

## 5. Before going public

- Review the privacy, terms and account-deletion pages (`frontend/src/LegalPage.tsx`): they name the operator's processors and promises and are a draft.
- Check the name TurkTalk for availability and trademarks (ADR-0005), then change it in `frontend/src/shared/brand.ts` and `BRAND_NAME` (in `infra/main.tf`) if needed.
- Android: the package and deep-link scheme are `com.turktalk.trainer` (its redirect URL is already in Terraform). `frontend/.env.android` holds the public backend and Supabase values of this deployment (the same as the repository variables); the Android version starts at `1.0`, code 1. Before a build: run `pnpm android:sync` (it builds in Android mode and refuses empty or local URLs; plain `npx cap sync` would copy a web build pointing at `10.0.2.2`), and create the upload key once, outside the repository: on macOS the owner runs `scripts/create-android-upload-key.sh` (key in `~/.android/turktalk-upload`, password in the login Keychain); on Windows `scripts/build-android-play-aab.ps1` creates it on first run. Both use the alias `turktalk-upload`. To build on macOS run `scripts/build-android.sh apk` (test APK for a phone) or `scripts/build-android.sh aab` (bundle for Google Play, signed with the upload key; the password is read from the Keychain and never printed). It needs pnpm, a JDK 21 and the Android SDK, and writes to `artifacts/`. The web icons (`frontend/public/favicon.png`, `apple-touch-icon.png`) show the new tea-glass logo. The Android launcher icons and splash screens under `frontend/android/app/src/main/res` show it too. The Google Play listing is not created yet. Builds happen only on the owner's instruction (C-24).
- Live smoke test: set `ai_monthly_budget_usd = 1` in `infra/settings.auto.tfvars`, deploy, speak an answer, see the transcript and grade, check the spend ledger and the admin usage view, force the paused state, then set it back to 25.
