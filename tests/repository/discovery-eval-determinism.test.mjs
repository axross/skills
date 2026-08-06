// The determinism dispatch route must stay wired, stay refused where it cannot
// mean anything, and — above all — stay uncancellable.
//
// THE CONCURRENCY GROUP IS THE POINT OF THIS FILE. A determinism run is 30
// sequential probes whose entire value rests on the corpus not changing
// underneath them. Before this input existed, every dispatch that named no pull
// request and emitted no selection snapshot shared `discovery-eval-manual` with
// `cancel-in-progress: true` — so an ordinary report dispatched mid-run would
// have destroyed a measurement somebody paid for. That is not hypothetical
// reasoning: it is the defect this workflow already records having fixed once,
// for `emit_selection_snapshot`, and it would have arrived a second time by default.
//
// THE BRANCH ORDER MATTERS AS MUCH AS THE BRANCH. `determinism` is evaluated
// BEFORE `pull_request`. Ordered the other way, a determinism run that also
// named a pull request would fall into `discovery-eval-<n>` and share a group
// with an ordinary evaluation of that same pull request — the half of the
// hazard the obvious fix misses, and the half no test would catch unless it
// asserted the order explicitly.
//
// String assertions rather than a parsed document, matching
// discovery-eval-emit-selection-snapshot.test.mjs: this repository ships no YAML parser,
// and the coupling worth protecting is that these strings appear at all.

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";

const readWorkflow = () =>
  readFile(repoPath(".github/workflows/discovery-eval.yaml"), "utf8");

/** The exact group string a determinism dispatch must land in. */
const DETERMINISM_GROUP = "discovery-eval-determinism-";

