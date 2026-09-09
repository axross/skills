import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanupReviewDirectory } from "../../.github/codex-action-review/cleanup.mjs";
import {
  assertReviewDirectory,
  countTextLines,
  decodeRequirementsSidecar,
  encodeRequirementsSidecar,
  fetchClosingIssue,
  isReviewControlPath,
  parseChangedFiles,
  prepareContext,
  requirementIdentifiers,
} from "../../.github/codex-action-review/prepare-context.mjs";

const execFileAsync = promisify(execFile);

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(data, { headers = {}, status = 200 } = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json", ...headers },
    status,
  });
}

function closingIssueResponse({
  body = "REQ-1 Preserve café ☕\n<!-- private planning note -->\n",
  issueRepository = "axross/skills",
  nodes,
  state = "OPEN",
} = {}) {
  return {
    data: {
      repository: {
        pullRequest: {
          number: 42,
          state,
          closingIssuesReferences: {
            nodes: nodes ?? [
              {
                id: "I_kwDOExample",
                number: 564,
                body,
                repository: { nameWithOwner: issueRepository },
              },
            ],
            pageInfo: { hasNextPage: false },
          },
        },
      },
    },
  };
}

async function createMergeSnapshot(root, { changeBase, changePullRequest }) {
  const checkout = join(root, "pr-checkout");
  await mkdir(checkout);
  await execFileAsync("git", ["init", "--quiet", "--initial-branch=base"], {
    cwd: checkout,
  });
  await execFileAsync("git", ["config", "user.email", "test@example.invalid"], {
    cwd: checkout,
  });
  await execFileAsync("git", ["config", "user.name", "Test"], {
    cwd: checkout,
  });
  await execFileAsync("git", ["config", "commit.gpgsign", "false"], {
    cwd: checkout,
  });
  await writeFile(join(checkout, "example.mjs"), "export const value = 1;\n");
  await writeFile(join(checkout, "REVIEW.md"), "trusted policy\n");
  await execFileAsync("git", ["add", "."], { cwd: checkout });
  await execFileAsync("git", ["commit", "--quiet", "-m", "base"], {
    cwd: checkout,
  });

  await execFileAsync("git", ["switch", "--quiet", "-c", "change"], {
    cwd: checkout,
  });
  await changePullRequest(checkout);
  await execFileAsync("git", ["add", "--all"], { cwd: checkout });
  await execFileAsync("git", ["commit", "--quiet", "-m", "change"], {
    cwd: checkout,
  });

  await execFileAsync("git", ["switch", "--quiet", "base"], { cwd: checkout });
  if (changeBase) {
    await changeBase(checkout);
    await execFileAsync("git", ["add", "--all"], { cwd: checkout });
    await execFileAsync("git", ["commit", "--quiet", "-m", "base advances"], {
      cwd: checkout,
    });
  }
  await execFileAsync(
    "git",
    ["merge", "--quiet", "--no-ff", "change", "-m", "merge"],
    {
      cwd: checkout,
    },
  );
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: checkout,
  });
  return { checkout, snapshot: stdout.trim() };
}

function reviewEnvironment(
  root,
  checkout,
  snapshot,
  trusted = join(root, "trusted"),
) {
  return {
    GITHUB_GRAPHQL_URL: "https://api.github.test/graphql",
    GITHUB_REPOSITORY: "axross/skills",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_RUN_ID: "123",
    GITHUB_TOKEN: "test-token",
    PR_CHECKOUT: checkout,
    PR_NUMBER: "42",
    PR_SNAPSHOT_SHA: snapshot,
    REVIEW_DIRECTORY: join(root, "codex-action-review-123-1"),
    RUNNER_TEMP: root,
    TRIGGER_ACTOR: "axross",
    TRIGGER_COMMENT_ID: "987",
    TRUSTED_CHECKOUT: trusted,
  };
}

