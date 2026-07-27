// The enforced-gate set must not drift between package.json and CI.
//
// After the aggregate `check` chain and the merge-checks workflow both grew
// beyond format/lint/links, the set of gates lives in four places: this
// repository's `check` script, merge-checks.yaml's steps, README.md's commands
// table, and REVIEW.md's do-not-report enumeration. Update one and miss another
// and CI silently stops enforcing something the documentation claims it does.
//
// Two of those four can be tied mechanically, which is what this asserts. The
// README and REVIEW.md couplings stay prose and remain a reviewer's job.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { repoPath } from "./helpers/run.mjs";

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

const sorted = (set) => [...set].sort();

describe("enforced-gate consistency", () => {
  it("runs the same npm scripts in CI as in the aggregate check chain", async () => {
    const packageJson = JSON.parse(
      await readFile(repoPath("package.json"), "utf8"),
    );
    const workflow = await readFile(
      repoPath(".github/workflows/merge-checks.yaml"),
      "utf8",
    );

    const inCheckChain = npmScriptsIn(packageJson.scripts.check);
    const inWorkflow = new Set(
      workflowRunCommands(workflow).flatMap((command) => [
        ...npmScriptsIn(command),
      ]),
    );

    assert.ok(inCheckChain.size > 0, "the check chain must run npm scripts");
    assert.deepEqual(
      sorted(inWorkflow),
      sorted(inCheckChain),
      "merge-checks.yaml and package.json's `check` chain must enforce the same gates",
    );
  });

  it("names only scripts that exist", async () => {
    const packageJson = JSON.parse(
      await readFile(repoPath("package.json"), "utf8"),
    );

    for (const name of npmScriptsIn(packageJson.scripts.check)) {
      assert.ok(
        Object.hasOwn(packageJson.scripts, name),
        `the check chain runs "${name}", which is not a defined script`,
      );
    }
  });

  it("keeps every workflow check step on an npm script", async () => {
    const workflow = await readFile(
      repoPath(".github/workflows/merge-checks.yaml"),
      "utf8",
    );

    for (const command of workflowRunCommands(workflow)) {
      assert.match(
        command,
        /^npm\s+(run\s+[\w:-]+|test|install)$/,
        `workflow step "${command}" bypasses the npm scripts the check chain is compared against`,
      );
    }
  });
});
