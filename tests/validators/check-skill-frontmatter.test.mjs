// exit-code and failure-message contract for check-skill-frontmatter.mjs.
//
// `audit-checklist.md` makes confirming a bundled script's documented exit codes
// a MUST, and this validator is one of the three the repository arms as a merge
// gate. the documented contract is: 0 when every checked skill passes (warnings
// alone do not fail a skill), 1 when any check fails, and 2 on a bad invocation
// or a path that holds no skill.
//
// most of this file is the `description` YAML block. that is proportionate: a
// value YAML reads as something other than the text that was typed is the
// failure a host hits before it ever loads the skill, and every branch of it is
// a distinct remedy for the author.
//
// running the validator over this repository's own skill roots is a gate rather
// than a contract test, and lives in tests/repository/gate-runs.test.mjs.

import { join } from "node:path";

import { mkdir, symlink } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { tempDir, writeSkill } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkSkill = validator(SCRIPTS.checkSkillFrontmatter);

/**
 * assert that a fixture fails with exit 1 and reports `expected`.
 *
 * the two framing assertions are soft: when a rule stops firing, the useful
 * signal is which of the three claims broke, and a hard assert on the first
 * hides the rest.
 * @param {string} dir
 * @param {RegExp} expected
 */
function expectFailure(dir, expected) {
  const result = checkSkill(dir);

  expect(result).toReportFailure(expected);
  expect.soft(result.stdout).toMatch(/^FAIL {2}/m);
  expect.soft(result.stdout).toMatch(/1 of 1 skill\(s\) failed structural checks\./);
}

/**
 * assert that a fixture raises `expected` as a WARN and still exits 0. every
 * case using this asserts the exit code, because the whole point of the
 * advisory tier is that none of it can fail a build.
 * @param {string} dir
 * @param {RegExp} expected
 */
function expectWarning(dir, expected) {
  const result = checkSkill(dir);

  expect(result, "a WARN must not fail the run").toPassCleanly();
  expect.soft(result.stdout).toMatch(/^WARN/m);
  expect(result.stdout).toMatch(expected);
}


