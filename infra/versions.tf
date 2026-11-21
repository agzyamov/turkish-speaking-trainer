terraform {
  required_version = ">= 1.10"

  # State lives in HCP Terraform, never in git: it holds the provider keys (ADR-0010).
  # Organization and workspace come from TF_CLOUD_ORGANIZATION and TF_WORKSPACE. The workspace uses the
  # "Local" execution mode: plans and applies run in GitHub Actions, HCP Terraform only stores and locks state.
  cloud {}

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.27"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.11"
    }
  }
}

# Tokens come from the environment: VERCEL_API_TOKEN and SUPABASE_ACCESS_TOKEN.
provider "vercel" {
  team = var.vercel_team_id
}

provider "supabase" {}