describe("the discovery evaluation's determinism dispatch", () => {
  it("declares the input with no default", async () => {
    const yaml = await readWorkflow();
    expect(yaml).toMatch(/determinism:\s*\n(\s+#.*\n)*\s+description:[^\n]*\n\s+required: false\s*\n/);
    // No `type:` and no `default:` — see the next test for why that decides
    // which context reads it.
    expect(yaml).not.toMatch(/determinism:\s*\n(\s+.*\n)*?\s+default:/);
  });

  it("reads the input through github.event.inputs, matching its undefaulted neighbours", async () => {
    const yaml = await readWorkflow();
    // Only the typed `inputs` context applies a declared default, so an input
    // WITHOUT one must be read the untyped way — as `pull_request` and
    // `repeats` are, and unlike `emit_selection_snapshot`, which has a default and would
    // read as empty through this context.
    expect(yaml).toContain("DETERMINISM: ${{ github.event.inputs.determinism }}");
    expect(yaml).not.toContain("DETERMINISM: ${{ inputs.determinism }}");
  });

  it("gives a determinism run its own concurrency group, named exactly", async () => {
    const yaml = await readWorkflow();
    const group = yaml.match(/group: (.*)/)?.[1] ?? "";

    // The literal prefix stays OUTSIDE the expression, where it already sat, so
    // the branch contributes only `determinism-<case>` and the resulting group
    // is the string pinned here.
    expect(group.startsWith("discovery-eval-${{")).toBe(true);
    expect(group).toContain("format('determinism-{0}', github.event.inputs.determinism)");
    expect(yaml).toMatch(/group:[^\n]*\n\s+cancel-in-progress: true/);
  });

  it("evaluates the determinism branch before the pull request one", async () => {
    const yaml = await readWorkflow();
    const group = yaml.match(/group: (.*)/)?.[1] ?? "";
    const determinism = group.indexOf("github.event.inputs.determinism");
    const pullRequest = group.indexOf("github.event.inputs.pull_request");

    expect(determinism).toBeGreaterThan(-1);
    expect(pullRequest).toBeGreaterThan(-1);
    // Reversed, a determinism run naming a pull request would share that pull
    // request's group with an ordinary evaluation of it.
    expect(determinism).toBeLessThan(pullRequest);
  });

  it("lands each dispatch shape in the group it should", async () => {
    const yaml = await readWorkflow();
    const group = yaml.match(/group: (.*)/)?.[1] ?? "";
    // The expression's own semantics, evaluated the way Actions does: `&&`
    // yields its right side when the left is truthy, `||` falls through empties.
    expect(group).toContain("|| github.event.inputs.pull_request ||");
    expect(group).toContain("|| (inputs.emit_selection_snapshot && 'emit-selection-snapshot') || 'manual'");

    const resolve = (determinism, pullRequest, emitSelectionSnapshot) =>
      `${DETERMINISM_GROUP.replace("determinism-", "")}${
        (determinism && `determinism-${determinism}`) ||
        pullRequest ||
        (emitSelectionSnapshot && "emit-selection-snapshot") ||
        "manual"
      }`;

    expect(resolve("", "", false)).toBe("discovery-eval-manual");
    expect(resolve("", "42", false)).toBe("discovery-eval-42");
    expect(resolve("", "", true)).toBe("discovery-eval-emit-selection-snapshot");
    expect(resolve("hf-touch-targets", "", false)).toBe(
      `${DETERMINISM_GROUP}hf-touch-targets`,
    );
    // The half a naive fix misses.
    expect(resolve("hf-touch-targets", "42", false)).toBe(
      `${DETERMINISM_GROUP}hf-touch-targets`,
    );
  });

  it("passes --determinism and --only together, only when the input is set", async () => {
    const yaml = await readWorkflow();
    expect(yaml).toContain('if [ -n "${DETERMINISM}" ]; then');
    // Both flags or neither: the runner refuses --determinism without exactly
    // one --only, so splitting them would turn a dispatch typo into an exit 2
    // the maintainer has to decode out of the log.
    expect(yaml).toContain('args+=(--determinism --only "${DETERMINISM}")');
  });

  it("refuses the emit_selection_snapshot combination from a step of its own", async () => {
    const yaml = await readWorkflow();
    expect(yaml).toMatch(/if: env\.EMIT_SELECTION_SNAPSHOT == 'true' && env\.DETERMINISM != ''/);
    expect(yaml).toMatch(/::error::determinism cannot be combined with emit_selection_snapshot/);

    // A SEPARATE STEP, not a widened `if:` on the existing one. That step is
    // named for head text and its message is entirely about pull request
    // numbers; firing it here would print a reason that has nothing to do with
    // what was dispatched.
    const headText = yaml.indexOf("Refuse to emit a selection snapshot from head text");
    const singleCase = yaml.indexOf("Refuse to emit a selection snapshot from a single-case probe");
    expect(headText).toBeGreaterThan(-1);
    expect(singleCase).toBeGreaterThan(-1);
    expect(singleCase).not.toBe(headText);
    expect(yaml).not.toMatch(/if: env\.EMIT_SELECTION_SNAPSHOT == 'true' && \(env\.PR_NUMBER/);
  });

  it("refuses before spending anything", async () => {
    const yaml = await readWorkflow();
    const guard = yaml.indexOf("Refuse to emit a selection snapshot from a single-case probe");
    expect(guard).toBeLessThan(yaml.indexOf("Checkout default branch"));
    expect(guard).toBeLessThan(yaml.indexOf("Run the evaluation"));
  });

  it("does not refuse a determinism run that names a pull request", async () => {
    const yaml = await readWorkflow();
    // Explicitly allowed: measuring a changed skill's stability against its own
    // head text is a reasonable ask, and it produces a report rather than a
    // committable document, so nothing un-merged gets fingerprinted.
    expect(yaml).not.toMatch(/env\.DETERMINISM != '' && env\.PR_NUMBER != ''/);
    expect(yaml).not.toMatch(/env\.PR_NUMBER != '' && env\.DETERMINISM != ''/);
  });

  it("posts a preamble that follows the mode, keeping the not-a-gate line in both", async () => {
    const yaml = await readWorkflow();
    expect(yaml).toContain("## Skill discovery determinism probe");
    expect(yaml).toContain("## Skill discovery evaluation");

    // The not-a-gate line is emitted ONCE, outside the branch, so neither mode
    // can lose it by being edited alone.
    expect(yaml.match(/\*\*This is not a gate\*\*/g)).toHaveLength(1);
  });

  it("changes no safety property, permission, or trigger", async () => {
    const yaml = await readWorkflow();
    // All four load-bearing properties still stated, and still four. A change
    // that silently dropped one would leave a file whose own header claims a
    // guarantee nothing documents.
    expect(yaml.match(/LOAD-BEARING SAFETY PROPERTY \d of 4/g)).toHaveLength(4);

    expect(yaml).toMatch(/permissions:\n\s+contents: read\n\s+pull-requests: write\n/);
    expect(yaml).not.toContain("contents: write");

    // Manual dispatch remains the ONLY trigger. Scoped to the `on:` block
    // rather than the whole file: `pull_request` is also the name of a
    // dispatch INPUT, so a file-wide search for it would match the legitimate
    // one and never fail.
    const triggers = yaml.slice(yaml.indexOf("\non:\n") + 1);
    const onBlock = triggers.slice(0, triggers.search(/\n[a-z]/));
    expect(onBlock.match(/^ {2}\w[\w-]*:/gm)).toEqual(["  workflow_dispatch:"]);
    expect(onBlock).not.toContain("pull_request_target");

    // Still the default branch, never a head ref.
    expect(yaml).toContain("uses: actions/checkout@v4");
    expect(yaml).not.toContain("head.sha }}");
  });
});
