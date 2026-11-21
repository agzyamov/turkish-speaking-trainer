terraform {
  required_version = ">= 1.10"

  # State lives in the project's own Supabase Postgres, schema terraform_state, never in git: it holds the
  # provider keys (ADR-0010). The connection string comes from PG_CONN_STR (session pooler, port 5432: the
  # backend locks state with a session-level advisory lock, which the transaction pooler cannot hold).
  backend "pg" {
    schema_name = "terraform_state"
  }

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
