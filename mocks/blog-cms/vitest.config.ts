import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Two projects, not one config with a matcher: the unit project never pays
// for a browser, and the browser project never runs a server-only test
// through jsdom (there isn't one — server code is exercised through Hono's
// own in-memory `app.request()`, which needs no DOM at all).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          clearMocks: true,
          include: ["src/**/*.test.ts", "server/**/*.test.ts", "shared/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "browser",
          clearMocks: true,
          include: ["src/**/*.browser.test.tsx"],
          setupFiles: ["src/test/browser-setup.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
