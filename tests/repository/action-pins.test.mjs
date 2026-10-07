import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";

const { load: parseYaml } = createRequire(
  import.meta.resolve("markdownlint-cli2"),
)("js-yaml");
const TRUSTED_VERSION_TAG =
  /^(?:actions\/(?:checkout|setup-node|upload-artifact|download-artifact)@v4|actions\/github-script@v7|anthropics\/claude-code-action@v1)(?:\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))?$/;
const PIN_WITH_RELEASE =
  /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}\s+#\s+v\d+\.\d+\.\d+\S*$/;

function checkActionPins(yaml) {
  // Reparse a checking-only copy so each label stays at its own mapping entry.
  const labeledYaml = yaml.replace(
    /^([ \t]*(?:-[ \t]+)?(?:uses|"uses"|'uses')[ \t]*:[ \t]+)(.+)$/gm,
    (_, prefix, line) =>
      prefix +
      JSON.stringify([parseYaml(line), line.match(/\s+#.*$/)?.[0] ?? ""]),
  );
  const labeledJobs = parseYaml(labeledYaml).jobs;
  for (const [name, job] of Object.entries(parseYaml(yaml).jobs)) {
    const labeledNodes = [
      labeledJobs[name],
      ...(labeledJobs[name].steps ?? []),
    ];
    for (const [index, node] of [job, ...(job.steps ?? [])].entries()) {
      if (!Object.hasOwn(node, "uses")) continue;
      expect(typeof node.uses).toBe("string");
      if (node.uses.startsWith("./")) continue;
      if (TRUSTED_VERSION_TAG.test(node.uses)) continue;
      const labeled = labeledNodes[index].uses;
      expect(Array.isArray(labeled)).toBe(true);
      expect(labeled[0]).toBe(node.uses);
      expect(`${labeled[0]}${labeled[1]}`).toMatch(PIN_WITH_RELEASE);
    }
  }
}

describe("CI action references", () => {
  it("selects trusted version tags or full SHAs with release labels", async () => {
    const files = (await readdir(repoPath(".github/workflows"))).filter(
      (file) => /\.ya?ml$/.test(file),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const yaml = await readFile(repoPath(".github/workflows", file), "utf8");
      checkActionPins(yaml);
    }
  });

  it.each([
    "actions/checkout@v4",
    "actions/checkout@v4.4.0",
    "actions/checkout@v4.0.0",
    "actions/checkout@v4.10.0",
    "actions/setup-node@v4.4.0",
    "actions/upload-artifact@v4",
    "actions/download-artifact@v4",
    "actions/github-script@v7",
    "anthropics/claude-code-action@v1",
    "anthropics/claude-code-action@v1.0.244",
  ])("accepts a trusted publisher's version tag without a SHA label: %s", (value) => {
    expect(() =>
      checkActionPins(`jobs:\n  gate:\n    steps:\n      - uses: ${value}\n`),
    ).not.toThrow();
  });

  it.each([
    "- { uses: actions/checkout@v4 }",
    '- "uses": actions/checkout@v4',
    "- 'uses': actions/checkout@v4",
    '- "\\u0075ses": actions/checkout@v4',
  ])("accepts a trusted version tag in an alternate YAML form: %s", (step) => {
    expect(() =>
      checkActionPins(`jobs:\n  gate:\n    steps:\n      ${step}\n`),
    ).not.toThrow();
  });

  it.each([
    "- { uses: third-party/action@v4 }",
    '- "uses": third-party/action@v4',
    "- 'uses': third-party/action@v4",
    '- "\\u0075ses": third-party/action@v4',
  ])("rejects an untrusted tag in an alternate YAML form: %s", (step) => {
    expect(() =>
      checkActionPins(`jobs:\n  gate:\n    steps:\n      ${step}\n`),
    ).toThrow();
  });

  it.each([
    "uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0",
    '"uses": "actions/checkout@11d5960a326750d5838078e36cf38b85af677262" # v4.4.0',
    "'uses': 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262' # v4.4.0",
    "uses: third-party/action@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0",
  ])("accepts a labeled full pin in a block mapping: %s", (entry) => {
    expect(() =>
      checkActionPins(`jobs:\n  gate:\n    steps:\n      - ${entry}\n`),
    ).not.toThrow();
  });

  it("rejects an unmatched flow mapping even when its action is pinned", () => {
    expect(() =>
      checkActionPins(
        "jobs:\n  gate:\n    steps:\n      - { uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 } # v4.4.0\n",
      ),
    ).toThrow();
  });

  it("does not borrow an unrelated environment entry's release label", () => {
    expect(() =>
      checkActionPins(
        "env:\n  uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0\njobs:\n  gate:\n    steps:\n      - { uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 }\n",
      ),
    ).toThrow();
  });

  it("ignores an unrelated environment entry when the action has its own label", () => {
    expect(() =>
      checkActionPins(
        "env:\n  uses: not-an-action\njobs:\n  gate:\n    steps:\n      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0\n",
      ),
    ).not.toThrow();
  });

  it("checks reusable jobs while leaving local actions outside the remote requirement", () => {
    expect(() =>
      checkActionPins(
        "jobs:\n  local:\n    steps:\n      - uses: ./local-action\n  reused:\n    uses: axross/skills/.github/workflows/merge-checks.yaml@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0\n",
      ),
    ).not.toThrow();
  });

  it.each([
    "third-party/action@v4 # v4.4.0",
    "actions/unlisted-action@v4",
    "actions-fork/checkout@v4",
    "anthropics/unlisted-action@v1",
    "someone/claude-code-action@v1",
    "actions/checkout@v5",
    "actions/checkout@v999",
    "actions/setup-node@v3.4.0",
    "actions/github-script@v4",
    "anthropics/claude-code-action@v42",
    "actions/checkout@main",
    "anthropics/claude-code-action@main # v1.0.244",
    "actions/checkout@v4.1.2.3",
    "actions/checkout@v4.4",
    "actions/checkout@v4.0",
    "actions/checkout@v4.04",
    "actions/checkout@v4.01.002",
    "actions/checkout@v4.0.01",
    "actions/checkout@v4-unexpected",
    "actions/checkout@v4/branch",
    "actions/checkout@11d5960 # v4.4.0",
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  ])("rejects an untrusted tag, unapproved version, branch, or incomplete pin: %s", (value) => {
    expect(() =>
      checkActionPins(`jobs:\n  gate:\n    steps:\n      - uses: ${value}\n`),
    ).toThrow();
  });
});
