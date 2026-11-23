#!/usr/bin/env bash
# Runs the Maestro flows in frontend/maestro against the installed native app on a running iOS simulator
# or Android emulator. The flows sign in with the review account against the production backend. They type
# no answers and never press the answer-check button: a graded answer would call a paid AI provider (C-14).
# microphone.yaml (tag needs-test-build) finishes a recording; it runs only when the app this script installs
# is the simulator test build from scripts/build-ios.sh sim, which records a bundled phrase and transcribes it
# on the device (ADR-0014). Otherwise it is skipped with a message, and always on Android.
#
#   scripts/test-app.sh ios [flow.yaml ...]       iOS simulator "TurkTalk iPhone" (created and booted for you)
#   scripts/test-app.sh android [flow.yaml ...]   Android emulator or phone visible to adb (no Android flows yet)
#
# The review account email and password come from MAESTRO_REVIEW_EMAIL / MAESTRO_REVIEW_PASSWORD (CI secrets
# REVIEW_LOGIN_EMAIL / REVIEW_LOGIN_PASSWORD) or, on the owner's Mac, from the Keychain item made by
# scripts/create-review-account.sh. The password is never printed.
# Build first: scripts/build-ios.sh sim (installed for you), or install from Xcode / scripts/build-android.sh apk.
# Maestro writes typed text, including the password, into its debug output; this script keeps that output in
# a temporary folder and masks the password in it before moving it to artifacts/maestro/.
set -euo pipefail
set +x

platform="${1:-}"
case "$platform" in ios | android) shift ;; *) echo "usage: $0 ios|android [flow.yaml ...]" >&2; exit 2 ;; esac

root="$(cd "$(dirname "$0")/.." && pwd)"
flows_dir="$root/frontend/maestro"
# shellcheck source=SCRIPTDIR/lib/test-audio-build.sh
. "$root/scripts/lib/test-audio-build.sh"

if [ -z "${JAVA_HOME:-}" ] && [ -d /opt/homebrew/opt/openjdk@21 ]; then export JAVA_HOME=/opt/homebrew/opt/openjdk@21; fi
[ -n "${JAVA_HOME:-}" ] && export PATH="$JAVA_HOME/bin:$PATH"
command -v maestro >/dev/null || { echo "Maestro is not installed (brew install mobile-dev-inc/tap/maestro)." >&2; exit 1; }
export MAESTRO_CLI_NO_ANALYTICS=1

# The address is kept out of the repository (it is a secret in CI); locally it is the Keychain item's account.
if [ -z "${MAESTRO_REVIEW_EMAIL:-}" ] && command -v security >/dev/null; then
  MAESTRO_REVIEW_EMAIL="$(security find-generic-password -s turktalk-review-login 2>/dev/null | sed -n 's/.*"acct"<blob>="\(.*\)"/\1/p' || true)"
fi
[ -n "${MAESTRO_REVIEW_EMAIL:-}" ] || { echo "No review account email: set MAESTRO_REVIEW_EMAIL or run scripts/create-review-account.sh." >&2; exit 1; }
export MAESTRO_REVIEW_EMAIL
if [ -z "${MAESTRO_REVIEW_PASSWORD:-}" ]; then
  if command -v security >/dev/null && MAESTRO_REVIEW_PASSWORD="$(security find-generic-password -s turktalk-review-login -w 2>/dev/null)"; then
    export MAESTRO_REVIEW_PASSWORD
  else
    echo "No review account password: set MAESTRO_REVIEW_PASSWORD or run scripts/create-review-account.sh." >&2
    exit 1
  fi
fi

