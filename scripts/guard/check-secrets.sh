#!/usr/bin/env bash
# Blocks secrets from entering this public repository.
#
#   check-secrets.sh            scan what is staged for commit (used by the pre-commit hook)
#   check-secrets.sh --all      scan the working directory as it is now (CI and audits)
#   check-secrets.sh --history  scan the whole git history
#
# Exit 0 = clean, non-zero = findings or scanner missing. Secret values are redacted in output.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
mode="${1:-staged}"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "secret-scan: gitleaks is not installed (https://github.com/gitleaks/gitleaks). Refusing to continue." >&2
  exit 2
fi

# File names that must never be tracked, whatever they contain.
forbidden='(^|/)\.env(\.[^/]*)?$|\.(jks|keystore|pem|p12|pfx)$|(^|/)id_(rsa|ed25519)$'
allowed='(^|/)\.env\.(example|android)$'

if [ "$mode" = "staged" ]; then
  names=$(git diff --cached --name-only --diff-filter=ACMR)
else
  names=$(git ls-files)
fi
bad=$(printf '%s\n' "$names" | grep -E "$forbidden" | grep -Ev "$allowed" || true)
if [ -n "$bad" ]; then
  echo "secret-scan: these file types must not be committed:" >&2
  printf '  %s\n' $bad >&2
  exit 1
fi

common=(--redact --no-banner --config .gitleaks.toml)
case "$mode" in
  staged)    gitleaks git --staged "${common[@]}" ;;
  --all)     gitleaks dir . "${common[@]}" ;;
  --history) gitleaks git "${common[@]}" ;;
  *) echo "usage: check-secrets.sh [--all|--history]" >&2; exit 2 ;;
esac
