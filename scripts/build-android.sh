#!/usr/bin/env bash
# Builds the Android app on macOS. Run only on the owner's instruction (C-24).
# The aab mode uses the upload key: the owner runs it, or tells an agent to each time.
#   scripts/build-android.sh apk   test APK (debug-signed) for a phone
#   scripts/build-android.sh aab   bundle for Google Play, signed with the upload key
# The upload key and its password stay outside the repository (see scripts/create-android-upload-key.sh);
# the password is read from the login Keychain into the environment and never printed.
# macOS counterpart of scripts/build-android-play-aab.ps1. Needs pnpm, a JDK 21 and the Android SDK.
set -euo pipefail

mode="${1:-}"
case "$mode" in apk|aab) ;; *) echo "Usage: $0 apk|aab" >&2; exit 1 ;; esac

root="$(cd "$(dirname "$0")/.." && pwd)"
store="${TURKTALK_UPLOAD_KEYSTORE:-$HOME/.android/turktalk-upload/upload.p12}"
alias_name="turktalk-upload"
service="turktalk-upload-keystore"

[ -n "${JAVA_HOME:-}" ] || { [ -d /opt/homebrew/opt/openjdk@21 ] && export JAVA_HOME=/opt/homebrew/opt/openjdk@21; }
[ -x "${JAVA_HOME:-}/bin/jarsigner" ] || { echo "Set JAVA_HOME to a JDK 21." >&2; exit 1; }
if [ -z "${ANDROID_HOME:-}" ]; then
  for sdk in "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools; do
    [ -d "$sdk/platforms" ] && { export ANDROID_HOME="$sdk"; break; }
  done
fi
[ -d "${ANDROID_HOME:-}/platforms" ] || { echo "Set ANDROID_HOME to the Android SDK." >&2; exit 1; }

version="$(sed -n 's/.*versionName "\([^"]*\)".*/\1/p' "$root/frontend/android/app/build.gradle")"
out="$root/artifacts"
mkdir -p "$out"

cd "$root/frontend"
pnpm android:sync
cd android

if [ "$mode" = apk ]; then
  sh ./gradlew assembleProdDebug
  apk="$out/TurkTalk-android-$version-test.apk"
  cp app/build/outputs/apk/prod/debug/*.apk "$apk"
  echo "Test APK: $apk"
  exit 0
fi

case "$store" in "$root"/*) echo "The upload key must be outside the repository." >&2; exit 1 ;; esac
[ -f "$store" ] || { echo "Upload key not found at $store; run scripts/create-android-upload-key.sh." >&2; exit 1; }
sh ./gradlew bundleProdRelease
bundle="$out/TurkTalk-android-$version.aab"
unsigned="$bundle.unsigned"
rm -f "$bundle"
cp app/build/outputs/bundle/prodRelease/app-prod-release.aab "$unsigned"
trap 'rm -f "$unsigned"' EXIT
set +x
TURKTALK_UPLOAD_PASSWORD="$(security find-generic-password -a "$alias_name" -s "$service" -w)"
export TURKTALK_UPLOAD_PASSWORD
"$JAVA_HOME/bin/jarsigner" -keystore "$store" -storetype PKCS12 -storepass:env TURKTALK_UPLOAD_PASSWORD \
  -digestalg SHA-256 -sigalg SHA256withRSA "$unsigned" "$alias_name" >/dev/null
unset TURKTALK_UPLOAD_PASSWORD
"$JAVA_HOME/bin/jarsigner" -verify "$unsigned" | grep -q "jar verified"
mv "$unsigned" "$bundle"
echo "Signed bundle: $bundle"
shasum -a 256 "$bundle"