describe("requirements sidecar", () => {
  it("round-trips Unicode, HTML comments, blank lines, and the final newline", () => {
    const body = "REQ-9 Keep café ☕\n\n<!-- retained -->\n";
    const sidecar = encodeRequirementsSidecar({
      repository: "axross/skills",
      issueNumber: 564,
      issueNodeId: "I_kwDOExample",
      body,
    });

    expect(decodeRequirementsSidecar(sidecar)).toEqual({
      repository: "axross/skills",
      issueNumber: 564,
      issueNodeId: "I_kwDOExample",
      body,
      lineCount: 4,
    });
    expect(sidecar).toContain("L000003|<!-- retained -->");
    expect(sidecar.endsWith("L000004|")).toBe(true);
  });

  it("rejects a changed line locator instead of silently readdressing the body", () => {
    const sidecar = encodeRequirementsSidecar({
      repository: "axross/skills",
      issueNumber: 564,
      issueNodeId: "I_kwDOExample",
      body: "first\nsecond",
    }).replace("L000002|", "L000099|");

    expect(() => decodeRequirementsSidecar(sidecar)).toThrow(
      "invalid-sidecar-locator",
    );
  });

  it("collects only explicit requirement identifiers", () => {
    expect(
      requirementIdentifiers("REQ-9 AC-2 REQ-9 issue-564 requirement"),
    ).toEqual(["AC-2", "REQ-9"]);
  });
});

describe("countTextLines()", () => {
  it.each([
    ["an empty file", Buffer.alloc(0), 0],
    ["one newline-terminated line", Buffer.from("one\n"), 1],
    ["two lines without a final newline", Buffer.from("one\ntwo"), 2],
    ["Unicode text", Buffer.from("café\n東京\n"), 2],
    ["NUL-delimited binary data", Buffer.from([0x61, 0x00, 0x62]), null],
    ["invalid UTF-8", Buffer.from([0xc3, 0x28]), null],
  ])("counts %s", (_label, contents, expected) => {
    expect(countTextLines(contents)).toBe(expected);
  });
});

describe("review control paths", () => {
  it.each([
    "AGENTS.md",
    "packages/example/AGENTS.override.md",
    ".codex/config.toml",
    ".github/codex-action-review/validate-result.mjs",
    ".github/workflows/claude-review.yaml",
    ".github/workflows/codex-action-review.yaml",
    ".markdownlint-cli2.jsonc",
    "REVIEW.md",
    "skills/code-review/SKILL.md",
    ".agents/skills/code-review/SKILL.md",
    ".claude/skills/code-review",
    "docs/operations/code-review.md",
    "package.json",
    "tests/helpers/run.mjs",
    "tests/repository/codex-action-review-workflow.test.mjs",
    "tests/repository/gate-runs.test.mjs",
    "tests/unit/codex-action-review-validator.test.mjs",
  ])("blocks %s before model execution", (path) => {
    expect(isReviewControlPath(path)).toBe(true);
  });

  it.each([
    "README.md",
    "scripts/report-obligation-burden.mjs",
    "tests/unit/example.test.mjs",
  ])("does not classify %s as a review control", (path) => {
    expect(isReviewControlPath(path)).toBe(false);
  });
});

describe("assertReviewDirectory()", () => {
  it("accepts one uniquely named child of the runner temporary directory", () => {
    expect(
      assertReviewDirectory(
        "/runner/temp/codex-action-review-123-2",
        "/runner/temp",
      ),
    ).toBe("/runner/temp/codex-action-review-123-2");
  });

  it.each([
    "/runner/temp/review-123",
    "/runner/temp/nested/codex-action-review-123",
    "/runner/temp/codex-action-review-123/..",
  ])("rejects unsafe location %s", (path) => {
    expect(() => assertReviewDirectory(path, "/runner/temp")).toThrow(
      "invalid-review-directory",
    );
  });
});

