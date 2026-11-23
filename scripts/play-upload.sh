#!/usr/bin/env bash
# Uploads an Android App Bundle to a Google Play track through the Play Developer API (ADR-0012).
# Run by .github/workflows/android-release.yml; a store submission needs the owner's instruction (C-24).
# Usage: PLAY_ACCESS_TOKEN=... scripts/play-upload.sh <bundle.aab> <track> <status>
#   track:  internal | alpha (closed testing) | beta (open testing)
#   status: draft | completed   (an app that was never published accepts only "draft")
set -euo pipefail
bundle="$1"; track="$2"; status="$3"
package="com.turktalk.trainer"
api="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$package"
upload="https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/$package"
case "$track" in internal|alpha|beta) ;; *) echo "Unknown track: $track" >&2; exit 1 ;; esac
case "$status" in draft|completed) ;; *) echo "Unknown status: $status" >&2; exit 1 ;; esac
set +x
: "${PLAY_ACCESS_TOKEN:?PLAY_ACCESS_TOKEN is not set}"

call() { # method url [curl args...]; fails with the API's message on any non-2xx answer
  local out code
  out=$(curl -sS -w '\n%{http_code}' -X "$1" -H "Authorization: Bearer $PLAY_ACCESS_TOKEN" "$2" "${@:3}")
  code=${out##*$'\n'}; out=${out%$'\n'*}
  if [[ "$code" != 2* ]]; then echo "Play API $1 -> $code: $out" >&2; exit 1; fi
  printf '%s' "$out"
}
field() { python3 -c 'import json,sys; print(json.load(sys.stdin)[sys.argv[1]])' "$1"; }

edit=$(call POST "$api/edits" | field id)
code=$(call POST "$upload/edits/$edit/bundles?uploadType=media" -H "Content-Type: application/octet-stream" --data-binary "@$bundle" | field versionCode)
echo "Uploaded bundle as version code $code"
body=$(python3 -c 'import json,sys; print(json.dumps({"track": sys.argv[1], "releases": [{"versionCodes": [sys.argv[2]], "status": sys.argv[3]}]}))' "$track" "$code" "$status")
call PUT "$api/edits/$edit/tracks/$track" -H "Content-Type: application/json" --data-binary "$body" >/dev/null
call POST "$api/edits/$edit:commit" >/dev/null
echo "Release $code is on the '$track' track with status '$status'"
