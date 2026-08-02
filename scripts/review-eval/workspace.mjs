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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function git(repoRoot, args) {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

/**
 * The tree a probe reviews, the diff that produced it, and the REVIEW.md it
 * reviews under.
 *
 * THE TREE IS REAL, not just the diff. A probe is given a git worktree checked
 * out at headSha, so the changed files and every neighbouring skill actually
 * exist on disk. Handing over diff text alone would defeat the contract being
 * measured: REVIEW.md's neighbour-read procedure requires opening the skills a
 * change names as owners, and those are by construction NOT in the diff. It
 * would also make a probe that tries to read a changed file for context fail
 * silently, which reads downstream as "the contract did not find the defect".
 *
 * @param {object} options
 * @param {string} options.repoRoot
 * @param {{id: string, baseSha: string, headSha: string}} options.testCase
 * @param {string|null} options.reviewRef git ref to take REVIEW.md from, or null for the working tree
 * @returns {{dir: string, diffPath: string, reviewPath: string, files: string[], cleanup: () => void}}
 */
export function materialise({ repoRoot, testCase, reviewRef }) {
  const { baseSha, headSha } = testCase;

  for (const [label, sha] of [
    ["baseSha", baseSha],
    ["headSha", headSha],
  ]) {
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
  const tree = join(dir, "tree");

  // --detach because the case is a commit, not a branch, and several probes of
  // the same case must not contend for one ref.
  git(repoRoot, ["worktree", "add", "--detach", "--quiet", tree, headSha]);

  const diff = git(repoRoot, ["diff", `${baseSha}..${headSha}`]);
  const diffPath = join(dir, "change.diff");
  writeFileSync(diffPath, diff);

  const files = git(repoRoot, ["diff", "--name-only", `${baseSha}..${headSha}`])
    .split("\n")
    .filter(Boolean);

  // No ref means the working tree's REVIEW.md — the file as it stands right
  // now, uncommitted edits included. Reading `HEAD:REVIEW.md` instead would
  // silently score the last commit rather than the change being worked on,
  // which is the opposite of useful while iterating on a contract.
  const review = reviewRef
    ? git(repoRoot, ["show", `${reviewRef}:REVIEW.md`])
    : readFileSync(join(repoRoot, "REVIEW.md"), "utf8");
  // Written INTO the worktree, overwriting whatever REVIEW.md headSha carried:
  // a probe that opens REVIEW.md by its ordinary path must get the contract
  // under test, not the one that happened to be committed on the branch.
  const reviewPath = join(tree, "REVIEW.md");
  writeFileSync(reviewPath, review);

  const cleanup = () => {
    try {
      git(repoRoot, ["worktree", "remove", "--force", tree]);
    } catch {
      // A worktree that never registered is not worth failing a run over.
    }
    rmSync(dir, { recursive: true, force: true });
  };

  return { dir, tree, diffPath, reviewPath, files, cleanup };
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
    "You are running inside a checkout of the repository AT THE CHANGED COMMIT, so every file the",
    "diff touches exists on disk, and so does every other file in the repository — read whatever you",
    "need for context, including files the diff does not touch.",
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
