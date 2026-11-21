# ADR-0010: Infrastructure as code and production deployment from CI

- Status: Accepted
- Date: 2026-11-21
- Decided by: the owner ("Vercel and Supabase are fine… let's write Terraform right away and authorise CI to deploy everything"); state in HCP Terraform and deploys from main with the owner's approval were chosen by the owner from the agent's options

## Context

Phase 5 moves TurkTalk to the owner's own Vercel and Supabase accounts. Configuring them by hand leaves no record of what is set where, and a forgotten variable or redirect URL breaks sign-in or the API silently. The repository is public, and agents must not deploy or touch hosted configuration (C-25, AGENTS.md section 3).

## Decision

- **Terraform in `infra/`** describes the hosted configuration: the two Vercel projects (frontend `frontend/`, backend `backend/`), their environment variables, an optional custom domain, and Supabase Auth settings (site URL, redirect URLs, Google provider). The Supabase project itself (database, region, password) stays hand-made; Terraform does not own or destroy it. Projects created by hand are adopted through `import` blocks driven by `EXISTING_*_PROJECT_ID`. Production hosts are required inputs copied from Vercel, never derived from project names (`turktalk.vercel.app` already belongs to someone else).
- **State in HCP Terraform** (free tier, workspace in "Local" execution mode): state holds provider keys, so it never goes into git, artifacts or logs. HCP Terraform stores, encrypts and locks it; runs happen in GitHub Actions.
- **Secrets** are secrets of the GitHub `production` environment only, never repository secrets: environment protection gates only the secrets stored in that environment, so nothing (a branch workflow, a pull request) can read them before the owner approves. They reach Terraform as step-level `TF_VAR_*`; every secret variable is `sensitive`, so public Actions logs show `(sensitive)`. Hosts and account ids are GitHub variables; AI models, prices, the monthly budget and other backend settings are versioned in `infra/settings.auto.tfvars` and reviewed in pull requests. The budget variable refuses values above 25 USD (ADR-0002).
- **Deployment from CI** (`.github/workflows/deploy.yml`): a pull request touching `infra/` gets `fmt`/`validate` without secrets (no plan on pull requests: a plan needs the production credentials). After CI passes on a push to `main`, the `production` job waits for the owner's approval in the GitHub `production` environment, then prints a plan and applies exactly that plan, deploys the backend with the Vercel CLI (its production build runs migrations and the idempotent seed), checks `/api/health`, deploys the frontend and checks `/app`.
- Vercel projects are **not connected to git**: the approved CI job is the only path to production, so an unreviewed push cannot deploy.

## Consequences

- C-25 is met by the approval step: approving the `production` job is the owner's explicit instruction. Agents still never push, merge, approve or run `terraform apply` themselves.
- Adding or renaming a hosted variable is a code change in `infra/` with a reviewed plan.
- One more account (HCP Terraform) and a few tokens (`TF_API_TOKEN`, `VERCEL_API_TOKEN`, `SUPABASE_ACCESS_TOKEN`) that the owner creates and stores in GitHub secrets.
- Every push to `main`, documentation included, asks for an approval; rejecting it skips the deploy.
- The plan is visible only after approval, in the same run; drift made in dashboards is overwritten by it.
- Preview deployments are not produced automatically, and CORS admits only the production web origin; they can be added later as a separate job without production secrets.
- Supabase Auth settings drift if changed in the dashboard; the next apply restores the declared values.
