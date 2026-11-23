import { Capacitor } from "@capacitor/core";

/** The native app shells that wrap the web app (ADR-0013). */
export type NativeAppPlatform = "android" | "ios";

/**
 * Which native app is running, or undefined in a browser. Use it where behaviour belongs to the
 * native apps (the Premium gift, no web payment) or differs between them (settings paths, Apple sign-in).
 */
export function nativeAppPlatform(): NativeAppPlatform | undefined {
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios" ? platform : undefined;
}
