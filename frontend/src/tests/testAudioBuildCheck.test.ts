import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";

// The guards around the simulator test build (ADR-0014): scripts/test-app.sh runs flows that finish a
// recording only on an app that is the test build, and build/checkNoTestAudio.mjs keeps test code out of
// what ships.
const repository = resolve(__dirname, "../../..");
const dirs: string[] = [];

function appBundle(files: Record<string, string>): string {
  const app = mkdtempSync(join(tmpdir(), "turktalk-app-"));
  dirs.push(app);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(app, name, ".."), { recursive: true });
    writeFileSync(join(app, name), content);
  }
  return app;
}

const isTestBuild = (app: string) => spawnSync("bash", ["-c", '. "$1/scripts/lib/test-audio-build.sh" && is_test_audio_build "$2"', "check", repository, app]).status === 0;

const checkNoTestAudio = (dir: string) => spawnSync(process.execPath, [join(repository, "frontend/build/checkNoTestAudio.mjs"), dir], { encoding: "utf8" });

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("recognises the simulator test build only by its marker", () => {
  const testBuild = appBundle({ "public/assets/fakeMicrophone-x.js": 'const m="turktalk-test-audio-build";' });
  const normalBuild = appBundle({ "public/assets/main-x.js": "getUserMedia()" });
  expect(isTestBuild(testBuild)).toBe(true);
  expect(isTestBuild(normalBuild)).toBe(false);
  expect(isTestBuild(join(normalBuild, "missing"))).toBe(false);
});

it("finds the tags the runner filters on itself, because Maestro ignores --exclude-tags for named flow files", () => {
  const hasTag = (flow: string, tag: string) => spawnSync("bash", ["-c", '. "$1/scripts/lib/test-audio-build.sh" && flow_has_tag "$2" "$3"', "check", repository, flow, tag]).status === 0;
  const microphone = join(repository, "frontend/maestro/microphone.yaml");
  expect(hasTag(microphone, "needs-test-build")).toBe(true);
  expect(hasTag(microphone, "wip")).toBe(false);
  expect(hasTag(join(repository, "frontend/maestro/launch.yaml"), "needs-test-build")).toBe(false);
  // A tag-like line after the header does not count.
  const flows = appBundle({ "late.yaml": "appId: x\n---\n- needs-test-build\n" });
  expect(hasTag(join(flows, "late.yaml"), "needs-test-build")).toBe(false);
});

it("fails a shipped build that contains test-build code or the fixture, and passes a clean one", () => {
  expect(checkNoTestAudio(appBundle({ "assets/main-x.js": "getUserMedia()" })).status).toBe(0);
  const withMarker = checkNoTestAudio(appBundle({ "assets/main-x.js": 'import("./fakeMicrophone-x.js")' }));
  expect(withMarker.status).toBe(1);
  expect(withMarker.stderr).toContain("fakeMicrophone");
  expect(checkNoTestAudio(appBundle({ "assets/phrase-x.m4a": "audio" })).status).toBe(1);
});
