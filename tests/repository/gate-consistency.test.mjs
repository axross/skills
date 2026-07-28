// The enforced-gate set must not drift between package.json and CI.
//
// The set of enforced gates lives in four places: this repository's `check`
// script, merge-checks.yaml's steps, README.md's commands table, and REVIEW.md's
// do-not-report enumeration. Update one and miss another and CI silently stops
// enforcing something the documentation claims it does.
//
// Two of those four can be tied mechanically, which is what this asserts. The
// README and REVIEW.md couplings stay prose and remain a reviewer's job.
//
// Since the link, skill-structure, and installed-copy checks became Vitest tests
// rather than npm run-scripts, the npm-script coupling covers three gates
// instead of six — and the ARGUMENTS that used to live in package.json now live
// in gates.mjs. The last case pins the one argument REVIEW.md's do-not-report
// list depends on, in its new home.

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";
import { gate, GATES } from "./gates.mjs";

/**
 * The npm scripts a shell command invokes. `npm test` is npm's own shorthand
 * for `npm run test`, so it normalizes to the same name; `npm install` names no
 * script and is ignored.
 * @param {string} command
 * @returns {Set<string>}
 */
function npmScriptsIn(command) {
  const scripts = new Set();
  for (const [, name] of command.matchAll(/npm\s+run\s+([\w:-]+)/g)) {
    scripts.add(name);
  }
  if (/npm\s+test\b/.test(command)) scripts.add("test");
  return scripts;
}

/** The `run:` command of every step in a workflow file. */
function workflowRunCommands(yaml) {
  return [...yaml.matchAll(/^\s*run:\s*"?([^"\n]+?)"?\s*$/gm)].map(
    ([, command]) => command,
  );
}

const readPackageJson = async () =>
  JSON.parse(await readFile(repoPath("package.json"), "utf8"));

const readWorkflow = () =>
  readFile(repoPath(".github/workflows/merge-checks.yaml"), "utf8");

const sorted = (set) => [...set].sort();

describe("enforced-gate consistency", () => {
  it("runs the same npm scripts in CI as in the aggregate check chain", async () => {
    const packageJson = await readPackageJson();
    const workflow = await readWorkflow();

    const inCheckChain = npmScriptsIn(packageJson.scripts.check);
    const inWorkflow = new Set(
      workflowRunCommands(workflow).flatMap((command) => [
        ...npmScriptsIn(command),
      ]),
    );

    expect(
      inCheckChain.size,
      "the check chain must run npm scripts",
    ).toBeGreaterThan(0);
    expect(
      sorted(inWorkflow),
      "merge-checks.yaml and package.json's `check` chain must enforce the same gates",
    ).toEqual(sorted(inCheckChain));
  });

  it("names only scripts that exist", async () => {
    const packageJson = await readPackageJson();

    for (const name of npmScriptsIn(packageJson.scripts.check)) {
      expect(
        Object.hasOwn(packageJson.scripts, name),
        `the check chain runs "${name}", which is not a defined script`,
      ).toBe(true);
    }
  });

  it("keeps every workflow check step on an npm script", async () => {
    const workflow = await readWorkflow();

    for (const command of workflowRunCommands(workflow)) {
      expect(
        command,
        `workflow step "${command}" bypasses the npm scripts the check chain is compared against`,
      ).toMatch(/^npm\s+(run\s+[\w:-]+|test|install)$/);
    }
  });

  it("runs the folded gates through `npm test`, not through their own scripts", async () => {
    const packageJson = await readPackageJson();

    expect(
      sorted(npmScriptsIn(packageJson.scripts.check)),
      "the check chain is format:check, lint, and the suite that carries the rest",
    ).toEqual(["format:check", "lint", "test"]);

    for (const { name } of GATES) {
      expect(
        Object.hasOwn(packageJson.scripts, name),
        `"${name}" is a Vitest gate now; a same-named npm script would run it twice and drift from gates.mjs`,
      ).toBe(false);
    }
  });

  it("keeps the skill-structure gate opted into the Claude Code field checks", () => {
    expect(
      gate("skill-structure").args,
      "REVIEW.md's do-not-report list excludes a missing `when_to_use`/`user-invocable` as CI-enforced, which holds only while this gate passes --require-claude-code-fields; the flag is off by default so the validator stays host-agnostic where it is installed",
    ).toContain("--require-claude-code-fields");
  });
});
