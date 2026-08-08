// a count stated in prose must agree with the file that owns it.
//
// the drift this ends published wrong numbers in three documents at once, with
// CI green the whole time: nothing in the repository could compare a sentence
// against the data it described. documented-counts.mjs carries the marker
// convention and the derivations; this file is the gate over the real tree.
//
// it comes in two halves, for the reason gate-teeth.test.mjs exists. the first
// half asserts this repository is currently clean — which a broken checker
// passes just as happily, silently converting a merge gate into decoration. the
// second half plants each failure the checker exists to catch, including one
// planted into the real README so the derivation itself is exercised rather
// than a synthetic string that happens to parse.

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";
import {
  anchored,
  CLAIMS,
  describeMismatch,
  markdownFiles,
  parseMarkers,
  renderings,
  sectionOf,
  shipsWithASkill,
  states,
} from "./documented-counts.mjs";

/** every claim's derived value, computed once per test. */
async function derivedValues() {
  const derived = {};
  for (const [key, claim] of Object.entries(CLAIMS)) {
    derived[key] = await claim.derive();
  }
  return derived;
}

/** Markdown this repository owns: everything outside the two skill roots. */
async function inScopeFiles() {
  return (await markdownFiles()).filter((file) => !shipsWithASkill(file));
}

/** every marker in scope, tagged with the file it came from. */
async function markersInScope() {
  const found = [];
  for (const file of await inScopeFiles()) {
    const text = await readFile(repoPath(file), "utf8");
    const { markers, problems } = parseMarkers(text);
    for (const marker of markers) found.push({ file, marker });
    for (const problem of problems) found.push({ file, problem });
  }
  return found;
}

/** compare one document's markers against the derived values. */
function mismatchesIn(file, text, derived) {
  const { markers } = parseMarkers(text);
  return markers
    .filter((marker) => marker.key in CLAIMS)
    .filter((marker) => !states(marker.text, derived[marker.key]))
    .map((marker) =>
      describeMismatch({
        file,
        marker,
        claim: CLAIMS[marker.key],
        derived: derived[marker.key],
      }),
    );
}

describe("documented counts", () => {
  it("marks no count the owning file disagrees with", async () => {
    const derived = await derivedValues();

    const mismatches = [];
    for (const file of await inScopeFiles()) {
      const text = await readFile(repoPath(file), "utf8");
      mismatches.push(...mismatchesIn(file, text, derived));
    }

    expect(
      mismatches,
      "a marked count no longer matches what its owning file holds; the message below says what to write",
    ).toEqual([]);
  });

  it("names a registered key at every marker", async () => {
    const unknown = (await markersInScope())
      .filter((entry) => entry.marker && !(entry.marker.key in CLAIMS))
      .map((entry) => `${entry.file}:${entry.marker.line} count:${entry.marker.key}`);

    expect(
      unknown,
      `a marker names no claim in documented-counts.mjs. Registered: ${Object.keys(CLAIMS).join(", ")}`,
    ).toEqual([]);
  });

  it("carries no malformed marker", async () => {
    const problems = (await markersInScope())
      .filter((entry) => entry.problem)
      .map((entry) => `${entry.file}:${entry.problem.line} — ${entry.problem.message}`);

    expect(
      problems,
      "a malformed marker is reported rather than skipped, because skipping it would leave an author believing a number is checked when nothing reads it",
    ).toEqual([]);
  });

  it("uses every derivation the registry defines", async () => {
    const used = new Set(
      (await markersInScope())
        .filter((entry) => entry.marker)
        .map((entry) => entry.marker.key),
    );

    // the other direction of the same rule. a derivation nothing marks is dead
    // machinery that reads as coverage — and it outlives the sentence it was
    // written for, which is the rot this whole file is against.
    expect(
      Object.keys(CLAIMS).filter((key) => !used.has(key)),
      "a registered claim that no prose marks has nothing left to check; delete it, or mark the count it was written for",
    ).toEqual([]);
  });

  it("keeps markers out of the skills that ship", async () => {
    const offenders = [];
    for (const file of (await markdownFiles()).filter(shipsWithASkill)) {
      const { markers, problems } = parseMarkers(await readFile(repoPath(file), "utf8"));
      for (const marker of markers) offenders.push(`${file}:${marker.line} count:${marker.key}`);
      for (const problem of problems) offenders.push(`${file}:${problem.line}`);
    }

    // a distributable skill is installed into other people's projects, where
    // every derivation here names a file that does not exist and nothing can
    // verify anything. a marker there is not a weaker claim; it is a broken one.
    expect(
      offenders,
      "a marker in a distributable skill would be installed into projects that cannot check it",
    ).toEqual([]);
  });
});