describe("cleanupReviewDirectory()", () => {
  it("removes only the validated private review directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-action-review-test-"));
    const reviewDirectory = join(root, "codex-action-review-123-1");
    await mkdir(reviewDirectory);
    await writeFile(
      join(reviewDirectory, "requirements.sidecar"),
      "private data",
    );

    await cleanupReviewDirectory(reviewDirectory, root);

    await expect(stat(reviewDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("refuses a path outside the runner temporary directory", async () => {
    await expect(
      cleanupReviewDirectory("/tmp/codex-action-review-wrong", "/runner/temp"),
    ).rejects.toThrow("invalid-review-directory");
  });
});

describe("parseChangedFiles()", () => {
  it("parses NUL-delimited snapshot paths and normalizes Git statuses", () => {
    expect(
      parseChangedFiles(Buffer.from("M\0one.mjs\0A\0two.mjs\0D\0old.mjs\0")),
    ).toEqual([
      { path: "one.mjs", status: "modified" },
      { path: "two.mjs", status: "added" },
      { path: "old.mjs", status: "removed" },
    ]);
  });

  it.each([
    ["an empty diff", Buffer.alloc(0), "changed-files-empty"],
    [
      "invalid UTF-8",
      Buffer.from([0x4d, 0, 0xc3, 0x28, 0]),
      "changed-files-encoding-invalid",
    ],
    [
      "a missing final delimiter",
      Buffer.from("M\0one.mjs"),
      "changed-files-invalid",
    ],
    [
      "an unsupported status",
      Buffer.from("U\0one.mjs\0"),
      "changed-file-status-invalid",
    ],
    [
      "a control character in a path",
      Buffer.from("M\0one\ntwo.mjs\0"),
      "changed-file-path-invalid",
    ],
  ])("rejects %s", (_label, output, error) => {
    expect(() => parseChangedFiles(output)).toThrow(error);
  });

  it("fails closed above the changed-file limit", () => {
    const output = Buffer.from(
      Array.from(
        { length: 1_001 },
        (_, index) => `M\0file-${index}.mjs\0`,
      ).join(""),
    );

    expect(() => parseChangedFiles(output)).toThrow("too-many-changed-files");
  });
});

describe("fetchClosingIssue()", () => {
  it("returns the one open same-repository native closing Issue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(closingIssueResponse())),
    );

    await expect(
      fetchClosingIssue({
        graphqlUrl: "https://api.github.test/graphql",
        repository: "axross/skills",
        pullRequest: 42,
        token: "test-token",
      }),
    ).resolves.toEqual({
      number: 564,
      nodeId: "I_kwDOExample",
      body: "REQ-1 Preserve café ☕\n<!-- private planning note -->\n",
    });
  });

  it.each([
    ["zero Issues", { nodes: [] }, "closing-issue-count-invalid"],
    [
      "multiple Issues",
      {
        nodes: [
          {
            id: "one",
            number: 1,
            body: "one",
            repository: { nameWithOwner: "axross/skills" },
          },
          {
            id: "two",
            number: 2,
            body: "two",
            repository: { nameWithOwner: "axross/skills" },
          },
        ],
      },
      "closing-issue-count-invalid",
    ],
    [
      "a cross-repository Issue",
      { issueRepository: "someone/fork" },
      "closing-issue-cross-repository",
    ],
    ["an empty body", { body: " \n " }, "closing-issue-body-empty"],
    [
      "an invalid Issue identity",
      {
        nodes: [
          {
            id: "",
            number: 564,
            body: "body",
            repository: { nameWithOwner: "axross/skills" },
          },
        ],
      },
      "closing-issue-identity-invalid",
    ],
    ["a closed pull request", { state: "CLOSED" }, "pull-request-not-open"],
  ])("fails closed for %s", async (_label, options, error) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(closingIssueResponse(options))),
    );

    await expect(
      fetchClosingIssue({
        graphqlUrl: "https://api.github.test/graphql",
        repository: "axross/skills",
        pullRequest: 42,
        token: "test-token",
      }),
    ).rejects.toThrow(error);
  });

  it("blocks an unsupported body instead of truncating it", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(closingIssueResponse({ body: "界".repeat(90_000) })),
        ),
    );

    await expect(
      fetchClosingIssue({
        graphqlUrl: "https://api.github.test/graphql",
        repository: "axross/skills",
        pullRequest: 42,
        token: "test-token",
      }),
    ).rejects.toThrow("closing-issue-body-too-large");
  });
});

