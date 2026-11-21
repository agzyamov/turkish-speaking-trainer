import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// The app keeps its section in the URL hash; start every test on the practice section.
afterEach(() => {
  if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname);
});
