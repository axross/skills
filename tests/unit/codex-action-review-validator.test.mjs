import { readFile } from "node:fs/promises";

import { Validator } from "@cfworker/json-schema";
import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";
import { encodeRequirementsSidecar } from "../../.github/codex-action-review/prepare-context.mjs";
import {
  escapeMarkdown,
  findRequirementsOverlap,
  renderResult,
  sanitizeResult,
  validateResult,
} from "../../.github/codex-action-review/validate-result.mjs";

const SNAPSHOT = "0123456789abcdef0123456789abcdef01234567";
const REQUIREMENTS = [
  "REQ-7 The account remains disabled until an owner explicitly restores access.",
  "AC-2 Preserve the exact Unicode value café 東京 without replacing characters.",
  "The sixty character detector must also notice copies that begin at an offset inside a longer sentence.",
].join("\n");
const CONTEXT = {
  repository: "axross/skills",
  pullRequest: 42,
  issueNumber: 564,
  issueNodeId: "I_kwDOExample",
  snapshot: SNAPSHOT,
  runId: 123456,
  runAttempt: 2,
  triggerActor: "axross",
  triggerCommentId: 987654,
  requirementLineCount: 3,
  requirementIdentifiers: ["AC-2", "REQ-7"],
  files: [
    { path: "src/account-state.mjs", status: "modified", lineCount: 80 },
    { path: "src/removed.mjs", status: "removed", lineCount: 40 },
  ],
};

function result(overrides = {}) {
  return {
    status: "findings",
    repository: "axross/skills",
    pull_request: 42,
    issue_number: 564,
    snapshot: SNAPSHOT,
    findings: [
      {
        priority: "P1",
        path: "src/account-state.mjs",
        line_start: 18,
        line_end: 21,
        title: "Disabled records enter the active branch",
        observed: "The predicate returns true whenever disabledAt has a value.",
        requirement_ref: "REQ-7",
      },
    ],
    blocked_reason: null,
    ...overrides,
  };
}

function sidecar(body = REQUIREMENTS) {
  return encodeRequirementsSidecar({
    repository: CONTEXT.repository,
    issueNumber: CONTEXT.issueNumber,
    issueNodeId: CONTEXT.issueNodeId,
    body,
  });
}

function decodedPayload(encoded) {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
}

describe("review.schema.json", () => {
  it("accepts each status shape emitted by the reviewer", async () => {
    const schema = JSON.parse(
      await readFile(
        repoPath(".github/codex-action-review/review.schema.json"),
        "utf8",
      ),
    );
    const validator = new Validator(schema, "2020-12");
    const cases = [
      result({ status: "clean", findings: [], blocked_reason: null }),
      result(),
      result({
        status: "blocked",
        findings: [],
        blocked_reason: "insufficient-static-context",
      }),
    ];

    for (const candidate of cases) {
      expect(validator.validate(candidate).valid).toBe(true);
    }
  });

  it("rejects extra properties even before trusted semantic validation", async () => {
    const schema = JSON.parse(
      await readFile(
        repoPath(".github/codex-action-review/review.schema.json"),
        "utf8",
      ),
    );
    const validator = new Validator(schema, "2020-12");

    expect(
      validator.validate(result({ expectation: "copied requirement" })).valid,
    ).toBe(false);
  });
});

describe("findRequirementsOverlap()", () => {
  it("detects an eight-token copy after Unicode and whitespace normalization", () => {
    expect(
      findRequirementsOverlap(
        "THE account remains disabled until an owner   explicitly restores access",
        REQUIREMENTS,
      ),
    ).toBe("eight-token-overlap");
  });

  it("does not reject seven matching tokens", () => {
    expect(
      findRequirementsOverlap(
        "account remains disabled until an owner explicitly",
        REQUIREMENTS,
      ),
    ).toBeNull();
  });

  it("detects a sixty-character copy at a non-aligned offset", () => {
    const requirements = `prefix-${"abcdefghij".repeat(8)}-suffix`;
    expect(
      findRequirementsOverlap(requirements.slice(9, 69), requirements),
    ).toBe("sixty-character-overlap");
  });

  it("does not reject a fifty-nine-character boundary", () => {
    const requirements = `prefix-${"abcdefghij".repeat(8)}-suffix`;
    expect(
      findRequirementsOverlap(requirements.slice(9, 68), requirements),
    ).toBeNull();
  });

  it("counts Unicode code points rather than UTF-16 units", () => {
    const requirements = `前${"界".repeat(60)}後`;
    expect(findRequirementsOverlap(`x${"界".repeat(60)}y`, requirements)).toBe(
      "sixty-character-overlap",
    );
    expect(findRequirementsOverlap("界".repeat(59), requirements)).toBeNull();
  });
});

