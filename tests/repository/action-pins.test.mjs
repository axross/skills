import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";

const { load: parseYaml } = createRequire(
  import.meta.resolve("markdownlint-cli2"),
)("js-yaml");
const PIN_WITH_RELEASE =
  /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}\s+#\s+v\d+\.\d+\.\d+\S*$/;

function checkActionPins(yaml) {
  const parsedUses = Object.values(parseYaml(yaml).jobs)
    .flatMap((job) => [job, ...(job.steps ?? [])])
    .filter((node) => Object.hasOwn(node, "uses"))
    .map((node) => node.uses)
    .filter((value) => !value.startsWith("./"));
  const labeledUses = [
    ...yaml.matchAll(
      /^[ \t]*(?:-[ \t]+)?(?:uses|"uses"|'uses')[ \t]*:[ \t]+(.+)$/gm,
    ),
  ]
    .map(([, line]) => ({
      ref: parseYaml(line),
      comment: line.match(/\s+#.*$/)?.[0] ?? "",
    }))
    .filter(({ ref }) => !ref.startsWith("./"));
  expect(labeledUses.map(({ ref }) => ref)).toEqual(parsedUses);
  for (const { ref, comment } of labeledUses) {
    expect(`${ref}${comment}`).toMatch(PIN_WITH_RELEASE);
  }
}

describe("CI action pins", () => {
  it("selects remote repository actions by full SHA with a release label", async () => {
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
    "- { uses: actions/checkout@v4 }",
    '- "uses": actions/checkout@v4',
    "- 'uses': actions/checkout@v4",
    '- "\\u0075ses": actions/checkout@v4',
  ])("rejects a mutable action in an alternate YAML form: %s", (step) => {
    expect(() =>
      checkActionPins(`jobs:\n  gate:\n    steps:\n      ${step}\n`),
    ).toThrow();
  });

  it.each([
    "uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0",
    '"uses": "actions/checkout@11d5960a326750d5838078e36cf38b85af677262" # v4.4.0',
    "'uses': 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262' # v4.4.0",
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

  it("checks reusable jobs while leaving local actions outside the pin requirement", () => {
    expect(() =>
      checkActionPins(
        "jobs:\n  local:\n    steps:\n      - uses: ./local-action\n  reused:\n    uses: axross/skills/.github/workflows/merge-checks.yaml@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0\n",
      ),
    ).not.toThrow();
  });

  it.each([
    "actions/checkout@v4 # v4.4.0",
    "anthropics/claude-code-action@main # v1.0.244",
    "actions/checkout@11d5960 # v4.4.0",
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  ])("rejects an unpinned or unlabeled reference: %s", (value) => {
    expect(() =>
      checkActionPins(`jobs:\n  gate:\n    steps:\n      - uses: ${value}\n`),
    ).toThrow();
  });
});
