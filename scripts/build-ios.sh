#!/usr/bin/env bash
# Prepares the iOS app (ADR-0013). Run only on the owner's instruction, like the Android build (C-24);
# the unsigned `sim` build for the automated app tests is the C-24 exception (ADR-0014).
#   scripts/build-ios.sh sync   build the web app in the native-app mode and copy it into frontend/ios
#   scripts/build-ios.sh open   sync, then open the project in Xcode
#   scripts/build-ios.sh sim    sync a test build, then build an unsigned simulator app into
#                               artifacts/ios-build (used by scripts/test-app.sh ios). The test build
#                               records a bundled phrase instead of the microphone and answers the
#                               transcription request on the device (VITE_TEST_AUDIO=true, ADR-0014).
#                               Afterwards frontend/ios holds the normal build again.
# The web build uses the "android" Vite mode, which is the native-app build mode for both shells
# (same .env.android, same checks in frontend/build/androidEnvironment.ts).
# Needs macOS, pnpm and a full Xcode (not only the Command Line Tools); Capacitor 8 resolves the native
# plugins with Swift Package Manager, so CocoaPods is not needed.
# TODO(owner): signing, archiving and the App Store Connect upload need the owner's Apple Developer
# account and are not automated here; see docs/architecture/decisions/ADR-0013-ios-app.md.
set -euo pipefail

mode="${1:-}"
case "$mode" in sync|open|sim) ;; *) echo "Usage: $0 sync|open|sim" >&2; exit 1 ;; esac

[ "$(uname -s)" = Darwin ] || { echo "The iOS app can only be built on macOS." >&2; exit 1; }

root="$(cd "$(dirname "$0")/.." && pwd)"
developer_dir="$(xcode-select -p 2>/dev/null || true)"
case "$developer_dir" in
  *.app/Contents/Developer) ;;
  *)
    echo "Xcode is not installed or not selected (xcode-select -p: ${developer_dir:-none})." >&2
    echo "Install Xcode from the App Store, then run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
    exit 1
    ;;
esac
xcodebuild -license check >/dev/null 2>&1 || { echo "Accept the Xcode licence first: sudo xcodebuild -license accept" >&2; exit 1; }
xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1 || { echo "Finish the Xcode setup first: xcodebuild -runFirstLaunch" >&2; exit 1; }

# Only the simulator test build gets the fake microphone and on-device transcription (ADR-0014). Vite reads
# VITE_TEST_AUDIO from the environment; sync and open clear it there, vite.config.ts refuses it from an env
# file, and the web build copied into frontend/ios is then checked to contain no test code. sim puts the
# normal web build back into frontend/ios when it is done (or fails), so Xcode never archives the test build.
sync_normal_build() {
  (cd "$root/frontend" && env -u VITE_TEST_AUDIO pnpm ios:sync && node build/checkNoTestAudio.mjs ios/App/App/public)
}
if [ "$mode" = sim ]; then
  restore_normal_build() {
    echo "Restoring the normal web build in frontend/ios"
    sync_normal_build >/dev/null || { echo "Could not restore the normal web build in frontend/ios; run scripts/build-ios.sh sync before using Xcode." >&2; exit 1; }
  }
  trap restore_normal_build EXIT
  (cd "$root/frontend" && VITE_TEST_AUDIO=true pnpm ios:sync)
else
  sync_normal_build
fi

if [ "$mode" = open ]; then
  (cd "$root/frontend" && pnpm exec cap open ios)
fi

if [ "$mode" = sim ]; then
  (cd "$root/frontend/ios/App" && xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$root/artifacts/ios-build" CODE_SIGNING_ALLOWED=NO -quiet build)
  echo "Simulator app: $root/artifacts/ios-build/Build/Products/Debug-iphonesimulator/App.app"
fi
