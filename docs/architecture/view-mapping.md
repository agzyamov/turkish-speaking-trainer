# Mapping between views

How an element in one view corresponds to elements in the others.

| Runtime component ([cc-runtime](views/cc-runtime.md)) | Modules ([decomposition](views/module-decomposition.md)) | Repository location ([implementation](views/implementation.md)) | Runs on ([deployment](views/deployment.md)) |
|---|---|---|---|
| Web app | all frontend modules | `frontend/src` | Vercel static project, learner's browser |
| Android app | all frontend modules + Capacitor project | `frontend/src`, `frontend/android` | Learner's phone |
| Backend function | all backend modules | `backend/app` | Vercel Python function |
| PostgreSQL | `models`, `db`, migrations | `backend/app/models`, `backend/alembic` | Supabase |
| Claude API | Claude adapter behind the Structured AI port | `backend/app/services` | Anthropic |
| ElevenLabs Scribe | ElevenLabs adapter behind the Transcription port | `backend/app/services` | ElevenLabs |

| Quality requirement ([overview](system-overview.md)) | Constraints | Where it is realised |
|---|---|---|
| Q-1 monthly cost ceiling | C-09, C-11 | [budget-guard](interfaces/budget-guard.md), [voice answer flow](views/cc-voice-answer-flow.md) |
| Q-2 per-user fairness | C-10 | routers marked AI in [rest-api](interfaces/rest-api.md) |
| Q-3 audio privacy | C-06 | transcription service |
| Q-4 key secrecy | C-07, C-08, C-26 to C-28 | deployment configuration, secret scanning, agent sandbox |
| Q-5 replaceable providers | C-04, C-11 | [provider-ports](interfaces/provider-ports.md), [layers](views/module-layered.md) |
| Q-6 validated model output | C-12, C-15 | adapters and `schemas/` |
| Q-10 consistent bilingual interface | C-19, C-21 | `shared/ui`, `shared/i18n` |
