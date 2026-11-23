locals {
  frontend_url = "https://${var.frontend_host}"
  api_url      = "https://${var.api_host}"
  supabase_url = "https://${var.supabase_project_ref}.supabase.co"

  # Only the production web origin may call the API; there are no preview deployments (ADR-0010).
  cors_origin_regex = "https://${replace(var.frontend_host, ".", "\\.")}"

  # Hosts on vercel.app come with the project; any other host is a custom domain Terraform attaches.
  custom_frontend_domain = endswith(var.frontend_host, ".vercel.app") ? [] : [var.frontend_host]

  everywhere = ["production", "preview"]
}

# --- Vercel projects -----------------------------------------------------------------------------
# No git connection: deployments come only from the CI deploy job after the owner approves it (ADR-0010).

resource "vercel_project" "frontend" {
  name           = var.frontend_project_name
  framework      = "vite"
  root_directory = "frontend"
}

resource "vercel_project" "backend" {
  name           = var.backend_project_name
  framework      = "fastapi" # finds the app in app/main.py; without it Vercel looks only in api/
  root_directory = "backend"
  # Next to the Supabase database (Ireland, eu-west-1): every request makes several database round trips.
  resource_config = {
    function_default_regions = ["dub1"]
  }
}

import {
  for_each = var.existing_frontend_project_id == "" ? toset([]) : toset([var.existing_frontend_project_id])
  to       = vercel_project.frontend
  id       = "${var.vercel_team_id}/${each.value}"
}

import {
  for_each = var.existing_backend_project_id == "" ? toset([]) : toset([var.existing_backend_project_id])
  to       = vercel_project.backend
  id       = "${var.vercel_team_id}/${each.value}"
}

resource "vercel_project_domain" "frontend" {
  for_each   = toset(local.custom_frontend_domain)
  project_id = vercel_project.frontend.id
  domain     = each.value
}

locals {
  # name => [value, targets, sensitive]
  frontend_env = {
    VITE_API_BASE_URL             = [local.api_url, local.everywhere, false]
    VITE_SUPABASE_URL             = [local.supabase_url, local.everywhere, false]
    VITE_SUPABASE_PUBLISHABLE_KEY = [var.supabase_publishable_key, local.everywhere, false]
    VITE_SUPPORT_EMAIL            = [var.support_email, local.everywhere, false]
    VITE_EMAIL_OTP_ENABLED        = ["false", local.everywhere, false]
    # Production only, so previews never offer their own preview link for sharing.
    VITE_PUBLIC_APP_URL = ["${local.frontend_url}/", ["production"], false]
  }

  # Keys are production-only: a preview of the backend has no database and cannot spend AI credit.
  backend_env = merge({ for k, v in var.extra_backend_env : k => [v, local.everywhere, false] }, {
    APP_ENV                   = ["production", local.everywhere, false]
    DATABASE_URL              = [var.database_url, ["production"], true]
    SUPABASE_URL              = [local.supabase_url, local.everywhere, false]
    SUPABASE_PUBLISHABLE_KEY  = [var.supabase_publishable_key, local.everywhere, false]
    CORS_ALLOWED_ORIGIN_REGEX = [local.cors_origin_regex, local.everywhere, false]
    ADMIN_EMAILS              = [var.admin_emails, local.everywhere, true]
    BRAND_NAME                = ["TurkTalk", local.everywhere, false]
    PUBLIC_APP_URL            = [local.frontend_url, local.everywhere, false]
    ANTHROPIC_API_KEY         = [var.anthropic_api_key, ["production"], true]
    ANTHROPIC_GRADING_MODEL   = [var.anthropic_grading_model, local.everywhere, false]
    ANTHROPIC_UTILITY_MODEL   = [var.anthropic_utility_model, local.everywhere, false]
    ELEVENLABS_API_KEY        = [var.elevenlabs_api_key, ["production"], true]
    ELEVENLABS_STT_MODEL      = [var.elevenlabs_stt_model, local.everywhere, false]
    TARGET_LANGUAGE_CODE      = ["tr", local.everywhere, false]
    AI_MONTHLY_BUDGET_USD     = [tostring(var.ai_monthly_budget_usd), local.everywhere, false]
    AI_PRICE_TABLE            = [jsonencode(var.ai_price_table), local.everywhere, false]
    }, var.review_login_email == "" ? {} : {
    # Store reviewers sign in with the alias "turktalkreview"; the password lives only in Supabase.
    REVIEW_LOGIN_EMAIL = [var.review_login_email, ["production"], true]
    }, var.telegram_bot_token == "" ? {} : {
    TELEGRAM_BOT_TOKEN = [var.telegram_bot_token, ["production"], true]
    TELEGRAM_CHAT_ID   = [var.telegram_chat_id, ["production"], false]
  })
}

resource "vercel_project_environment_variables" "frontend" {
  project_id = vercel_project.frontend.id
  variables  = [for key, v in local.frontend_env : { key = key, value = v[0], target = v[1], sensitive = v[2] }]
}

resource "vercel_project_environment_variables" "backend" {
  project_id = vercel_project.backend.id
  variables  = [for key, v in local.backend_env : { key = key, value = v[0], target = v[1], sensitive = v[2] }]
}

# --- Supabase Auth -------------------------------------------------------------------------------
# The project (database, region, password) is created by hand; Terraform owns its sign-in settings.

resource "supabase_settings" "auth" {
  project_ref = var.supabase_project_ref
  # sensitive(): the JSON carries the Google and Apple secrets and must never print in public CI logs.
  auth = sensitive(jsonencode(merge({
    site_url = local.frontend_url
    uri_allow_list = join(",", [
      "${local.frontend_url}/",
      "${local.frontend_url}/app",
      "com.turktalk.trainer://auth/callback",
    ])
    external_google_enabled   = true
    external_google_client_id = var.google_client_id
    external_google_secret    = var.google_client_secret
    # Sign in with Apple for the iOS app (ADR-0013); off until the owner sets the Services ID.
    # A list expanded into merge(), not `cond ? {} : {...}`: the conditional would coerce both
    # branches to map(string) and send external_apple_enabled as the string "true".
    }, [for _ in(var.apple_client_id == "" ? [] : [1]) : {
      external_apple_enabled   = true
      external_apple_client_id = var.apple_client_id
      external_apple_secret    = var.apple_secret
  }]...)))

  lifecycle {
    precondition {
      condition     = var.apple_client_id == "" || var.apple_secret != ""
      error_message = "APPLE_CLIENT_ID is set but the production secret APPLE_SECRET is empty; Sign in with Apple would fail."
    }
  }
}
