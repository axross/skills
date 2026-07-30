// The baseline-emitting dispatch route must stay wired, and stay refused where
// it would produce a document that lies.
//
// Re-recording the discovery baseline is the one maintenance task on this
// evaluation that costs real money, and until this route existed the only way to
// do it was a local run by someone holding the Claude Code CLI and working
// authentication. The workflow is now the documented path, so the pieces it
// depends on — the input, the flag, the extractor, the artifact — are asserted
// here rather than rediscovered by a maintainer whose $5 run produced no file.
//
// The refusal matters more than the wiring. A dispatch that names a pull request
// overlays that pull request's head SKILL.md files, so an emitted `corpus` would
// fingerprint UN-MERGED text. The resulting document looks exactly like a
// committable baseline and is not one — committing it would record a
// measurement against text that exists on no branch, which is the precise
// staleness the corpus fingerprint was added to catch. That guard is cheap to
// hold and expensive to lose.
//
// String assertions rather than a parsed document: this repository ships no YAML
// parser, and the coupling worth protecting is that these strings appear at all.

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";

const readWorkflow = () =>
  readFile(repoPath(".github/workflows/discovery-eval.yaml"), "utf8");

describe("the discovery evaluation's baseline-emitting dispatch", () => {
  it("offers emit_baseline as a boolean input that defaults to off", async () => {
    const yaml = await readWorkflow();
    expect(yaml).toMatch(/emit_baseline:\s*\n(\s+.*\n)*?\s+type: boolean/);
    expect(yaml).toMatch(/emit_baseline:\s*\n(\s+.*\n)*?\s+default: false/);
  });

  it("passes --emit-baseline only when that input is set", async () => {
    const yaml = await readWorkflow();
    // Guarded, not unconditional: an ordinary dispatch must behave exactly as it
    // did before this route existed, since every such run costs the same money
    // and most of them are not re-records.
    expect(yaml).toContain('if [ "${EMIT_BASELINE}" = "true" ]; then');
    expect(yaml).toContain("args+=(--emit-baseline)");
  });

  it("refuses a dispatch that asks for a baseline from a pull request", async () => {
    const yaml = await readWorkflow();
    expect(yaml).toMatch(/if: env\.EMIT_BASELINE == 'true' && env\.PR_NUMBER != ''/);
    // Fails rather than warns. A warning would sit above ~90 lines of
    // plausible-looking JSON, and the damage it prevents is invisible once
    // committed.
    expect(yaml).toMatch(/::error::emit_baseline cannot be combined/);
    expect(yaml).toContain("exit 1");
  });

  it("refuses before spending anything", async () => {
    const yaml = await readWorkflow();
    // The guard is worth nothing if it fires after 190 probes. Asserting it
    // precedes the checkout is a proxy for "before any money is spent" that does
    // not depend on how the run step is currently written.
    const guard = yaml.indexOf("Refuse to emit a baseline from head text");
    const checkout = yaml.indexOf("Checkout default branch");
    const evaluate = yaml.indexOf("Run the evaluation");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(checkout);
    expect(guard).toBeLessThan(evaluate);
  });

  it("delivers the document as an artifact rather than as log text", async () => {
    const yaml = await readWorkflow();
    // The document has to land byte-exact in a committed file. Transcribing it
    // out of a log viewer is the one step of a re-record a human can silently
    // get wrong, and `npm run format:check` would only catch the damage after
    // the commit.
    expect(yaml).toContain("scripts/discovery-eval/extract-baseline.mjs");
    expect(yaml).toContain("uses: actions/upload-artifact@v4");
    expect(yaml).toContain("if-no-files-found: error");
  });

  it("adds no permission to the workflow's least-privilege grant", async () => {
    const yaml = await readWorkflow();
    // Artifact upload needs nothing beyond what was already declared. If this
    // ever fails, something asked for `contents: write` — which would let this
    // workflow commit its own baseline and delete the deliberate human step.
    expect(yaml).toMatch(/permissions:\n\s+contents: read\n\s+pull-requests: write\n/);
    expect(yaml).not.toContain("contents: write");
  });
});