describe("check-skill-frontmatter.mjs", () => {
  describe("exit 0 — advisory framing notes", () => {

    it("keeps a capability-framing warning advisory rather than fatal", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "some-guidelines");

      const result = checkSkill(dir);

      expect(result, "a WARN must not change the exit code").toPassCleanly();
      expect(result.stdout).toMatch(/^WARN/m);
      expect(result.stdout).toMatch(/names the document, not the capability/);
    });

    it("warns on a document-voice description without failing", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "document-voice-skill", {
        frontmatter: {
          description:
            "This skill describes a thing at length, opening in document voice so the advisory detector has something to catch.",
        },
      });

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/opens in document voice/);
    });

  });

  describe("exit 1 — each implemented failure class", () => {

    it.each([
      {
        what: "a missing frontmatter block",
        dirName: "no-frontmatter",
        options: { raw: "# Just a heading\n\nNo frontmatter at all.\n" },
        reported: /frontmatter: missing or unterminated leading/,
      },
      {
        what: "an unterminated frontmatter block",
        dirName: "unterminated-frontmatter",
        options: {
          raw: "---\nname: unterminated-frontmatter\ndescription: Never closed.\n",
        },
        reported: /frontmatter: missing or unterminated leading/,
      },
      {
        what: "a missing name",
        dirName: "nameless-skill",
        options: { frontmatter: { name: null } },
        reported: /frontmatter: `name` is missing\./,
      },
      {
        what: "a non-kebab-case name",
        dirName: "Not_Kebab",
        options: {},
        reported: /`name` "Not_Kebab" is not kebab-case/,
      },
      {
        what: "a name over the 64-character cap",
        dirName: "a".repeat(65),
        options: {},
        reported: /frontmatter: `name` is 65 chars \(max 64\)\./,
      },
      {
        what: "a name that does not match its directory",
        dirName: "directory-name",
        options: { frontmatter: { name: "frontmatter-name" } },
        reported:
          /`name` "frontmatter-name" does not match directory "directory-name"/,
      },
      {
        what: "a missing description",
        dirName: "no-description",
        options: { frontmatter: { description: null } },
        reported: /frontmatter: `description` is missing or empty\./,
      },
      {
        what: "a description over the 1024-byte cap",
        dirName: "long-description",
        options: {
          frontmatter: { description: `The ability to ${"x".repeat(1010)}` },
        },
        reported: /frontmatter: `description` is 1025 bytes \(max 1024 bytes\)/,
      },
      {
        // the all-ASCII case above cannot tell the new behaviour from the old
        // one it replaced: its character and byte counts are equal, so it
        // fails identically under either reading. this one is under the cap
        // in characters and over it in bytes, so only a byte-measuring check
        // rejects it — and a refactor back to `description.length` turns this
        // red.
        what: "a description under 1024 characters but over 1024 bytes",
        dirName: "multibyte-description",
        options: {
          frontmatter: { description: `The ability to ${"あ".repeat(400)}` },
        },
        reported:
          /frontmatter: `description` is 1215 bytes \(415 chars\) \(max 1024 bytes\)/,
      },
    ])("reports $what", async ({ dirName, options, reported }) => {
      const root = await tempDir();
      const dir = await writeSkill(root, dirName, options);

      expectFailure(dir, reported);
    });

  });

  describe("host-specific frontmatter extensions", () => {
    it("neither requires nor rejects a Claude Code discovery field", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "no-when-to-use", {
        frontmatter: { when_to_use: null },
      });

      const result = checkSkill(dir);

      expect(
        result,
        "`when_to_use` is a host extension, not part of the Agent Skills spec; a validator that demanded it would fail a correct skill on every host that ignores the field",
      ).toPassCleanly();
      expect.soft(result.stdout).not.toMatch(/`when_to_use`/);
    });

    it("rejects an unknown option rather than silently ignoring it", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "unknown-option", {});

      const result = checkSkill("--require-claude-code-fields", dir);

      expect(
        result.code,
        "the flag was removed; accepting it silently would let a caller believe a check ran",
      ).toBe(2);
      expect.soft(result.stderr).toMatch(/Unknown option/);
    });
  });

  describe("a description YAML would read as something other than text", () => {
    // the defect's symptom is a PASS: this validator reads frontmatter with a
    // regex, so a construct YAML treats specially sails through and the skill
    // then fails to load on every host — with the merge gate green throughout.
    // every expectation below was checked against a real YAML parser, and the
    // whole set was mutation-checked by disabling the hazard detection, which
    // turns the rejection cases red.
    //
    // two of these are worse than a parse error. `a #b` parses to `a` and
    // `&x text` parses to `text` — no error anywhere, just a description the
    // author never wrote. those are why this is a failure, not a warning.

    /** @param {string} description */
    const withDescription = (root, dirName, description) =>
      writeSkill(root, dirName, { raw: `---\nname: ${dirName}\ndescription: ${description}\n---\n\n# Fixture\n\nBody prose.\n` });

    describe("rejects an unquoted value carrying a hazard", () => {
      const cases = [
        {
          what: "a colon before a space, which opens a nested mapping",
          dirName: "colon-space",
          description: "The agentskills.io format: capability framing and discovery metadata.",
          reported: /`description` contains `: `.*nested mapping.*quote the value/,
        },
        {
          what: "a colon at the end of the value",
          dirName: "colon-end",
          description: "The ability to do the thing described after this colon:",
          reported: /`description` contains `: `.*nested mapping/,
        },
        {
          what: "a hash after a space, which truncates the value silently",
          dirName: "space-hash",
          description: "The ability to review a change # and everything after this vanishes.",
          reported: /`description` contains ` #`.*silently truncates/,
        },
        {
          what: "an indicator character leading the value",
          dirName: "leading-bracket",
          description: "[bracketed] opening that YAML reads as a flow sequence.",
          reported: /`description` begins with `\[`.*indicator rather than text/,
        },
        {
          what: "an anchor character leading the value, which is dropped silently",
          dirName: "leading-ampersand",
          description: "&anchor followed by the text a reader would expect to survive.",
          reported: /`description` begins with `&`.*indicator rather than text/,
        },
        {
          what: "a hyphen and a space, which YAML reads as a list item",
          dirName: "leading-hyphen-space",
          description: "- an opening that reads as a list item rather than a value.",
          reported: /`description` begins with `-` followed by a space/,
        },
      ];

      for (const { what, dirName, description, reported } of cases) {
        it(`rejects ${what}`, async () => {
          const root = await tempDir();
          const dir = await withDescription(root, dirName, description);

          expectFailure(dir, reported);
        });
      }
    });

    describe("leaves a legal plain scalar alone", () => {
      const cases = [
        {
          what: "a colon with no following space",
          dirName: "colon-tight",
          description: "The OWASP Top 10:2025 lens applied to a change under review.",
        },
        {
          what: "a hash with no preceding space",
          dirName: "hash-tight",
          description: "The ability to route a change through issue#197 and its follow-ups.",
        },
        {
          what: "a hyphen with no following space",
          dirName: "hyphen-tight",
          description: "-prefixed opening that YAML reads as ordinary text, not a list item.",
        },
        {
          // `\` and `~` sit in the specification's indicator table but lead a
          // plain scalar legally. rejecting them would fail a correct skill,
          // which is why the hazard set was derived from a parser rather than
          // from that table.
          what: "a backslash leading the value",
          dirName: "leading-backslash",
          description: "\\escaped-looking opening that a YAML parser reads as plain text.",
        },
        {
          what: "a tilde leading the value",
          dirName: "leading-tilde",
          description: "~approximately the opening character that reads as plain text here.",
        },
        {
          what: "brackets and braces inside the value",
          dirName: "inner-brackets",
          description: "The ability to handle [brackets] and {braces} away from the opening.",
        },
      ];

      for (const { what, dirName, description } of cases) {
        it(`accepts ${what}`, async () => {
          const root = await tempDir();
          const dir = await withDescription(root, dirName, description);

          expect(checkSkill(dir), "a construct a YAML parser reads faithfully must stay legal unquoted").toPassCleanly();
        });
      }
    });

    describe("accepts a hazard once it is quoted", () => {
      it("reads a double-quoted value", async () => {
        const root = await tempDir();
        const dir = await withDescription(root, "dquoted", '"The agentskills.io format: capability framing, quoted so it parses."');

        expect(checkSkill(dir)).toPassCleanly();
      });

      it("reads a single-quoted value", async () => {
        const root = await tempDir();
        const dir = await withDescription(root, "squoted", "'The agentskills.io format: capability framing, quoted so it parses.'");

        expect(checkSkill(dir)).toPassCleanly();
      });

      it("reads an escaped quote inside a double-quoted value", async () => {
        const root = await tempDir();
        const dir = await withDescription(root, "dquoted-escape", '"The ability to handle a \\" inside a value that also carries a colon: here."');

        expect(checkSkill(dir)).toPassCleanly();
      });

      it("reads a doubled quote inside a single-quoted value", async () => {
        const root = await tempDir();
        const dir = await withDescription(root, "squoted-double", "'The ability to handle it''s apostrophe beside a colon: in one value.'");

        expect(checkSkill(dir)).toPassCleanly();
      });

      it("measures the byte cap against the unwrapped value, so quoting costs no budget", async () => {
        const root = await tempDir();
        // 1024 bytes of content inside quotes: 1026 bytes on the line, 1024
        // once unwrapped. counting the raw line would fail this.
        const inner = `The ability to ${"x".repeat(1009)}`;
        expect(Buffer.byteLength(inner, "utf8"), "fixture must sit exactly at the cap").toBe(1024);
        const dir = await withDescription(root, "quoted-at-cap", `"${inner}"`);

        expect(checkSkill(dir), "quotes and escapes are syntax, not description budget").toPassCleanly();
      });
    });

    describe("rejects a quoted value it cannot read", () => {
      const cases = [
        {
          what: "an unterminated double quote",
          dirName: "dquote-open",
          description: '"The ability to open a quote and never close it.',
          reported: /`description` opens with a double quote but does not close/,
        },
        {
          what: "an unterminated single quote",
          dirName: "squote-open",
          description: "'The ability to open a quote and never close it.",
          reported: /`description` opens with a single quote but does not close/,
        },
        {
          what: "an unescaped quote inside a double-quoted value",
          dirName: "dquote-inner",
          description: '"The ability to carry an unescaped " inside a quoted value."',
          reported: /`description` carries an unescaped `"`.*write it as `\\"`/,
        },
        {
          what: "an unpaired quote inside a single-quoted value",
          dirName: "squote-inner",
          description: "'The ability to carry an unpaired ' inside a quoted value.'",
          reported: /`description` carries an unpaired `'`.*double it/,
        },
      ];

      for (const { what, dirName, description, reported } of cases) {
        it(`rejects ${what}`, async () => {
          const root = await tempDir();
          const dir = await withDescription(root, dirName, description);

          expectFailure(dir, reported);
        });
      }

      // YAML defines a closed escape set inside double quotes. accepting an
      // undefined sequence as a literal backslash would reintroduce this
      // check's own defect through the quoting path it adds: a value the
      // validator passes and no host can load. found by the independent
      // review, on a fuzz wider than the differential this change shipped with.
      const undefinedEscapes = [
        { what: "\\d", dirName: "escape-d", description: '"Regex-flavored \\d+ matched inline in a description of some length."' },
        { what: "\\s", dirName: "escape-s", description: '"Regex-flavored \\s* matched inline in a description of some length."' },
        { what: "\\w", dirName: "escape-w", description: '"Regex-flavored \\w+ matched inline in a description of some length."' },
        { what: "\\'", dirName: "escape-squote", description: '"An escaped \\\' apostrophe, which is legal in neither quote style."' },
      ];

      for (const { what, dirName, description } of undefinedEscapes) {
        it(`rejects \`${what}\`, which YAML does not define as an escape`, async () => {
          const root = await tempDir();
          const dir = await withDescription(root, dirName, description);

          expectFailure(dir, new RegExp(`\`description\` carries \`\\\\${what.slice(1)}\`, which YAML does not define`));
        });
      }

      it("accepts every escape YAML does define", async () => {
        const root = await tempDir();
        // the whole closed set in one value, so a shrunken map fails here.
        const dir = await withDescription(
          root,
          "escapes-legal",
          '"Legal escapes \\0\\a\\b\\t\\n\\v\\f\\r\\e\\ \\"\\/\\\\\\N\\_\\L\\P and numerics \\x41\\u0041\\U00000041 together."',
        );

        expect(checkSkill(dir)).toPassCleanly();
      });

      it("rejects a numeric escape with too few hex digits", async () => {
        const root = await tempDir();
        const dir = await withDescription(root, "escape-short-hex", '"A truncated \\x4 numeric escape inside a description of some length."');

        expectFailure(dir, /`description` carries `\\x` with fewer than 2 hex digits/);
      });

      it("leaves a backslash alone inside single quotes, where it is literal text", async () => {
        const root = await tempDir();
        const dir = await withDescription(root, "escape-single", "'Regex-flavored \\d+ is literal here, beside a colon: in one value.'");

        expect(checkSkill(dir), "single-quoted YAML has no escapes but `''`, so a backslash is just a character").toPassCleanly();
      });

      it("distinguishes a malformed quote from a hazard, so the remedy differs", async () => {
        const root = await tempDir();
        const dir = await withDescription(root, "malformed-not-hazard", '"The ability to leave this quote open: forever.');

        const result = checkSkill(dir);

        expect(result).toReportFailure(/does not close/);
        expect.soft(result.stdout, "telling an author to quote an already-quoted value would not help").not.toMatch(/quote the value/);
      });
    });
  });
});
