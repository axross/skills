import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// Keeps the SDK inert for every browser test in this project — see
// analytics.ts's own module comment for why it's the only file that imports
// the real package.
vi.mock("@amplitude/analytics-browser", () => ({
  init: vi.fn(),
  track: vi.fn(),
  setUserId: vi.fn(),
  identify: vi.fn(),
  Identify: class {
    set() {
      return this;
    }
  },
}));
