#!/usr/bin/env bash
# Creates the Android upload key for Google Play on macOS, once. Run by the owner, never by an agent.
# The key and its password stay outside the repository: the key in ~/.android/turktalk-upload/upload.p12,
# the random password in the macOS login Keychain (service "turktalk-upload-keystore"). Nothing is printed.
# macOS counterpart of the key step in scripts/build-android-play-aab.ps1. Needs a JDK (keytool).
set -euo pipefail

dir="${1:-$HOME/.android/turktalk-upload}"
store="$dir/upload.p12"
alias_name="turktalk-upload"
service="turktalk-upload-keystore"
root="$(cd "$(dirname "$0")/.." && pwd)"

case "$dir/" in "$root"/*) echo "The signing directory must be outside the repository." >&2; exit 1 ;; esac
[ -e "$dir" ] && { echo "$dir already exists; inspect it before creating a key." >&2; exit 1; }
if security find-generic-password -s "$service" >/dev/null 2>&1; then
  echo "Keychain item \"$service\" already exists; inspect it before creating a key." >&2; exit 1
fi
keytool="${JAVA_HOME:+$JAVA_HOME/bin/}keytool"
"$keytool" -help >/dev/null 2>&1 || { echo "Set JAVA_HOME to a JDK (for example the Homebrew openjdk@21)." >&2; exit 1; }

umask 077
mkdir -p "$dir"
TURKTALK_UPLOAD_PASSWORD="$(openssl rand -base64 36)"
export TURKTALK_UPLOAD_PASSWORD
"$keytool" -genkeypair -keystore "$store" -storetype PKCS12 -alias "$alias_name" \
  -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=TurkTalk Upload, O=TurkTalk" \
  -storepass:env TURKTALK_UPLOAD_PASSWORD
security add-generic-password -a "$alias_name" -s "$service" -w "$TURKTALK_UPLOAD_PASSWORD"
unset TURKTALK_UPLOAD_PASSWORD
echo "Upload key created: $store (alias $alias_name). Password: Keychain item \"$service\"."
echo "Back up both; without them an update needs a key reset through Google Play support."
