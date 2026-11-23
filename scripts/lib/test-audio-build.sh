# shellcheck shell=bash
# Sourced by scripts/test-app.sh.

# Succeeds if the iOS app bundle at $1 is the simulator test build (VITE_TEST_AUDIO=true, ADR-0014): only
# that build records a bundled phrase and answers the transcription on the device. The marker string is
# TEST_AUDIO_MARKER in frontend/src/testBuild/fakeMicrophone.ts.
is_test_audio_build() {
  [ -d "${1:-}/public" ] && grep -rqF "turktalk-test-audio-build" "$1/public"
}

# Succeeds if the Maestro flow file $1 lists tag $2 in its header (the part before "---").
flow_has_tag() {
  awk '/^---/ { exit } { print }' "$1" | grep -Eq "^[[:space:]]*-[[:space:]]*$2[[:space:]]*$"
}