device_args=()
# Flows tagged needs-test-build finish a recording. Only the simulator test build answers it on the device;
# any other build would send it to production for paid transcription (C-14). They run only when the app
# installed below is verified to be that build.
test_build_problem="there is no Android test build"
if [ "$platform" = ios ]; then
  # A simulator of our own, so other projects testing on the Mac's simulators do not interfere.
  sim_name="${TURKTALK_SIMULATOR:-TurkTalk iPhone}"
  udid="$(xcrun simctl list devices available | sed -n "s/^ *$sim_name (\([0-9A-F-]\{36\}\)).*/\1/p" | head -1)"
  if [ -z "$udid" ]; then
    device_type="$(xcrun simctl list devicetypes | sed -n 's/^iPhone \([0-9][0-9]*\) (\(com.apple[^)]*\))$/\1 \2/p' | sort -n | tail -1 | cut -d' ' -f2)"
    runtime="$(xcrun simctl list runtimes available | sed -n 's/^iOS .* - \(com.apple.CoreSimulator.SimRuntime.iOS-[0-9-]*\)$/\1/p' | tail -1)"
    [ -n "$device_type" ] && [ -n "$runtime" ] || { echo "No iPhone device type or iOS runtime found." >&2; exit 1; }
    udid="$(xcrun simctl create "$sim_name" "$device_type" "$runtime")"
  fi
  if ! xcrun simctl list devices booted | grep -q "$udid"; then
    xcrun simctl boot "$udid"
  fi
  xcrun simctl bootstatus "$udid" -b >/dev/null
  # Install the latest simulator build if there is one (scripts/build-ios.sh sim), so the flows test it.
  app=""
  if [ -d "$root/artifacts/ios-build/Build/Products" ]; then
    app="$(find "$root/artifacts/ios-build/Build/Products" -maxdepth 2 -name App.app -path '*iphonesimulator*' | head -1)"
  fi
  if [ -n "$app" ]; then
    xcrun simctl install "$udid" "$app"
    if is_test_audio_build "$app"; then
      test_build_problem=""
    else
      test_build_problem="$app is not the simulator test build"
    fi
  elif ! xcrun simctl get_app_container "$udid" com.turktalk.trainer >/dev/null 2>&1; then
    echo "TurkTalk is not installed on the simulator; run scripts/build-ios.sh sim first." >&2
    exit 1
  else
    test_build_problem="the app already on the simulator cannot be checked"
  fi
  device_args=(--device "$udid")
fi

# MAESTRO_EXCLUDE_TAGS skips flows by tag (default "wip").
exclude="${MAESTRO_EXCLUDE_TAGS:-wip}"
if [ -n "$test_build_problem" ]; then
  echo "Skipping flows tagged needs-test-build (microphone.yaml): $test_build_problem. They finish a recording, which any other build sends for paid transcription (C-14); build the test app with scripts/build-ios.sh sim." >&2
  exclude="$exclude,needs-test-build"
fi

# Maestro applies --exclude-tags to a folder but not to flow files named on its command line, so the flow
# files are listed and filtered here: the top-level flows of frontend/maestro, or the files given.
candidates=()
if [ "$#" -gt 0 ]; then
  for target in "$@"; do
    case "$target" in
      /*) flow="$target" ;;
      *) if [ -f "$PWD/$target" ]; then flow="$PWD/$target"; else flow="$flows_dir/$target"; fi ;;
    esac
    [ -f "$flow" ] || { echo "No flow file $target (give a file in frontend/maestro or a path to one)." >&2; exit 2; }
    candidates+=("$flow")
  done
else
  candidates=("$flows_dir"/*.yaml)
fi
targets=()
for flow in "${candidates[@]}"; do
  skip=""
  for tag in ${exclude//,/ }; do
    if flow_has_tag "$flow" "$tag"; then skip="$tag"; fi
  done
  if [ -n "$skip" ]; then
    echo "Skipped $(basename "$flow") (tag $skip)." >&2
  else
    targets+=("$flow")
  fi
done
[ "${#targets[@]}" -gt 0 ] || { echo "No flows left to run." >&2; exit 1; }
debug_dir="$(mktemp -d)"
mask_debug_output() {
  # The password is read from the environment, never put on a command line.
  find "$debug_dir" -type f -exec perl -pi -e 's/\Q$ENV{MAESTRO_REVIEW_PASSWORD}\E/***/g' {} + 2>/dev/null || true
  # The simulator's system log holds iOS system tokens that the secret scan flags; it is not needed.
  find "$debug_dir" -type f -name '*simulator*.log' -delete 2>/dev/null || true
  mkdir -p "$root/artifacts/maestro"
  rm -rf "$root/artifacts/maestro/last-run"
  mv "$debug_dir" "$root/artifacts/maestro/last-run"
}
trap mask_debug_output EXIT

cd "$flows_dir"
maestro ${device_args[@]+"${device_args[@]}"} test --exclude-tags="$exclude" --debug-output "$debug_dir" "${targets[@]}"
