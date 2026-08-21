// the behaviour of show-real-titles-in-the-post-list-and-commit-it's own
// judgment script, beyond the false-versus-error line that
// scenario-script-false-versus-error.test.mjs holds every scenario script to.
//
// this script is the one place in the instrument that reads a commit message,
// and it reads it out of a transcript rather than out of a workspace: capture.mjs
// diffs content against the commit a probe started from, so a message reaches no
// outcome factor at all. What it has to get right is therefore extraction — the
// shell forms a probe actually writes a commit in — and the header grammar it
// then applies. Both are covered here.
//
// the extraction cases are not invented. Each is a form taken from the 13
// commits found across the 224 probe transcripts of the retired instrument,
// recoverable at e19e893^: the `"$(cat <<'EOF' … EOF)"` heredoc that dominates
// them, a plain double-quoted message, a commit reached through `&&` after a
// `git add`, and one prefixed with GIT_AUTHOR_* assignments.
//
// the script is spawned as a child process with a context file as its one
// argument, exactly as tools/evaluation/src/factor-judgment.mjs's own
// runScriptJudgment spawns it.

import { describe, expect, it } from "vitest";

import { bashTranscript, tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { runScript } from "../helpers/run.mjs";

const SCRIPT =
  "tools/evaluation/scenarios/show-real-titles-in-the-post-list-and-commit-it/scripts/check-commit-header-conforms.mjs";

// the set the scenario's own factor declares.
const TYPES = ["feat", "fix", "build", "chore", "ci", "docs", "style", "refactor", "perf", "test", "revert"];

/** the `-m "$(cat <<'EOF' … EOF)"` form, which most real probe commits use. */
function heredocCommit(subject, body = "") {
  return `git commit -m "$(cat <<'EOF'\n${subject}\n${body ? `\n${body}\n` : ""}EOF\n)"`;
}

/** run the script against one transcript and return its parsed verdict. */
async function judge(transcript, { types = TYPES } = {}) {
  const dir = await tempDir();
  const contextPath = await writeFileIn(
    dir,
    "context.json",
    JSON.stringify({
      phase: "transcript",
      factorId: "writes-a-conforming-commit-header",
      input: { types },
      material: { transcript },
    }),
  );
  const result = runScript(SCRIPT, [contextPath], { cwd: dir });
  return { ...result, verdict: result.code === 0 ? JSON.parse(result.stdout) : null };
}

describe("a conforming header is credited", () => {
  it.each([
    ["a plain double-quoted message", 'git commit -m "fix: show post titles rather than slugs"'],
    ["the heredoc form real probes overwhelmingly use", heredocCommit("fix: show post titles rather than slugs", "The list rendered post.slug.")],
    ["a commit reached through && after a git add", 'git add app/page.tsx && git commit -m "feat(home): show post titles"'],
    ["a commit prefixed with author environment assignments", 'GIT_AUTHOR_NAME="A" GIT_AUTHOR_EMAIL="a@b.invalid" git commit -m "docs: note the fallback"'],
    ["a single-quoted message", "git commit -m 'refactor: lift locale parsing into shared'"],
    ["a breaking-change marker", 'git commit -m "feat(api)!: drop the legacy slug route"'],
    // SKILL.md › Type: "MUST treat types as case-insensitive in parsing but
    // SHOULD write them lowercase". The skill's own validator passes this with
    // a warning, so a factor scoring conformance to that contract must too.
    ["a type whose case differs from the declared set", 'git commit -m "Fix: show post titles rather than slugs"'],
    ["an all-caps type", 'git commit -m "DOCS: note the locale fallback"'],
  ])("%s", async (_name, command) => {
    const { code, verdict, output } = await judge(bashTranscript(command));

    expect(code, output).toBe(0);
    expect(verdict.result, verdict?.evidence).toBe(true);
    expect(verdict.evidence).toMatch(/conforms/);
  });
});

describe("a non-conforming header is a false result rather than an error", () => {
  it.each([
    ["a bare imperative subject", 'git commit -m "Show post titles rather than slugs"', /does not take the form/],
    ["a type outside the declared set", 'git commit -m "wip: show post titles"', /type "wip" is not one of/],
    ["an empty scope", 'git commit -m "fix(): show post titles"', /scope is present but empty/],
    ["no space after the separator", 'git commit -m "fix:show post titles"', /does not take the form/],
  ])("%s", async (_name, command, reason) => {
    const { code, verdict, output } = await judge(bashTranscript(command));

    expect(code, output).toBe(0);
    expect(verdict.result).toBe(false);
    expect(verdict.evidence).toMatch(reason);
  });
});

describe("which commit is judged, when a probe made more than one", () => {
  it("credits a probe that wrote WIP and then corrected itself", async () => {
    const { verdict } = await judge(
      bashTranscript('git commit -m "WIP"', 'git commit --amend -m "fix: show post titles rather than slugs"'),
    );

    expect(verdict.result).toBe(true);
    expect(verdict.evidence).toMatch(/fix: show post titles rather than slugs/);
  });

  it("judges the last message, so an earlier conforming one does not carry a later bare one", async () => {
    const { verdict } = await judge(
      bashTranscript('git commit -m "fix: show post titles"', 'git commit -m "and the tests"'),
    );

    expect(verdict.result).toBe(false);
    expect(verdict.evidence).toMatch(/"and the tests"/);
  });

  it("reads past a retried commit that repeats the same message", async () => {
    const retry = 'git config user.name "X" && git commit -m "feat: show post titles"';
    const { verdict } = await judge(bashTranscript('git commit -m "feat: show post titles"', retry));

    expect(verdict.result).toBe(true);
  });
});

describe("a malformed context is an error, not a verdict", () => {
  it.each([
    ["input.types missing", { material: { transcript: bashTranscript('git commit -m "fix: x"') } }],
    ["input.types empty", { input: { types: [] }, material: { transcript: bashTranscript('git commit -m "fix: x"') } }],
    ["material.transcript missing", { input: { types: TYPES } }],
    ["material.transcript not a string", { input: { types: TYPES }, material: { transcript: 7 } }],
  ])("%s", async (_name, context) => {
    const dir = await tempDir();
    const contextPath = await writeFileIn(dir, "context.json", JSON.stringify(context));

    const result = runScript(SCRIPT, [contextPath], { cwd: dir });

    expect(result.code, `expected a non-zero exit; the script's own output was:\n${result.output}`).not.toBe(0);
    expect(result.stderr.trim()).not.toBe("");
  });
});
