import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const infoPlist = readFileSync(resolve(process.cwd(), "ios/App/App/Info.plist"), "utf-8");
const project = readFileSync(resolve(process.cwd(), "ios/App/App.xcodeproj/project.pbxproj"), "utf-8");

describe("iOS app shell", () => {
  it("explains the microphone prompt; iOS refuses audio capture without it", () => {
    expect(infoPlist).toMatch(/<key>NSMicrophoneUsageDescription<\/key>\s*<string>TurkTalk listens to your spoken Turkish answer[^<]*Recordings are not stored\.<\/string>/);
  });

  it("registers the deep-link scheme that sign-in returns through", () => {
    expect(infoPlist).toMatch(/<key>CFBundleURLSchemes<\/key>\s*<array>[\s\S]*<string>com\.turktalk\.trainer<\/string>/);
  });

  it("keeps the product name and the bundle id of capacitor.config.ts", () => {
    expect(infoPlist).toMatch(/<key>CFBundleDisplayName<\/key>\s*<string>TurkTalk<\/string>/);
    expect(project.match(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)).toEqual(["PRODUCT_BUNDLE_IDENTIFIER = com.turktalk.trainer;", "PRODUCT_BUNDLE_IDENTIFIER = com.turktalk.trainer;"]);
  });
});
