import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { LegalPage } from "../LegalPage";
import { setLanguage } from "../i18n";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLanguage("ru");
});

it.each(["ru", "en"] as const)("shows the daily free allowance of 20 in %s", language => {
  setLanguage(language);
  render(<LegalPage kind="terms" />);
  expect(screen.getByText(language === "en" ? /the free allowance is 20 phrases per day/ : /бесплатный лимит — 20 фраз в сутки/)).toBeInTheDocument();
  expect(screen.queryByText(/до 10 фраз в сутки|up to 10 phrases per day/)).not.toBeInTheDocument();
});

it.each(["android", "ios"] as const)("describes the native-app Premium gift without the web payment terms in the %s app", platform => {
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue(platform);
  render(<LegalPage kind="terms" />);
  expect(screen.getByText(/После входа в приложение для Android или iOS Premium предоставляется бессрочно/)).toBeInTheDocument();
  expect(screen.queryByText(/бесплатный лимит — 20 фраз в сутки/)).not.toBeInTheDocument();
});

it.each(["ru", "en"] as const)("names Apple next to Google as a sign-in service in the privacy policy (%s)", language => {
  setLanguage(language);
  render(<LegalPage kind="privacy" />);
  expect(screen.getByText(language === "en" ? /uses Google, Apple \(in the iOS app\)/ : /использует Google, Apple \(в приложении для iOS\)/)).toBeInTheDocument();
  expect(screen.getByText(/Google OAuth, Sign in with Apple, Supabase/)).toBeInTheDocument();
});
