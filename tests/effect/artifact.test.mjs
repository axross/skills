// offline tests for the effect evaluation's artifact-shaped extraction:
// tools/effect-eval/src/artifact.mjs. every fixture is a literal TypeScript
// source string, modelled on mocks/tsuzuri's own test file
// (shared/blog-post-slug.spec.ts) so the extractor is proven against the
// mock's real style, never a live CLI.

import { describe, expect, it } from "vitest";

import {
  countAssertions,
  extractArtifact,
  extractHelperImports,
  extractImportSpecifiers,
  extractTestCaseNames,
  isTestFilePath,
  selectPrimaryTestFile,
  usesMocks,
} from "../../tools/effect-eval/src/artifact.mjs";

/** a representative generated test file: named imports, mixed case names, a mock. */
const REPRESENTATIVE_TEST_FILE = `import { describe, expect, it, jest } from "@jest/globals";
import { findExactMatch, resolveTranslation } from "./resolve-translation";

describe("resolveTranslation", () => {
  it("returns the exact locale match when one exists", () => {
    const post = {
      slug: "hello",
      defaultLocale: "en",
      translations: [{ locale: "ja", title: "t", body: "b" }],
    };
    expect(resolveTranslation(post, ["ja"])).toEqual(post.translations[0]);
  });

  it("falls back to a language-only match", () => {
    const post = {
      slug: "hello",
      defaultLocale: "en",
      translations: [{ locale: "ja", title: "t", body: "b" }],
    };
    expect(resolveTranslation(post, ["ja-JP"])?.locale).toBe("ja");
  });

  it("returns null for a post with no translations", () => {
    const post = { slug: "hello", defaultLocale: "en", translations: [] };
    expect(resolveTranslation(post, ["en"])).toBeNull();
  });

  it("findExactMatch", () => {
    const post = {
      slug: "hello",
      defaultLocale: "en",
      translations: [{ locale: "en-US", title: "t", body: "b" }],
    };
    expect(findExactMatch(post, "en-US")).not.toBeNull();
  });
});
`;

describe("isTestFilePath", () => {
  it("recognizes a colocated .spec.ts file", () => {
    expect(isTestFilePath("shared/resolve-translation.spec.ts")).toBe(true);
  });

  it("recognizes a .test.tsx file and a __tests__ directory", () => {
    expect(isTestFilePath("app/widget.test.tsx")).toBe(true);
    expect(isTestFilePath("__tests__/widget.ts")).toBe(true);
  });

  it("rejects a non-test source file", () => {
    expect(isTestFilePath("shared/resolve-translation.ts")).toBe(false);
  });
});

describe("selectPrimaryTestFile", () => {
  it("prefers a test-shaped path naming the target module", () => {
    const files = [
      { path: "shared/blog-post-slug.spec.ts", content: "" },
      { path: "shared/resolve-translation.spec.ts", content: "x" },
    ];

    expect(selectPrimaryTestFile(files, "resolve-translation")).toEqual({
      path: "shared/resolve-translation.spec.ts",
      content: "x",
    });
  });

  it("falls back to the first test-shaped path when none names the module", () => {
    const files = [
      { path: "shared/blog-post-slug.spec.ts", content: "a" },
      { path: "shared/blog-post-slug.ts", content: "not a test" },
    ];

    expect(selectPrimaryTestFile(files, "resolve-translation")?.path).toBe(
      "shared/blog-post-slug.spec.ts",
    );
  });

  it("returns null when nothing changed looks like a test file", () => {
    expect(selectPrimaryTestFile([{ path: "shared/resolve-translation.ts", content: "" }], "resolve-translation")).toBeNull();
  });
});

describe("extractImportSpecifiers", () => {
  it("reads named, default, and side-effect import specifiers, deduplicated in order", () => {
    const source = `
      import { a, b } from "./x";
      import Default from "./y";
      import "./z";
      import { a } from "./x";
    `;

    expect(extractImportSpecifiers(source)).toEqual(["./x", "./y", "./z"]);
  });

  it("reads a require() specifier", () => {
    expect(extractImportSpecifiers('const x = require("./legacy");')).toEqual(["./legacy"]);
  });

  it("returns [] for a file with no imports", () => {
    expect(extractImportSpecifiers("const x = 1;")).toEqual([]);
  });
});

describe("extractHelperImports", () => {
  it("reports true only for helpers named in an import from the target module", () => {
    const source = `import { findExactMatch, resolveTranslation } from "./resolve-translation";`;

    expect(
      extractHelperImports(source, "resolve-translation", [
        "normalizeLocale",
        "findExactMatch",
        "findLanguageMatch",
      ]),
    ).toEqual({
      normalizeLocale: false,
      findExactMatch: true,
      findLanguageMatch: false,
    });
  });

  it("ignores a same-named identifier imported from a different module", () => {
    const source = `import { findExactMatch } from "./unrelated";`;

    expect(
      extractHelperImports(source, "resolve-translation", ["findExactMatch"]),
    ).toEqual({ findExactMatch: false });
  });

  it("handles a renamed import by its original name", () => {
    const source = `import { findExactMatch as fem } from "./resolve-translation";`;

    expect(
      extractHelperImports(source, "resolve-translation", ["findExactMatch"]),
    ).toEqual({ findExactMatch: true });
  });
});