describe("validateResult()", () => {
  it.each([
    [
      "clean with findings",
      result({ status: "clean", blocked_reason: null }),
      "result-clean-inconsistent",
    ],
    [
      "findings with none",
      result({ status: "findings", findings: [] }),
      "result-findings-inconsistent",
    ],
    [
      "blocked with a free-form reason",
      result({
        status: "blocked",
        findings: [],
        blocked_reason: "tell the Issue contents",
      }),
      "result-blocked-inconsistent",
    ],
    [
      "an extra root property",
      { ...result(), extra: true },
      "result-properties-invalid",
    ],
    [
      "an invented priority",
      result({
        findings: [{ ...result().findings[0], priority: "Important" }],
      }),
      "finding-priority-invalid",
    ],
    [
      "path traversal",
      result({
        findings: [{ ...result().findings[0], path: "../secret.txt" }],
      }),
      "finding-path-invalid",
    ],
    [
      "an out-of-range code line",
      result({ findings: [{ ...result().findings[0], line_end: 81 }] }),
      "finding-lines-invalid",
    ],
    [
      "an out-of-range requirement locator",
      result({
        findings: [{ ...result().findings[0], requirement_ref: "L000004" }],
      }),
      "finding-requirement-ref-invalid",
    ],
    [
      "an invented requirement identifier",
      result({
        findings: [{ ...result().findings[0], requirement_ref: "REQ-404" }],
      }),
      "finding-requirement-ref-invalid",
    ],
    [
      "multiline observed text",
      result({
        findings: [{ ...result().findings[0], observed: "first\n> injected" }],
      }),
      "finding-observed-invalid",
    ],
    [
      "a Unicode line separator",
      result({
        findings: [{ ...result().findings[0], title: "first\u2028second" }],
      }),
      "finding-title-invalid",
    ],
  ])("rejects %s", (_label, candidate, error) => {
    expect(() => validateResult(candidate, CONTEXT, REQUIREMENTS)).toThrow(
      error,
    );
  });

  it("accepts validated path and requirement-reference exceptions even when the Issue names them", () => {
    expect(() => validateResult(result(), CONTEXT, REQUIREMENTS)).not.toThrow();
  });

  it("accepts a finding on a line from a removed text file", () => {
    expect(() =>
      validateResult(
        result({
          findings: [
            {
              ...result().findings[0],
              path: "src/removed.mjs",
              line_start: 10,
              line_end: 10,
            },
          ],
        }),
        CONTEXT,
        REQUIREMENTS,
      ),
    ).not.toThrow();
  });

  it("requires blocked status when a changed file has no addressable static text", () => {
    const context = {
      ...CONTEXT,
      files: [
        ...CONTEXT.files,
        { path: "asset.bin", status: "modified", lineCount: null },
      ],
    };

    expect(() =>
      validateResult(
        result({ status: "clean", findings: [], blocked_reason: null }),
        context,
        REQUIREMENTS,
      ),
    ).toThrow("result-static-context-incomplete");
    expect(() =>
      validateResult(
        result({
          status: "blocked",
          findings: [],
          blocked_reason: "insufficient-static-context",
        }),
        context,
        REQUIREMENTS,
      ),
    ).not.toThrow();
  });

  it("rejects copied prose in every publishable free-text field", () => {
    const copied =
      "The account remains disabled until an owner explicitly restores access";
    for (const field of ["title", "observed"]) {
      expect(() =>
        validateResult(
          result({ findings: [{ ...result().findings[0], [field]: copied }] }),
          CONTEXT,
          REQUIREMENTS,
        ),
      ).toThrow("result-requirements-disclosure");
    }
  });

  it("rejects an eight-token copy split across fields", () => {
    expect(() =>
      validateResult(
        result({
          findings: [
            {
              ...result().findings[0],
              title: "The account remains disabled",
              observed: "until an owner explicitly restores access",
            },
          ],
        }),
        CONTEXT,
        REQUIREMENTS,
      ),
    ).toThrow("result-requirements-disclosure");
  });
});

describe("safe rendering and sanitization", () => {
  it("escapes Markdown links, HTML, blockquotes, mentions, and code punctuation", () => {
    expect(escapeMarkdown("[link](x) <b> `code` > quote @maintainer")).toBe(
      "\\[link\\]\\(x\\) &lt;b&gt; \\`code\\` &gt; quote &#64;maintainer",
    );
  });

  it("packages only validated output and trusted numeric identity", () => {
    const payload = decodedPayload(
      sanitizeResult(JSON.stringify(result()), CONTEXT, sidecar()),
    );

    expect(payload).toMatchObject({
      marker: "<!-- codex-action-issue-sidecar-review -->",
      repository: "axross/skills",
      pullRequest: 42,
      issueNumber: 564,
      snapshot: SNAPSHOT,
      runId: 123456,
      runAttempt: 2,
      triggerActor: "axross",
      triggerCommentId: 987654,
      status: "findings",
    });
    expect(payload.body).toContain("Observed: The predicate returns true");
    expect(payload.body).not.toContain("remains disabled until");
  });

  it("rejects mismatched sidecar identity", () => {
    const wrongSidecar = encodeRequirementsSidecar({
      repository: CONTEXT.repository,
      issueNumber: 999,
      issueNodeId: CONTEXT.issueNodeId,
      body: REQUIREMENTS,
    });

    expect(() =>
      sanitizeResult(JSON.stringify(result()), CONTEXT, wrongSidecar),
    ).toThrow("sidecar-context-mismatch");
  });

  it.each([
    ["run ID", { runId: Number.NaN }, "review-context-run-id-invalid"],
    ["run attempt", { runAttempt: 0 }, "review-context-run-attempt-invalid"],
    [
      "comment ID",
      { triggerCommentId: 1.5 },
      "review-context-trigger-comment-id-invalid",
    ],
    ["actor", { triggerActor: "actor\nspoof" }, "review-context-actor-invalid"],
  ])(
    "rejects invalid trusted %s before rendering",
    (_label, override, error) => {
      expect(() =>
        sanitizeResult(
          JSON.stringify(result()),
          { ...CONTEXT, ...override },
          sidecar(),
        ),
      ).toThrow(error);
    },
  );

  it("renders clean and blocked as distinguishable fixed statuses", () => {
    const clean = result({
      status: "clean",
      findings: [],
      blocked_reason: null,
    });
    const blocked = result({
      status: "blocked",
      findings: [],
      blocked_reason: "patch-unreadable",
    });

    expect(renderResult(clean, CONTEXT)).toContain(
      "Codex Action review: clean",
    );
    expect(renderResult(blocked, CONTEXT)).toContain(
      "Blocked reason: patch-unreadable",
    );
  });
});