describe("prepareContext()", () => {
  it("creates private sidecars from the merge snapshot and removes the PR checkout", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-action-review-test-"));
    const trusted = join(root, "trusted");
    const reviewDirectory = join(root, "codex-action-review-123-1");
    await mkdir(trusted);
    await writeFile(join(trusted, "REVIEW.md"), "trusted policy\n");
    const { checkout, snapshot } = await createMergeSnapshot(root, {
      changePullRequest: async (path) => {
        await writeFile(join(path, "example.mjs"), "export const value = 2;\n");
      },
      changeBase: async (path) => {
        await writeFile(
          join(path, "base-only.mjs"),
          "export const base = true;\n",
        );
      },
    });

    const issueBody = "REQ-7 Keep café ☕\n<!-- exact canonical bytes -->\n";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(closingIssueResponse({ body: issueBody })),
      );
    vi.stubGlobal("fetch", fetchMock);

    await prepareContext(reviewEnvironment(root, checkout, snapshot, trusted));

    await expect(stat(checkout)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await stat(reviewDirectory)).mode & 0o777).toBe(0o700);
    for (const name of [
      "prompt.txt",
      "pull-request.patch",
      "requirements.sidecar",
      "review-context.json",
    ]) {
      expect((await stat(join(reviewDirectory, name))).mode & 0o777).toBe(
        0o600,
      );
    }
    expect(
      decodeRequirementsSidecar(
        await readFile(join(reviewDirectory, "requirements.sidecar"), "utf8"),
      ).body,
    ).toBe(issueBody);
    const patch = await readFile(
      join(reviewDirectory, "pull-request.patch"),
      "utf8",
    );
    expect(patch).toContain("+export const value = 2;");
    expect(patch).not.toContain("base-only.mjs");
    const prompt = await readFile(join(reviewDirectory, "prompt.txt"), "utf8");
    expect(prompt).not.toContain(issueBody);
    expect(prompt).toContain("Closing Issue: 564");
    expect(prompt).toContain(
      "Inspect only the supplied static patch, requirements sidecar, trusted context metadata, and trusted policy files.",
    );
    const context = JSON.parse(
      await readFile(join(reviewDirectory, "review-context.json"), "utf8"),
    );
    expect(context.files).toEqual([
      { path: "example.mjs", status: "modified", lineCount: 1 },
    ]);
    expect(JSON.stringify(context)).not.toContain("exact canonical bytes");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blocks a control change before requesting the closing Issue body", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-action-review-test-"));
    const { checkout, snapshot } = await createMergeSnapshot(root, {
      changePullRequest: async (path) => {
        await writeFile(join(path, "REVIEW.md"), "changed policy\n");
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      prepareContext(reviewEnvironment(root, checkout, snapshot)),
    ).rejects.toThrow("review-control-change-blocked");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks a control file renamed to a non-control path", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-action-review-test-"));
    const { checkout, snapshot } = await createMergeSnapshot(root, {
      changePullRequest: async (path) => {
        await mkdir(join(path, "docs"));
        await execFileAsync(
          "git",
          ["mv", "REVIEW.md", "docs/retired-review-policy.md"],
          {
            cwd: path,
          },
        );
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      prepareContext(reviewEnvironment(root, checkout, snapshot)),
    ).rejects.toThrow("review-control-change-blocked");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records addressable lines from a text file removed by the pull request", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-action-review-test-"));
    const trusted = join(root, "trusted");
    await mkdir(trusted);
    await writeFile(join(trusted, "REVIEW.md"), "trusted policy\n");
    const { checkout, snapshot } = await createMergeSnapshot(root, {
      changePullRequest: async (path) => {
        await execFileAsync("git", ["rm", "example.mjs"], { cwd: path });
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(closingIssueResponse())),
    );

    await prepareContext(reviewEnvironment(root, checkout, snapshot, trusted));

    const context = JSON.parse(
      await readFile(
        join(root, "codex-action-review-123-1", "review-context.json"),
        "utf8",
      ),
    );
    expect(context.files).toEqual([
      { path: "example.mjs", status: "removed", lineCount: 1 },
    ]);
  });

  it("blocks a missing merge snapshot before requesting the closing Issue body", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-action-review-test-"));
    const checkout = join(root, "pr-checkout");
    await mkdir(checkout);
    await execFileAsync("git", ["init", "--quiet"], { cwd: checkout });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      prepareContext(
        reviewEnvironment(
          root,
          checkout,
          "0123456789abcdef0123456789abcdef01234567",
        ),
      ),
    ).rejects.toThrow("merge-snapshot-unreadable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["GITHUB_RUN_ID", "not-a-number", "run-id-invalid"],
    ["GITHUB_RUN_ATTEMPT", "0", "run-attempt-invalid"],
    ["TRIGGER_COMMENT_ID", "1.5", "trigger-comment-id-invalid"],
    ["TRIGGER_ACTOR", "actor\nspoof", "trigger-actor-invalid"],
  ])("rejects invalid trusted metadata in %s", async (name, value, error) => {
    const root = await mkdtemp(join(tmpdir(), "codex-action-review-test-"));
    const environment = {
      GITHUB_GRAPHQL_URL: "https://api.github.test/graphql",
      GITHUB_REPOSITORY: "axross/skills",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_RUN_ID: "123",
      GITHUB_TOKEN: "test-token",
      PR_CHECKOUT: join(root, "unused-checkout"),
      PR_NUMBER: "42",
      PR_SNAPSHOT_SHA: "0123456789abcdef0123456789abcdef01234567",
      REVIEW_DIRECTORY: join(root, "codex-action-review-123-1"),
      RUNNER_TEMP: root,
      TRIGGER_ACTOR: "axross",
      TRIGGER_COMMENT_ID: "987",
      TRUSTED_CHECKOUT: join(root, "trusted"),
      [name]: value,
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(prepareContext(environment)).rejects.toThrow(error);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
