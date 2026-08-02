// Materialising one case as something a probe can review.
//
// THE PROBE NEVER SEES THE PULL REQUEST. The CI reviewer is invoked with a pull
// request URL, which is right in production and fatal here: #166's thread now
// carries all four of its defects written out with file:line locations and fix
// diffs, because diagnosing the miss is what motivated this instrument. A probe
// that can read the conversation transcribes the answer key and the run reports
// a contract that found everything. So a case is reconstructed from commits: the
// worktree at headSha, and the diff against baseSha, and nothing else.
//
// REVIEW.md IS OVERLAID FROM A CHOSEN REF, inverting the safety property the CI
// reviewer relies on. There, REVIEW.md comes from the base ref because a pull
// request head is untrusted — which is exactly why a contract cannot be scored
// before it merges. Here the inversion is safe for reasons that do not transfer:
// manual dispatch only, a recorded fixture, and the default branch.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function git(repoRoot, args) {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

/**
 * The diff a probe reviews, plus the REVIEW.md it reviews under.
 *
 * @param {object} options
 * @param {string} options.repoRoot
 * @param {{id: string, baseSha: string, headSha: string}} options.testCase
 * @param {string|null} options.reviewRef git ref to take REVIEW.md from, or null for the working tree
 * @returns {{dir: string, diffPath: string, reviewPath: string, files: string[]}}
 */
export function materialise({ repoRoot, testCase, reviewRef }) {
  const { baseSha, headSha } = testCase;

  for (const [label, sha] of [["baseSha", baseSha], ["headSha", headSha]]) {
    try {
      git(repoRoot, ["cat-file", "-e", `${sha}^{commit}`]);
    } catch {
      throw new Error(
        `Case ${testCase.id}: ${label} ${sha} is not in this checkout. ` +
          `Fetch the branch it came from, or run against a full clone.`,
      );
    }
  }

  const dir = mkdtempSync(join(tmpdir(), `review-eval-${testCase.id}-`));

  const diff = git(repoRoot, ["diff", `${baseSha}..${headSha}`]);
  const diffPath = join(dir, "change.diff");
  writeFileSync(diffPath, diff);

  const files = git(repoRoot, ["diff", "--name-only", `${baseSha}..${headSha}`])
    .split("\n")
    .filter(Boolean);

  const review = reviewRef
    ? git(repoRoot, ["show", `${reviewRef}:REVIEW.md`])
    : git(repoRoot, ["show", "HEAD:REVIEW.md"]);
  const reviewPath = join(dir, "REVIEW.md");
  writeFileSync(reviewPath, review);

  return { dir, diffPath, reviewPath, files };
}

/**
 * The probe's instruction.
 *
 * Mirrors claude-review.yaml's system prompt in the ways that matter — REVIEW.md
 * as highest-priority review-only instructions, one synchronous turn, findings
 * as inline comments — and departs in the two ways the eval requires: the change
 * arrives as a diff rather than a pull request URL, and the summary is the final
 * message rather than a posted comment, since there is nothing to post to.
 */
export function probePrompt({ diffPath, reviewPath, files }) {
  return [
    `Read ${reviewPath} and follow it as the highest-priority, review-only instructions for this review.`,
    "",
    `Review the change in ${diffPath}. It is a unified diff against the base commit.`,
    "The files it touches are present in the repository you are running in, so read them for context.",
    "",
    "Files changed:",
    ...files.map((file) => `  ${file}`),
    "",
    "Post EVERY finding with the `create_inline_comment` tool, giving the repository-relative",
    "`path` and the `line` it anchors to. A finding that is not posted with that tool does not",
    "count as reported. Then end your turn with the review summary as your final message.",
    "",
    "Do the ENTIRE review within this single turn, synchronously. Do not defer work to a",
    "background task: this is a one-shot job that terminates the instant your turn ends.",
  ].join("\n");
}
