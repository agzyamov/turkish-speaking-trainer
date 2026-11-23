#!/usr/bin/env bash
# Builds the Android app. Run only on the owner's instruction (C-24).
#   scripts/build-android.sh apk        test APK (debug-signed) for a phone
#   scripts/build-android.sh aab        bundle for Google Play, signed with the upload key
#   scripts/build-android.sh aab-build  only build the unsigned bundle (no key needed)
#   scripts/build-android.sh aab-sign   only sign the bundle that aab-build left in artifacts/
# The aab and aab-sign modes use the upload key: the owner runs them, or tells an agent to each time.
# The upload key and its password stay outside the repository (see scripts/create-android-upload-key.sh).
# On the owner's Mac the password is read from the login Keychain; the Play release workflow (ADR-0012)
# passes it in TURKTALK_UPLOAD_PASSWORD, to the signing step only. It is never printed.
# TURKTALK_VERSION_NAME and TURKTALK_VERSION_CODE, set together, replace the numbers in build.gradle.
# macOS counterpart of scripts/build-android-play-aab.ps1. Needs pnpm, a JDK 21 and the Android SDK.
set -euo pipefail

mode="${1:-}"
case "$mode" in apk|aab|aab-build|aab-sign) ;; *) echo "Usage: $0 apk|aab|aab-build|aab-sign" >&2; exit 1 ;; esac
unset VITE_TEST_AUDIO # the fake microphone belongs to the iOS simulator test build only (ADR-0014)

root="$(cd "$(dirname "$0")/.." && pwd)"
store="${TURKTALK_UPLOAD_KEYSTORE:-$HOME/.android/turktalk-upload/upload.p12}"
alias_name="turktalk-upload"
service="turktalk-upload-keystore"

[ -n "${JAVA_HOME:-}" ] || { [ -d /opt/homebrew/opt/openjdk@21 ] && export JAVA_HOME=/opt/homebrew/opt/openjdk@21; }
[ -x "${JAVA_HOME:-}/bin/jarsigner" ] || { echo "Set JAVA_HOME to a JDK 21." >&2; exit 1; }

version="$(sed -n 's/.*versionName "\([^"]*\)".*/\1/p' "$root/frontend/android/app/build.gradle")"
gradle_args=()
if [ -n "${TURKTALK_VERSION_NAME:-}" ] || [ -n "${TURKTALK_VERSION_CODE:-}" ]; then
  [ -n "${TURKTALK_VERSION_NAME:-}" ] && [ -n "${TURKTALK_VERSION_CODE:-}" ] ||
    { echo "Set TURKTALK_VERSION_NAME and TURKTALK_VERSION_CODE together." >&2; exit 1; }
  version="$TURKTALK_VERSION_NAME"
  gradle_args=("-PplayVersionName=$version" "-PplayVersionCode=$TURKTALK_VERSION_CODE")
  export VITE_APP_VERSION="$version" # Settings shows the Android version of this release
fi
out="$root/artifacts"
bundle="$out/TurkTalk-android-$version.aab"
unsigned="$bundle.unsigned"
mkdir -p "$out"

build() { # gradle task
  if [ -z "${ANDROID_HOME:-}" ]; then
    for sdk in "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools; do
      [ -d "$sdk/platforms" ] && { export ANDROID_HOME="$sdk"; break; }
    done
  fi
  [ -d "${ANDROID_HOME:-}/platforms" ] || { echo "Set ANDROID_HOME to the Android SDK." >&2; exit 1; }
  # The web build must not contain the iOS simulator test build's fake microphone (ADR-0014).
  (cd "$root/frontend" && pnpm android:sync && node build/checkNoTestAudio.mjs dist android/app/src/main/assets/public)
  (cd "$root/frontend/android" && sh ./gradlew "$1" ${gradle_args[@]+"${gradle_args[@]}"})
}

sign() {
  case "$store" in "$root"/*) echo "The upload key must be outside the repository." >&2; exit 1 ;; esac
  [ -f "$store" ] || { echo "Upload key not found at $store; run scripts/create-android-upload-key.sh." >&2; exit 1; }
  [ -f "$unsigned" ] || { echo "No unsigned bundle at $unsigned; run the aab-build mode first." >&2; exit 1; }
  set +x
  if [ -z "${TURKTALK_UPLOAD_PASSWORD:-}" ]; then
    command -v security >/dev/null || { echo "TURKTALK_UPLOAD_PASSWORD is not set." >&2; exit 1; }
    TURKTALK_UPLOAD_PASSWORD="$(security find-generic-password -a "$alias_name" -s "$service" -w)"
  fi
  export TURKTALK_UPLOAD_PASSWORD
  "$JAVA_HOME/bin/jarsigner" -keystore "$store" -storetype PKCS12 -storepass:env TURKTALK_UPLOAD_PASSWORD \
    -digestalg SHA-256 -sigalg SHA256withRSA "$unsigned" "$alias_name" >/dev/null
  unset TURKTALK_UPLOAD_PASSWORD
  "$JAVA_HOME/bin/jarsigner" -verify "$unsigned" | grep -q "jar verified"
  mv "$unsigned" "$bundle"
  echo "Signed bundle: $bundle"
  shasum -a 256 "$bundle"
}

case "$mode" in
  apk)
    build assembleProdDebug
    apk="$out/TurkTalk-android-$version-test.apk"
    cp "$root"/frontend/android/app/build/outputs/apk/prod/debug/*.apk "$apk"
    echo "Test APK: $apk"
    ;;
  aab | aab-build)
    rm -f "$bundle" "$unsigned"
    build bundleProdRelease
    cp "$root/frontend/android/app/build/outputs/bundle/prodRelease/app-prod-release.aab" "$unsigned"
    if [ "$mode" = aab ]; then
      trap 'rm -f "$unsigned"' EXIT
      sign
    else
      echo "Unsigned bundle: $unsigned"
    fi
    ;;
  aab-sign) sign ;;
esac
