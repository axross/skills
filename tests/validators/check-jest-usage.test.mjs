// Exit-code and finding contract for check-jest-usage.mjs.
//
// Documented contract: 0 when every checked project passes, 1 on any finding or
// an unreadable path, 2 on a bad invocation.
//
// The four checks all share one property that shapes these tests: each defect
// is SILENT in a real suite. A partially imported spec passes, a mixed-case
// file passes, a removed API throws only when its line runs, and a discovery
// pattern reaching another runner fails for a reason that looks unrelated. So
// every check is tested in both directions — the defect is reported, and the
// clean equivalent is not — because a check that fires on everything is as
// useless here as one that fires on nothing.

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkJestUsage = validator(SCRIPTS.checkJestUsage);

/**
 * Build a project root with a package.json and any extra files.
 * @param {Record<string, string>} [files]
 * @returns {Promise<string>} absolute path of the project root
 */
async function project(files = {}) {
  const root = await tempDir();
  await writeFileIn(root, "package.json", JSON.stringify({ name: "fixture" }));
  for (const [relative, content] of Object.entries(files)) {
    await writeFileIn(root, relative, content);
  }
  return root;
}

/** A spec importing its whole test API — the shape every check should accept. */
const CLEAN_SPEC = `import { describe, expect, it } from "@jest/globals";
import { sum } from "./sum";

describe("sum()", () => {
  it("adds two numbers", () => {
    expect(sum(1, 2)).toBe(3);
  });
});
`;

