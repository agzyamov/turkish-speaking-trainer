#!/usr/bin/env bash
# Offline Vercel build of one project, with the framework and root directory declared in infra/main.tf.
# Catches build failures (framework preset, functions patterns, build command) before the production job.
# Needs no token and deploys nothing. VERCEL_ENV=preview, so the backend build skips the database release.
# Usage: scripts/vercel-build-check.sh frontend|backend   (run on Linux: Python wheels are fetched for Linux)
set -euo pipefail

project="${1:?usage: $0 frontend|backend}"
root="$(cd "$(dirname "$0")/.." && pwd)"
# Same version as .github/workflows/deploy.yml; VERCEL_CMD overrides the launcher (for a broken local npx).
vercel_cmd="${VERCEL_CMD:-npx --yes vercel@66.6.0}"

block="$(awk -v name="\"$project\"" '
  $1 == "resource" && $2 == "\"vercel_project\"" && $3 == name { inside = 1; next }
  inside && /^}/ { exit }
  inside { print }
' "$root/infra/main.tf")"
[ -n "$block" ] || { echo "vercel_project.$project not found in infra/main.tf" >&2; exit 1; }

value() { printf '%s\n' "$block" | sed -nE "s/^  $1 *= *\"([^\"]*)\".*/\1/p" | head -1; }
framework="$(value framework)"
root_directory="$(value root_directory)"
[ -n "$root_directory" ] || { echo "vercel_project.$project has no root_directory" >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git -C "$root" ls-files -z | (cd "$root" && xargs -0 tar -cf - --no-recursion) | tar -xf - -C "$work"
mkdir -p "$work/.vercel"
if [ -n "$framework" ]; then framework_json="\"$framework\""; else framework_json=null; fi
printf '{"projectId":"prj_offline","orgId":"team_offline","settings":{"framework":%s,"rootDirectory":"%s"}}\n' \
  "$framework_json" "$root_directory" > "$work/.vercel/project.json"

echo "vercel build: $project (framework=${framework:-none}, root=$root_directory)"
cd "$work"
# The hosted frontend build requires an absolute HTTPS API URL (frontend/build/androidEnvironment.ts).
VERCEL_ENV=preview \
VITE_API_BASE_URL="https://api.example.invalid" \
VITE_SUPABASE_URL="https://example.invalid" \
VITE_SUPABASE_PUBLISHABLE_KEY="offline-build" \
  $vercel_cmd build --yes