describe("documented counts have teeth", () => {
  it("catches a real drifted count in README.md", async () => {
    const derived = await derivedValues();
    const readme = await readFile(repoPath("README.md"), "utf8");

    // planted into the real file, against the real derivation: a synthetic
    // string could pass this while the repository's own wiring was broken.
    const drifted = readme.replace(
      /(<!-- count:distributable-skills -->)[^<]*(<!-- \/count -->)/,
      "$1ninety-nine$2",
    );
    expect(drifted, "README.md must carry the marker this case drifts").not.toBe(readme);

    const mismatches = mismatchesIn("README.md", drifted, derived);

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toContain("count:distributable-skills");
    expect(mismatches[0]).toContain('claims "ninety-nine"');
  });

  it("reports the file, the claim, the truth, a spelling, and what moves with it", () => {
    const message = describeMismatch({
      file: "README.md",
      marker: { key: "distributable-skills", text: "twenty-four", line: 8 },
      claim: CLAIMS["distributable-skills"],
      derived: 25,
    });

    // the criterion is legibility: a contributor fixes the sentence from this
    // message alone, without opening the checker to find out what is derived
    // from what.
    expect(message).toContain("README.md:8");
    expect(message).toContain("count:distributable-skills");
    expect(message).toContain('claims "twenty-four"');
    expect(message).toContain("the truth is 25");
    expect(message).toContain(`Derived from: ${CLAIMS["distributable-skills"].owner}`);
    expect(message).toContain('"twenty-five"');
    expect(message).toContain(CLAIMS["distributable-skills"].note);
  });

  it("accepts a numeral, a cardinal, or an ordinal", () => {
    expect(renderings(25)).toEqual(["25", "25th", "twenty-five", "twenty-fifth"]);
    expect(renderings(3)).toEqual(["3", "3rd", "three", "third"]);
    expect(renderings(11)).toEqual(["11", "11th", "eleven", "eleventh"]);
    expect(renderings(40)).toEqual(["40", "40th", "forty", "fortieth"]);

    expect(states("eleventh", 11)).toBe(true);
    expect(states("11", 11)).toBe(true);
    expect(states("eleven", 11)).toBe(true);
    expect(states("twelve", 11)).toBe(false);
  });

  it("refuses a marker that begins its line", () => {
    // found by writing the first one: a line starting with `<!--` is an HTML
    // block in CommonMark, so the marker ends the paragraph it was meant to sit
    // inside and the sentence renders in two halves. Prettier makes the split
    // visible by inserting the blank line the block implies.
    const { problems } = parseMarkers(
      "The skills here:\n<!-- count:distributable-skills -->twenty-five<!-- /count --> of them.\n",
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("begins its line");
  });

  it("refuses a marker split across two lines", () => {
    // same failure one token over: wrapping between the value and the closing
    // token puts `<!-- /count -->` at the start of a line.
    const { markers, problems } = parseMarkers(
      "The <!-- count:distributable-skills -->twenty-five\n<!-- /count --> skills here.\n",
    );

    expect(markers).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("spans a line break");
  });

  it("tolerates whitespace padding inside a marker", () => {
    const { markers, problems } = parseMarkers(
      "The <!-- count:distributable-skills --> twenty-five <!-- /count --> here.\n",
    );

    expect(problems).toEqual([]);
    expect(states(markers[0].text, 25)).toBe(true);
  });

  it("reports an unclosed marker rather than skipping it", () => {
    const { markers, problems } = parseMarkers(
      "One <!-- count:distributable-skills -->twenty-five here.\n",
    );

    expect(markers).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("never closed");
  });

  it("reports a second opening marker before the first closes", () => {
    const { problems } = parseMarkers(
      "<!-- count:a -->one<!-- count:b -->two<!-- /count -->\n",
    );

    expect(problems.map((problem) => problem.message).join("\n")).toContain("never closed");
  });

  it("reports a closing marker that opens nothing", () => {
    const { problems } = parseMarkers("Nothing opened this.<!-- /count -->\n");

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("never opened");
  });

  it("reports a marker key nothing could register", () => {
    const { problems } = parseMarkers(
      "It ships <!-- count:Distributable_Skills -->25<!-- /count --> skills.\n",
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("not a usable marker key");
  });

  it("reports a marker wrapping no text", () => {
    const { problems } = parseMarkers(
      "It ships <!-- count:distributable-skills --><!-- /count --> skills.\n",
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("wraps no text");
  });

  it("checks a marker inside a fenced code block like any other", () => {
    // deliberate: nothing is exempt, so there is no "did this one count?"
    // question to answer. a fence changes visibility, not applicability — which
    // is why a code sample a reader copies carries no marker, and the sample
    // demonstrating the syntax legitimately does.
    const { markers, problems } = parseMarkers(
      "```markdown\nThe <!-- count:distributable-skills -->twenty-five<!-- /count --> here.\n```\n",
    );

    expect(problems).toEqual([]);
    expect(markers).toHaveLength(1);
    expect(markers[0].key).toBe("distributable-skills");
  });

  it("fails loudly when a derivation's anchor text is rewritten", () => {
    expect(() =>
      anchored(
        "MUST cap the loop at eight rounds.",
        /cap the address.{0,3}review loop at \*\*(\d+)\*\* rounds/,
        "skills/loop-engineering/SKILL.md",
        "the address↔review round cap",
      ),
    ).toThrow(/skills\/loop-engineering\/SKILL\.md no longer contains/);
  });

  it("fails loudly when a derived section is renamed away", () => {
    expect(() => sectionOf("# Title\n\n### Other\n\ntext\n", "### Repository gotchas")).toThrow(
      /no longer has a "### Repository gotchas" section/,
    );
  });

  it("reads a section up to the next heading and no further", () => {
    const body = sectionOf(
      "## Before\n\n### Repository gotchas\n\n**One.** x\n\n**Two.** y\n\n### After\n\n**Three.** z\n",
      "### Repository gotchas",
    );

    expect([...body.matchAll(/^\*\*/gm)]).toHaveLength(2);
  });
});
