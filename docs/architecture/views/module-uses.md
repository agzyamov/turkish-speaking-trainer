# Module view: uses

Shows which backend modules depend on which for the main features. Use it to judge what a change can affect.

## Primary presentation

| Feature | Router | Services used | Provider port | Repositories |
|---|---|---|---|---|
| Start session, next exercise | `sessions.py` | `session_service`, `topic_service`, `exercise_generator`, `scheduler`, `word_hints` | Structured AI (custom topics only) | `training`, `catalog`, `custom_content` |
| Transcribe a spoken answer | `transcriptions.py` | `transcription_service`, `transcription_assistance`, text policy | Transcription; Structured AI (soft hints) | `transcriptions` |
| Grade an answer | `attempts.py` | `attempt_service`, `answer_analyzer`, `learner_model`, `review_service`, text policy | Structured AI (skipped on exact match) | `training`, `users` |
| Topics | `topics.py` | `topic_service`, `custom_content_policy` | Structured AI (title translation, normalisation) | `catalog`, `custom_content` |
| Review phrases, word hints | `review.py` | `review_service`, `word_hints`, `hint_alignment` | Structured AI (phrase preparation) | `training`, `custom_content` |
| Statistics | `statistics.py` | `statistics_service` | none | `training` |
| Feedback | `feedback.py` | `feedback`, `notifications` | Transcription (voice feedback) | `feedback` |
| Payments | `payments.py` | `payments`, `notifications` | none | `payments` |
| Auth and profile | `auth.py` | `auth_service`, `review_login` | none | `users` |
| Admin debugging | `model_debug.py` | `model_debug`, `debug_mode`, `transcription_settings` | none | `model_debug` |

Every row with a provider port also uses the **budget guard** and the **daily quota** once Phase 2 lands. Today only "Grade an answer" checks the quota and nothing checks a budget.

## Element catalog

See [module-decomposition.md](module-decomposition.md).

## Context

The client reaches these features only through the routers listed.

## Variability guide

A feature gains or loses AI use by which port its service calls. Adding AI use to a feature that has none adds an AI entry point, which must be covered by the guard and quota (C-09, C-10).

## Rationale

The table is the checklist for cost control: the seven AI entry points are exactly the rows with a provider port.
