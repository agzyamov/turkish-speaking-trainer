#!/usr/bin/env bash
# Runs the Maestro flows in frontend/maestro against the installed native app on a running iOS simulator
# or Android emulator. The flows sign in with the review account against the production backend. They type
# no answers and stop before "Завершить запись": a graded answer or a finished recording would call a paid
# AI provider (C-14).
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
  elif ! xcrun simctl get_app_container "$udid" com.turktalk.trainer >/dev/null 2>&1; then
    echo "TurkTalk is not installed on the simulator; run scripts/build-ios.sh sim first." >&2
    exit 1
  fi
  device_args=(--device "$udid")
fi

if [ "$#" -gt 0 ]; then
  targets=("$@")
else
  targets=("$flows_dir")
fi

# MAESTRO_EXCLUDE_TAGS lets CI skip flows that need hardware it lacks (tag "needs-microphone").
exclude="${MAESTRO_EXCLUDE_TAGS:-wip}"
debug_dir="$(mktemp -d)"
mask_debug_output() {
  # The password is read from the environment, never put on a command line.
  find "$debug_dir" -type f -exec perl -pi -e 's/\Q$ENV{MAESTRO_REVIEW_PASSWORD}\E/***/g' {} + 2>/dev/null || true
  mkdir -p "$root/artifacts/maestro"
  rm -rf "$root/artifacts/maestro/last-run"
  mv "$debug_dir" "$root/artifacts/maestro/last-run"
}
trap mask_debug_output EXIT

cd "$flows_dir"
maestro ${device_args[@]+"${device_args[@]}"} test --exclude-tags="$exclude" --debug-output "$debug_dir" "${targets[@]}"
