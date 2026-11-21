# --- Accounts and existing resources -------------------------------------------------------------

variable "vercel_team_id" {
  description = "Vercel team id (team_...), Team Settings -> General."
  type        = string

  validation {
    condition     = startswith(var.vercel_team_id, "team_")
    error_message = "vercel_team_id must be the Vercel team id (team_...)."
  }
}

variable "frontend_project_name" {
  description = "Vercel project for the web app and landing page (frontend/)."
  type        = string
  default     = "turktalk"
}

variable "backend_project_name" {
  description = "Vercel project for the FastAPI backend (backend/)."
  type        = string
  default     = "turktalk-api"
}

variable "existing_frontend_project_id" {
  description = "Id (prj_...) of a frontend project created by hand, to adopt it instead of creating one. Empty: create."
  type        = string
  default     = ""
}

variable "existing_backend_project_id" {
  description = "Id (prj_...) of a backend project created by hand, to adopt it instead of creating one. Empty: create."
  type        = string
  default     = ""
}

variable "frontend_host" {
  description = "Production host of the web app, copied from Vercel (Project -> Domains), e.g. turktalk-abc.vercel.app or a custom domain. No guessing from the project name: <name>.vercel.app may belong to someone else."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", var.frontend_host))
    error_message = "frontend_host must be a bare host name such as turktalk-abc.vercel.app (no https://, no path)."
  }
}

variable "api_host" {
  description = "Production host of the backend, copied from Vercel (Project -> Domains)."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", var.api_host))
    error_message = "api_host must be a bare host name such as turktalk-api-abc.vercel.app (no https://, no path)."
  }
}

variable "supabase_project_ref" {
  description = "Reference of the Supabase project (the subdomain of its URL). The project itself is created by hand."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{10,}$", var.supabase_project_ref))
    error_message = "supabase_project_ref must be the project reference, e.g. the subdomain of https://<ref>.supabase.co."
  }
}

variable "supabase_publishable_key" {
  description = "Supabase publishable key. Public by design (it ships in the web app), so not marked sensitive."
  type        = string
}

# --- Secrets (secrets of the GitHub "production" environment, passed as TF_VAR_*) ---------------

variable "database_url" {
  description = "Supabase transaction pooler URL for the backend."
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  type      = string
  sensitive = true
}

variable "elevenlabs_api_key" {
  type      = string
  sensitive = true
}

variable "google_client_id" {
  description = "Google OAuth web client id used by Supabase Auth."
  type        = string
}

variable "google_client_secret" {
  type      = string
  sensitive = true
}

variable "telegram_bot_token" {
  description = "Optional admin notifications."
  type        = string
  sensitive   = true
  default     = ""
}

variable "telegram_chat_id" {
  type    = string
  default = ""
}

# --- Product settings (reviewed in pull requests) ------------------------------------------------

variable "admin_emails" {
  description = "Comma-separated sign-in emails that get the admin role. Sensitive so plans in public CI logs hide it."
  type        = string
  sensitive   = true
}

variable "support_email" {
  description = "Mailbox shown on the account-deletion page."
  type        = string
}

variable "ai_monthly_budget_usd" {
  description = "Hard cap on AI spend per UTC month across both providers (ADR-0002)."
  type        = number
  default     = 25

  validation {
    condition     = var.ai_monthly_budget_usd >= 0 && var.ai_monthly_budget_usd <= 25
    error_message = "The AI budget must stay between 0 and 25 USD a month (ADR-0002); raising it is an owner decision recorded in an ADR."
  }
}

variable "anthropic_grading_model" {
  type    = string
  default = "claude-sonnet-5-5"
}

variable "anthropic_utility_model" {
  type    = string
  default = "claude-haiku-5-5"
}

variable "elevenlabs_stt_model" {
  description = "Scribe model id; confirm it in the ElevenLabs documentation and give it a price in ai_price_table."
  type        = string

  validation {
    condition     = length(trimspace(var.elevenlabs_stt_model)) > 0
    error_message = "Set elevenlabs_stt_model in infra/settings.auto.tfvars (and its audio_per_minute price)."
  }
}

variable "ai_price_table" {
  description = "USD prices per model, same shape as AI_PRICE_TABLE in .env.example. A model without a price is refused."
  type        = map(map(number))
}

variable "extra_backend_env" {
  description = "Further non-secret backend settings from .env.example (e.g. FREE_DAILY_PHRASE_LIMIT, MANUAL_PAYMENTS), name => value."
  type        = map(string)
  default     = {}
}
