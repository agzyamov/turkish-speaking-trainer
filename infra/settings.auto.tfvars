# Non-secret production settings, versioned so every change is reviewed in a pull request (ADR-0010).
# Hosts and account ids are GitHub variables; secrets are secrets of the GitHub "production" environment.

# --- AI (ADR-0001, ADR-0002) ----------------------------------------------------------------------
# CHECK PRICES AGAINST THE PROVIDERS' CURRENT PRICING PAGES BEFORE GOING LIVE. A model without a price is refused.
ai_monthly_budget_usd   = 25
anthropic_grading_model = "claude-sonnet-5-5"
anthropic_utility_model = "claude-haiku-5-5"
# Scribe v2, the newest batch model (recorded answers are uploaded, so not the realtime variant).
elevenlabs_stt_model = "scribe_v2"
ai_price_table = {
  "claude-sonnet-5-5" = { input_per_mtok = 2, output_per_mtok = 10, cache_write_per_mtok = 2.5, cache_read_per_mtok = 0.1 }
  "claude-haiku-5-5"  = { input_per_mtok = 0.1, output_per_mtok = 0.5, cache_write_per_mtok = 0.125, cache_read_per_mtok = 0.01 }
  # Published as $0.20-0.22 per hour of audio, but ElevenLabs' own FAQ still says "from $0.40": count the
  # higher figure, so the spend cap errs on the safe side.
  "scribe_v2" = { audio_per_minute = 0.0067 }
}

# --- Other backend settings (names as in .env.example; defaults in backend/app/config.py) -----------
extra_backend_env = {
  AI_FREE_USER_DAILY_BUDGET_USD    = "1.0"
  AI_PREMIUM_USER_DAILY_BUDGET_USD = "3.0"
  FREE_DAILY_PHRASE_LIMIT          = "20"
  PREMIUM_DAILY_PHRASE_LIMIT       = "100"
}
