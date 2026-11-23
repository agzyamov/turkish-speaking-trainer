// Fails if a build output contains the simulator test build's fake microphone, on-device transcription or
// audio fixture (ADR-0014). Run by `just frontend-build` on the web build and the native-app build.
// Usage: node build/checkNoTestAudio.mjs <build directory> [...]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

// The fixture is inlined into the test chunk as an audio/mp4 data URL; nothing else in the app embeds one.
const markers = ["turktalk-test-audio-build", "TestRecordingRejectedError", "fakeMicrophone", "fakeTranscription", "data:audio/mp4"];
const textExtensions = new Set([".js", ".mjs", ".css", ".html", ".json", ".map", ".txt"]);

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("usage: node build/checkNoTestAudio.mjs <build directory> [...]");
  process.exit(2);
}
const problems = [];
let checked = 0;
for (const dir of dirs) {
  for (const path of files(dir)) {
    checked += 1;
    if (extname(path) === ".m4a") problems.push(`${path}: audio fixture`);
    if (!textExtensions.has(extname(path))) continue;
    const text = readFileSync(path, "utf8");
    for (const marker of markers) if (text.includes(marker)) problems.push(`${path}: contains "${marker}"`);
  }
}
if (problems.length > 0) {
  console.error(`Test-build code found in a normal build (VITE_TEST_AUDIO must be set only by scripts/build-ios.sh sim):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`No test-build audio code in ${dirs.join(", ")} (${checked} files checked).`);
