// No file may carry the wreckage of a conflict resolution.
//
// This exists because it already happened. A merge left conflict markers in
// `evals/discovery/README.md`, they were "removed" by a string replacement that
// silently matched nothing, and a grep for `<<<<<<<` and `>>>>>>>` came back
// clean — because Prettier had run in between and REWRITTEN the markers into
// valid Markdown. `>>>>>>> origin/main` became `> > > > > > > origin/main`, a
// seven-deep nested blockquote; the `=======` divider became an indented
// continuation line whose leading `-` Prettier escaped to `\-`, silently
// demoting a top-level bullet into the previous one's body.
//
// THAT IS THE WHOLE DIFFICULTY. Both artifacts are well-formed Markdown, so
// `prettier --check` and `markdownlint` both pass on them, and the file renders
// as nonsense rather than failing anything. The debris is only recognisable by
// what it LOOKS like, which is what this file asserts — the raw markers a
// formatter has not reached yet, and the specific shapes it turns them into.
//
// Scoped to tracked files via `git ls-files`, so it can never wander into
// node_modules or a scratch directory and report on something nobody committed.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";

/** Text this repository actually authors. Binary and lockfiles are not in scope. */
const SCANNED = new Set([".md", ".mjs", ".js", ".json", ".jsonc", ".yaml", ".yml", ".sh"]);

/**
 * Each pattern with the shape of conflict wreckage, raw or reformatted.
 *
 * @type {Array<{ name: string, pattern: RegExp }>}
 */
const DEBRIS = [
  // The raw markers, before any formatter has touched them. `=======` needs the
  // full seven characters on a line of its own: a Markdown setext underline is
  // written with `=` too, and a shorter run is legitimate.
  { name: "an unresolved conflict marker", pattern: /^(<{7}|>{7})[ \t]|^(<{7}|>{7})$/m },
  { name: "an unresolved conflict divider", pattern: /^={7}$/m },
  // What Prettier makes of `>>>>>>> origin/main`: a blockquote nested far
  // deeper than any real document nests, ending in a branch-shaped name.
  { name: "a conflict marker reformatted into nested blockquotes", pattern: /^(> ){5,}/m },
  // What Prettier makes of a bullet that a stray divider pushed into the
  // previous item's body. A legitimately escaped `\-` mid-sentence is possible;
  // one opening an indented line directly before bold text is not.
  { name: "a bullet demoted by a stray conflict divider", pattern: /^[ \t]+\\-[ \t]+\*\*/m },
];

const trackedFiles = () =>
  execFileSync("git", ["ls-files", "-z"], { cwd: repoPath("."), encoding: "utf8" })
    .split("\0")
    .filter((path) => path && SCANNED.has(extname(path)));

describe("no file carries conflict-resolution debris", () => {
  it("scans a meaningful number of tracked files", () => {
    // Guards the guard: a broken `git ls-files` or a too-narrow extension set
    // would make every assertion below pass by examining nothing.
    expect(trackedFiles().length).toBeGreaterThan(50);
  });

  it.each(DEBRIS)("finds no file containing $name", ({ pattern }) => {
    const offenders = trackedFiles().filter((path) =>
      pattern.test(readFileSync(repoPath(path), "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("recognises each shape, so a clean result means something", () => {
    // The negative control. Every pattern is proven to fire on the exact text
    // that got through review, so "no offenders" is evidence rather than the
    // absence of it.
    const samples = [
      "<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> origin/main\n",
      "> > > > > > > origin/main\n",
      "  \\- **The workspace does not bound what the CLI loads.** A managed environment\n",
    ];
    for (const sample of samples) {
      expect(
        DEBRIS.some(({ pattern }) => pattern.test(sample)),
        `no pattern matched ${JSON.stringify(sample.slice(0, 40))}`,
      ).toBe(true);
    }
  });

  it("does not fire on the legitimate text it sits next to", () => {
    // A setext underline, an ordinary two-level quote, and an escaped dash in
    // running prose are all fine, and a check that flagged them would be turned
    // off rather than fixed.
    const innocent = [
      "A heading\n=====\n",
      "> quoting someone\n> > who quoted someone else\n",
      "The flag is spelled \\-\\-dry-run in prose.\n",
      "Compare `a >>> b` inline.\n",
    ];
    for (const sample of innocent) {
      expect(
        DEBRIS.filter(({ pattern }) => pattern.test(sample)).map(({ name }) => name),
        `false positive on ${JSON.stringify(sample.slice(0, 40))}`,
      ).toEqual([]);
    }
  });
});
