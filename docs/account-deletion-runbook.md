# Account deletion runbook

The public page `/delete-account` (RU/EN) tells users to write from their account's email to the support address. The operator confirms the request and completes it within 7 days. Never delete another or an admin account on someone's request, and never ask for a password, a one-time code or a voice recording.

1. Get the confirmation from the account's email and find the exact Supabase user UUID. Keep the correspondence and any secret out of git and logs.
2. In a protected operator environment set `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key comes from Supabase and lives only in that environment: never in the frontend, the APK, command arguments or documents.
3. From `backend/` run `python scripts/delete_account.py --user-id UUID --confirmed-email EMAIL`. This is a dry run. Check that it targets the production project and the right email.
4. Repeat with `--execute`. This cannot be undone. An agent never runs it without the owner's confirmation for that specific account.
5. The tool first records a 30-day block on the old UUID, then checks the email and id in Supabase Auth, deletes the Auth identity, confirms the 404, and deletes the application user with its sessions, attempts, personal topics and phrases, words, settings, feedback, payment requests, Premium and debug data.
6. If the network fails or the identity does not match, the deletion is not complete. The UUID stays blocked and the data is kept for another try. Fix the cause and repeat the same confirmed request; an Auth 404 on the repeat is expected. Tell the user it is done only after the final successful check.

The block stores a SHA-256 of the UUID, no email or content. It stops an old, locally validated JWT from recreating data. After 30 days the block lapses; expired markers are removed on the next deletion or when the same UUID comes back. A new sign-up gets a new profile with a new UUID.

Provider backups and logs follow their own retention; they are not claimed to be erased instantly. Payment records outside the app follow their own obligations, not this cascade.
