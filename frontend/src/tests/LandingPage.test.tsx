import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LandingPage } from "../LandingPage";
import { setLanguage } from "../i18n";

afterEach(() => {
  cleanup();
  setLanguage("ru");
  localStorage.clear();
});

it("presents the Turkish product with web sign-in and no previous owner's story or store links", () => {
  render(<LandingPage />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Пора заговорить.");
  expect(screen.getAllByText(/Турецкий/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/сербск/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Я создал/)).not.toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /Начать говорить/ })[0]).toHaveAttribute("href", "#sign-in");
  expect(screen.queryByRole("link", { name: /Google Play/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "TurkTalk" })[0]).toHaveAttribute("href", "#top");
  expect(screen.getAllByRole("img", { name: /TurkTalk:/ })).toHaveLength(4);
  expect(screen.getByRole("img", { name: "TurkTalk: статистика занятий" })).toHaveAttribute("src", "/landing/screens/phone/ru-statistics.jpg");
});

it("switches copy, metadata and screenshot locale together, and restores Russian", () => {
  render(<LandingPage />);
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Now speak them.");
  expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("img", { name: "TurkTalk: speaking practice" })).toHaveAttribute("src", "/landing/screens/phone/en-practice.jpg");
  expect(screen.getByRole("img", { name: "TurkTalk: practice statistics" })).toHaveAttribute("src", "/landing/screens/phone/en-statistics.jpg");
  expect(document.title).toBe("TurkTalk — start speaking Turkish");
  expect(screen.queryByText(/Serbian/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "RU" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Пора заговорить.");
});