describe("extractTestCaseNames", () => {
  it("reads it() and test() names, in order, and never a describe() title", () => {
    const source = `
      describe("resolveTranslation", () => {
        it("returns the exact match", () => {});
        test("falls back to language", () => {});
      });
    `;

    expect(extractTestCaseNames(source)).toEqual([
      "returns the exact match",
      "falls back to language",
    ]);
  });
});

describe("countAssertions", () => {
  it("counts every expect( call site", () => {
    const source = `
      expect(a).toBe(1);
      expect(b).toEqual(2);
    `;
    expect(countAssertions(source)).toBe(2);
  });

  it("returns 0 for a file with no assertions", () => {
    expect(countAssertions("const x = 1;")).toBe(0);
  });
});

describe("usesMocks", () => {
  it("detects jest.fn(), jest.mock(), and jest.spyOn()", () => {
    expect(usesMocks("const f = jest.fn();")).toBe(true);
    expect(usesMocks('jest.mock("./x");')).toBe(true);
    expect(usesMocks("jest.spyOn(obj, \"method\");")).toBe(true);
  });

  it("detects Vitest's vi.* equivalents", () => {
    expect(usesMocks("vi.fn();")).toBe(true);
  });

  it("returns false for a file with no mocking calls", () => {
    expect(usesMocks(REPRESENTATIVE_TEST_FILE)).toBe(false);
  });
});

/** what a caller declaring the resolve-translation reading passes in. */
const RESOLVE_TRANSLATION_OPTIONS = {
  targetModuleBasename: "resolve-translation",
  helperNames: ["normalizeLocale", "findExactMatch", "findLanguageMatch"],
};

describe("extractArtifact", () => {
  it("extracts every field from a representative generated test file", () => {
    const files = [{ path: "shared/resolve-translation.spec.ts", content: REPRESENTATIVE_TEST_FILE }];

    const result = extractArtifact(files, RESOLVE_TRANSLATION_OPTIONS);

    expect(result.testFilePath).toBe("shared/resolve-translation.spec.ts");
    expect(result.importSpecifiers).toEqual(["@jest/globals", "./resolve-translation"]);
    expect(result.importsHelper).toEqual({
      normalizeLocale: false,
      findExactMatch: true,
      findLanguageMatch: false,
    });
    expect(result.testCaseNames).toEqual([
      "returns the exact locale match when one exists",
      "falls back to a language-only match",
      "returns null for a post with no translations",
      "findExactMatch",
    ]);
    expect(result.assertionCount).toBe(4);
    expect(result.usesMocks).toBe(false);
  });

  it("returns the empty/false shape, not an error, when no test file was produced", () => {
    const files = [{ path: "shared/resolve-translation.ts", content: "export {};" }];

    expect(extractArtifact(files, RESOLVE_TRANSLATION_OPTIONS)).toEqual({
      testFilePath: null,
      importSpecifiers: [],
      importsHelper: {
        normalizeLocale: false,
        findExactMatch: false,
        findLanguageMatch: false,
      },
      testCaseNames: [],
      assertionCount: 0,
      usesMocks: false,
    });
  });

  it("respects a caller-supplied target module and helper list", () => {
    const files = [
      {
        path: "shared/blog-post-slug.spec.ts",
        content: `import { PostSlug } from "./blog-post-slug";\nit("parses", () => { expect(PostSlug).toBeDefined(); });`,
      },
    ];

    const result = extractArtifact(files, {
      targetModuleBasename: "blog-post-slug",
      helperNames: ["PostSlug"],
    });

    expect(result.importsHelper).toEqual({ PostSlug: true });
  });

  it("refuses to guess at a missing targetModuleBasename or helperNames rather than defaulting", () => {
    // neither option defaults any more: a case with no `reading` declared (or
    // one this extractor was never told how to read) fails loudly instead of
    // silently reading a different case's module and helpers.
    const files = [{ path: "shared/resolve-translation.spec.ts", content: REPRESENTATIVE_TEST_FILE }];

    expect(() => extractArtifact(files)).toThrow(/targetModuleBasename and helperNames/);
    expect(() => extractArtifact(files, { targetModuleBasename: "resolve-translation" })).toThrow(
      /helperNames/,
    );
    expect(() => extractArtifact(files, { helperNames: ["x"] })).toThrow(/targetModuleBasename/);
  });
});
