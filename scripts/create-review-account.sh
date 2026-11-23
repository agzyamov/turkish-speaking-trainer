#!/usr/bin/env bash
# Creates, once, the account that app-store reviewers and the automated app tests sign in with
# (the "review sign-in", username turktalkreview). Run by the owner on macOS:
#
#   scripts/create-review-account.sh <email>
#
# - generates a random password that is never printed;
# - keeps it in the login Keychain (item "turktalk-review-login") for local test runs;
# - registers the email in Supabase Auth through the public sign-up endpoint;
# - stores the password as the repository secret REVIEW_LOGIN_PASSWORD and the email as the repository
#   secret REVIEW_LOGIN_EMAIL (automated app tests) and as the production secret REVIEW_LOGIN_EMAIL (the
#   backend's review sign-in). The email is kept out of the repository and out of public logs.
#
# Afterwards: open the confirmation email Supabase sends to that address, then approve the next
# production deploy so the backend picks up REVIEW_LOGIN_EMAIL. Needs gh (signed in), curl, jq, openssl.
# Use an address that is not in ADMIN_EMAILS.
set -euo pipefail
set +x

email="${1:?usage: $0 <email>  (an address you can open, for the confirmation link)}"
service="turktalk-review-login"

if security find-generic-password -s "$service" >/dev/null 2>&1; then
  echo "A review account password already exists in the Keychain ($service); nothing done." >&2
  echo "To start over, delete that Keychain item and the Supabase user first." >&2
  exit 1
fi

ref="$(gh variable get SUPABASE_PROJECT_REF)"
key="$(gh variable get SUPABASE_PUBLISHABLE_KEY)"
[ -n "$ref" ] && [ -n "$key" ] || { echo "Repository variables SUPABASE_PROJECT_REF / SUPABASE_PUBLISHABLE_KEY are missing." >&2; exit 1; }

password="$(openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-40)"

# Sign up first; nothing is stored unless Supabase created a new user. With email confirmation on, Supabase
# answers 200 for an address that already exists too, with an empty "identities" list, so that is refused.
body="$(jq -n --arg email "$email" --arg password "$password" '{email: $email, password: $password}' |
  curl -sS -w '\n%{http_code}' -X POST "https://$ref.supabase.co/auth/v1/signup" \
    -H "apikey: $key" -H "Content-Type: application/json" --data-binary @-)"
status="${body##*$'\n'}"
case "$status" in
  2??) ;;
  *) echo "Supabase sign-up failed with HTTP $status; nothing stored." >&2; exit 1 ;;
esac
identities="$(printf '%s' "${body%$'\n'*}" | jq '(.identities // .user.identities // []) | length')"
if [ "$identities" = 0 ]; then
  echo "That address is already registered in Supabase; nothing stored. Use another address or delete that user." >&2
  exit 1
fi

# Through security's interactive mode, so the password is not in any process's arguments.
printf 'add-generic-password -s %s -a %s -w %s\n' "$service" "$email" "$password" | security -i >/dev/null
printf '%s' "$password" | gh secret set REVIEW_LOGIN_PASSWORD
printf '%s' "$email" | gh secret set REVIEW_LOGIN_EMAIL
printf '%s' "$email" | gh secret set REVIEW_LOGIN_EMAIL --env production
unset password

echo "Review account registered: $email"
echo "Next: confirm the email Supabase sent to that address, then approve the next production deploy."
