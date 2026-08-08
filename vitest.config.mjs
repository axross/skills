import { defineConfig } from "vitest/config";

// the suite is this repository's whole mechanical gate apart from formatting and
// linting: the validator unit tests under tests/validators and tests/unit, plus
// the repository-wide checks under tests/repository that used to be their own
// npm run-scripts (links, skill-structure, installed-copies). `npm test` runs
// all of it; see README.md's command table.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.mjs"],
    // custom matchers only — no injected globals. every test imports its own
    // describe/it/expect, per this project's unit-testing practices.
    globals: false,
    setupFiles: ["./tests/setup.mjs"],
    // each validator case spawns a child process, so the wall-clock cost is
    // process startup rather than computation; a file-level timeout well above
    // the default keeps a slow container from reporting a spurious failure.
    testTimeout: 30_000,
  },
});