describe("check-jest-usage.mjs", () => {
  describe("invocation", () => {
    it("prints usage and exits 0 for --help", () => {
      expect(checkJestUsage("--help")).toPassCleanly();
    });

    it("exits 2 when no project root is given", () => {
      expect(checkJestUsage()).toExitWith(2);
    });

    it("exits 1 when the root holds no package.json", async () => {
      const root = await tempDir();
      expect(checkJestUsage(root)).toReportFailure(/package\.json/);
    });

    it("passes a project whose specs are clean", async () => {
      const root = await project({ "src/sum.spec.ts": CLEAN_SPEC });
      expect(checkJestUsage(root)).toPassCleanly();
    });
  });

  describe("partially imported test API", () => {
    it("reports a spec that imports some of the API and inherits the rest", async () => {
      const root = await project({
        "src/a.spec.ts": `import { describe } from "@jest/globals";

describe("a()", () => {
  it("works", () => {
    expect(1).toBe(1);
  });
});
`,
      });
      const result = checkJestUsage(root);
      expect(result).toReportFailure(/takes it, expect from the global object/);
    });

    it("accepts a spec that inherits the whole API from globals", async () => {
      // A project that never adopted explicit imports is consistent, not
      // defective; only the half-converted file is a finding.
      const root = await project({
        "src/a.spec.ts": `describe("a()", () => {
  it("works", () => {
    expect(1).toBe(1);
  });
});
`,
      });
      expect(checkJestUsage(root)).toPassCleanly();
    });

    it("does not count a hook that the file never calls", async () => {
      const root = await project({ "src/a.spec.ts": CLEAN_SPEC });
      expect(checkJestUsage(root)).toPassCleanly();
    });

    it("accepts a spec importing jest alongside the case functions", async () => {
      const root = await project({
        "src/a.spec.ts": `import { describe, expect, it, jest } from "@jest/globals";

describe("a()", () => {
  it("works", () => {
    expect(jest.fn()).toBeDefined();
  });
});
`,
      });
      expect(checkJestUsage(root)).toPassCleanly();
    });
  });

  describe("mixed case functions", () => {
    it("reports a file using both it and test", async () => {
      const root = await project({
        "src/a.spec.ts": `import { describe, expect, it, test } from "@jest/globals";

describe("a()", () => {
  it("works", () => {
    expect(1).toBe(1);
  });

  test("also works", () => {
    expect(2).toBe(2);
  });
});
`,
      });
      expect(checkJestUsage(root)).toReportFailure(/both `it` and `test`/);
    });

    it("accepts a file using only one of them", async () => {
      const root = await project({ "src/a.spec.ts": CLEAN_SPEC });
      expect(checkJestUsage(root)).toPassCleanly();
    });
  });

  describe("APIs removed in Jest 30", () => {
    it("reports a removed matcher alias with its line and replacement", async () => {
      const root = await project({
        "src/a.spec.ts": `import { expect, it } from "@jest/globals";

it("works", () => {
  expect(fn).toBeCalledWith(1);
});
`,
      });
      const result = checkJestUsage(root);
      expect(result).toReportFailure(/toHaveBeenCalledWith/);
      expect(result.output).toMatch(/a\.spec\.ts:4/);
    });

    it("reports toThrowError and genMockFromModule", async () => {
      const root = await project({
        "src/a.spec.ts": `import { expect, it, jest } from "@jest/globals";

it("works", () => {
  jest.genMockFromModule("fs");
  expect(g).toThrowError("no");
});
`,
      });
      const result = checkJestUsage(root);
      expect(result.output).toMatch(/createMockFromModule/);
      expect(result.output).toMatch(/use `toThrow` instead/);
    });

    it("does not report a removed name appearing inside a string or a title", async () => {
      // The migration note and the assertion below both contain the literal
      // text of a removed API. Flagging either would make the check unusable in
      // exactly the codebases doing the migration.
      const root = await project({
        "src/a.spec.ts": `import { describe, expect, it } from "@jest/globals";

// Replace .toBeCalledWith( with toHaveBeenCalledWith across the suite.
describe("migration", () => {
  it("rewrites .toThrowError( call sites", () => {
    expect("x.toBeCalledWith(").toBe("x.toBeCalledWith(");
  });
});
`,
      });
      expect(checkJestUsage(root)).toPassCleanly();
    });
  });

  describe("discovery reaching another runner", () => {
    /** A Playwright-style spec, which Jest cannot run. */
    const FOREIGN_SPEC = `import { test } from "@playwright/test";

test("a journey", async ({ page }) => {
  await page.goto("/");
});
`;

    it("reports a recursive pattern that also selects an e2e directory", async () => {
      const root = await project({
        "src/a.spec.ts": CLEAN_SPEC,
        "e2e/journey.test.ts": FOREIGN_SPEC,
        "jest.config.js": `module.exports = { testMatch: ["**/*.{spec,test}.ts"] };\n`,
      });
      expect(checkJestUsage(root)).toReportFailure(/also selects e2e\//);
    });

    it("accepts a pattern anchored away from that directory", async () => {
      const root = await project({
        "src/a.spec.ts": CLEAN_SPEC,
        "e2e/journey.test.ts": FOREIGN_SPEC,
        "jest.config.js": `module.exports = { testMatch: ["<rootDir>/src/**/*.spec.ts"] };\n`,
      });
      expect(checkJestUsage(root)).toPassCleanly();
    });

    it("stays silent when the foreign directory does not exist", async () => {
      // A broad pattern is only a defect when there is something for it to
      // wrongly collect; reporting it otherwise would be noise.
      const root = await project({
        "src/a.spec.ts": CLEAN_SPEC,
        "jest.config.js": `module.exports = { testMatch: ["**/*.spec.ts"] };\n`,
      });
      expect(checkJestUsage(root)).toPassCleanly();
    });

    it("stays silent when no Jest config file is present", async () => {
      const root = await project({
        "src/a.spec.ts": CLEAN_SPEC,
        "e2e/journey.test.ts": FOREIGN_SPEC,
      });
      expect(checkJestUsage(root)).toPassCleanly();
    });

    // A glob's bracket class contains a literal `]`, and Jest's OWN default
    // testMatch is exactly that shape. Reading the array with a pattern that
    // stops at the first `]` truncates it mid-string and yields no patterns at
    // all — so the check reports nothing, which looks identical to a correctly
    // configured project. These two cases pin the parser against that.
    it("reports a bracket-class array pattern, as in Jest's own defaults", async () => {
      const root = await project({
        "src/a.spec.ts": CLEAN_SPEC,
        "e2e/journey.test.ts": FOREIGN_SPEC,
        "jest.config.js": `module.exports = {
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[tj]s?(x)"],
};
`,
      });
      expect(checkJestUsage(root)).toReportFailure(/also selects e2e\//);
    });

    it("reports a bracket-class testRegex", async () => {
      const root = await project({
        "src/a.spec.ts": CLEAN_SPEC,
        "e2e/journey.test.ts": FOREIGN_SPEC,
        "jest.config.js": `module.exports = {
  testRegex: ["(/__tests__/.*|(\\\\.|/)(test|spec))\\\\.[jt]sx?$"],
};
`,
      });
      expect(checkJestUsage(root)).toReportFailure(/also selects e2e\//);
    });

    it("reads every declaration, not only the first, in a projects config", async () => {
      const root = await project({
        "src/a.spec.ts": CLEAN_SPEC,
        "e2e/journey.test.ts": FOREIGN_SPEC,
        "jest.config.js": `module.exports = {
  projects: [
    { displayName: "unit", testMatch: ["<rootDir>/src/**/*.spec.ts"] },
    { displayName: "wide", testMatch: ["**/*.[jt]s?(x)"] },
  ],
};
`,
      });
      expect(checkJestUsage(root)).toReportFailure(/also selects e2e\//);
    });
  });

  describe("multiple roots", () => {
    it("reports findings across every checked project", async () => {
      const clean = await project({ "src/a.spec.ts": CLEAN_SPEC });
      const dirty = await project({
        "src/a.spec.ts": `import { describe } from "@jest/globals";

describe("a()", () => {
  it("works", () => {
    expect(1).toBe(1);
  });
});
`,
      });
      const result = checkJestUsage(clean, dirty);
      expect(result).toReportFailure(/global object/);
      expect(result.output).toMatch(/2 checked project\(s\)/);
    });
  });
});
