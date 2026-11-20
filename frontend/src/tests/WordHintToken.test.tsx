import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { WordHintToken } from "../WordHintToken";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("dismisses on outside pointer, focus and Escape while allowing the word to toggle", () => {
  function Hint() {
    const [active, setActive] = useState(true);
    return <><WordHintToken word="хочу" used active={active} disabled={false} translation="želim" onClick={() => setActive(value => !value)} onDismiss={() => setActive(false)} /><button type="button">Outside</button></>;
  }
  render(<Hint />);
  const word = screen.getByRole("button", { name: "хочу" });
  fireEvent.pointerDown(word);
  expect(screen.getByRole("status")).toBeInTheDocument();
  fireEvent.click(word);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  fireEvent.click(word);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  fireEvent.click(word);
  fireEvent.focusIn(screen.getByRole("button", { name: "Outside" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  fireEvent.click(word);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it.each([0, 290])("keeps hints inside a 320px viewport near word x=%s", (left) => {
  vi.stubGlobal("innerWidth", 320);
  vi.stubGlobal("innerHeight", 640);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return (this.classList.contains("word-tooltip")
      ? { left: 0, top: 0, width: 180, height: 42 }
      : { left, top: 200, bottom: 225, width: 30, height: 25 }) as DOMRect;
  });
  const onClick = vi.fn();
  const { container, rerender } = render(<WordHintToken word="грязную" used active disabled={false} translation="prljavu" onClick={onClick} onDismiss={vi.fn()} />);
  const popup = screen.getByRole("status");
  expect(popup.parentElement).toBe(document.body);
  expect(container.querySelector(".word-tooltip")).toBeNull();
  expect(parseFloat(popup.style.left)).toBeGreaterThanOrEqual(12);
  expect(parseFloat(popup.style.left) + 180).toBeLessThanOrEqual(308);
  // Below the word (bottom 225 + 10), so it never covers the topic row above the phrase.
  expect(popup.style.top).toBe("235px");
  fireEvent.click(screen.getByRole("button"));
  expect(onClick).toHaveBeenCalledOnce();
  rerender(<WordHintToken word="грязную" used active={false} disabled={false} translation="prljavu" onClick={onClick} onDismiss={vi.fn()} />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("flips the hint above the word when there is no room below", () => {
  vi.stubGlobal("innerWidth", 320);
  vi.stubGlobal("innerHeight", 640);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return (this.classList.contains("word-tooltip")
      ? { left: 0, top: 0, width: 180, height: 42 }
      : { left: 100, top: 590, bottom: 615, width: 30, height: 25 }) as DOMRect;
  });
  render(<WordHintToken word="чашку" used active disabled={false} translation="fincan" onClick={vi.fn()} onDismiss={vi.fn()} />);
  // 590 - 42 - 10 = 538: above the word, because below (625) would leave the viewport.
  expect(screen.getByRole("status").style.top).toBe("538px");
});
