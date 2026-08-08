// the sanitized-read decoder, tested against what the channel was measured to do.
//
// this file is the normative record of that measurement. the tracking issue
// deliberately does not reproduce it: an issue body stating "a stored X comes
// back as Y" collapses into "a stored Y comes back as Y" when that body is read
// back through the very channel it describes, and the collapsed sentence stays
// grammatical, so it reads as though it were written that way. here the rows
// are read from disk and never pass through the channel.
//
// the measurement: a body carrying each character at issue was written to a
// GitHub issue, its stored bytes were confirmed on the rendered page, and the
// body was read back through the tool channel. the channel deletes tags and
// HTML comments, decodes character references, then escapes five characters.
//
// two of the rows below are the whole reason this decoder cannot be sold as a
// byte-faithful read, and they are asserted as losses rather than omitted.

import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  decodeSanitizedRead,
  ESCAPE_STAGE_REFERENCES,
} from "../../skills/github-operation/scripts/decode-sanitized-read.mjs";

const execFileAsync = promisify(execFile);

const SCRIPT = fileURLToPath(
  new URL(
    "../../skills/github-operation/scripts/decode-sanitized-read.mjs",
    import.meta.url,
  ),
);

// one row per observation. `recoverable` records whether decoding `returned`
// reproduces `stored`; where it does not, `decoded` states what comes out
// instead, so the loss is written down rather than left to be rediscovered.
const MEASURED = [
  {
    what: "an HTML comment",
    stored: "<!-- ai-agent -->",
    returned: "",
    recoverable: false,
    decoded: "",
    why: "deleted with its contents; no residue survives to invert",
  },
  {
    what: "a tag name inside a code span",
    stored: "`<details>`",
    returned: "``",
    recoverable: false,
    decoded: "``",
    why: "deleted in prose and inside code spans alike",
  },
  {
    what: "two ampersands",
    stored: "&&",
    returned: "&amp;&amp;",
    recoverable: true,
  },
  {
    what: "an ampersand in a word",
    stored: "AT&T",
    returned: "AT&amp;T",
    recoverable: true,
  },
  {
    what: "a stored named reference for the ampersand",
    stored: "&amp;",
    returned: "&amp;",
    recoverable: false,
    decoded: "&",
    why: "decoded to the character before being escaped back; the stored spelling is gone",
  },
  {
    what: "a stored named reference for the less-than sign",
    stored: "&lt;",
    returned: "&lt;",
    recoverable: false,
    decoded: "<",
    why: "same collapse: the stored reference and the bare character are indistinguishable",
  },
  {
    what: "a stored hexadecimal numeric reference for the apostrophe",
    stored: "&#x27;",
    returned: "&#39;",
    recoverable: false,
    decoded: "'",
    why: "arrives in the decimal spelling, which is the proof that a decode precedes the escape",
  },
  {
    what: "a stored named reference for the quotation mark",
    stored: "&quot;",
    returned: "&#34;",
    recoverable: false,
    decoded: '"',
    why: "same: a different stored spelling arrives as the escaper's own",
  },
  {
    what: "a bare apostrophe",
    stored: "the set's figures",
    returned: "the set&#39;s figures",
    recoverable: true,
  },
  {
    what: "bare quotation marks",
    stored: '"Cumulative by session kind"',
    returned: "&#34;Cumulative by session kind&#34;",
    recoverable: true,
  },
];

describe("decode-sanitized-read.mjs", () => {
  describe("the measured rows", () => {
    it("covers every observation the probe produced", () => {
      // a guard against a row being dropped in an edit: the count is the
      // measurement's, and moving it should be a deliberate act.
      expect(MEASURED).toHaveLength(10);
    });

    for (const row of MEASURED.filter((r) => r.recoverable)) {
      it(`recovers ${row.what}`, () => {
        expect(decodeSanitizedRead(row.returned)).toBe(row.stored);
      });
    }

    for (const row of MEASURED.filter((r) => !r.recoverable)) {
      it(`cannot recover ${row.what} — ${row.why}`, () => {
        expect(decodeSanitizedRead(row.returned)).toBe(row.decoded);
        expect(decodeSanitizedRead(row.returned)).not.toBe(row.stored);
      });
    }
  });

  describe("the single pass", () => {
    // the defect this decoder exists to prevent. resolving the references one
    // after another with the ampersand entity first turns `&amp;lt;` into `<`:
    // one level too many, silently, in text nobody re-reads.
    it("decodes exactly one level, leaving a reference rather than the character", () => {
      expect(decodeSanitizedRead("&amp;lt;")).toBe("&lt;");
      expect(decodeSanitizedRead("&amp;lt;")).not.toBe("<");
    });

    it("does not rescan its own replacement output", () => {
      expect(decodeSanitizedRead("&amp;amp;")).toBe("&amp;");
      expect(decodeSanitizedRead("&amp;#39;")).toBe("&#39;");
    });
  });

  describe("input it must leave alone", () => {
    it("returns text carrying no references byte-identically", () => {
      const plain = "npm run check\nno references here — just prose, 12 chars.";
      expect(decodeSanitizedRead(plain)).toBe(plain);
    });

    it("leaves a reference the escape stage cannot emit untouched", () => {
      // the escaper emits five references and no others, so resolving anything
      // else would be decoding something this pipeline never encoded.
      expect(decodeSanitizedRead("&nbsp; &copy; &#x27;")).toBe(
        "&nbsp; &copy; &#x27;",
      );
    });

    it("returns the empty string unchanged", () => {
      expect(decodeSanitizedRead("")).toBe("");
    });
  });

  describe("ESCAPE_STAGE_REFERENCES", () => {
    it("names exactly the five an HTML escaper emits", () => {
      expect(Object.keys(ESCAPE_STAGE_REFERENCES).sort()).toEqual(
        ["&#34;", "&#39;", "&amp;", "&gt;", "&lt;"].sort(),
      );
    });

    it("is frozen, so a caller cannot widen what the decoder resolves", () => {
      expect(Object.isFrozen(ESCAPE_STAGE_REFERENCES)).toBe(true);
    });
  });

  describe("rejecting a non-string", () => {
    it("throws rather than coercing", () => {
      expect(() => decodeSanitizedRead(undefined)).toThrow(TypeError);
      expect(() => decodeSanitizedRead(null)).toThrow(TypeError);
    });
  });

  describe("as a command", () => {
    const SAMPLE = "the set&#39;s &amp;&amp; a stored &amp;lt; and &#34;q&#34;";
    const EXPECTED = "the set's && a stored &lt; and \"q\"";

    it("prints usage and exits 0 on --help", async () => {
      const { stdout } = await execFileAsync(process.execPath, [
        SCRIPT,
        "--help",
      ]);
      expect(stdout).toContain("Usage:");
      expect(stdout).toContain("not the stored bytes");
    });

    it("decodes stdin", async () => {
      const child = execFileAsync(process.execPath, [SCRIPT]);
      child.child.stdin.end(SAMPLE);
      const { stdout } = await child;
      expect(stdout).toBe(EXPECTED);
    });

    it("decodes a file argument identically to stdin", async () => {
      const dir = await mkdtemp(join(tmpdir(), "decode-sanitized-read-"));
      const file = join(dir, "input.md");
      await writeFile(file, SAMPLE, "utf8");

      const { stdout } = await execFileAsync(process.execPath, [SCRIPT, file]);
      expect(stdout).toBe(EXPECTED);
    });

    it("exits 2 naming the path when the file does not exist", async () => {
      const missing = join(tmpdir(), "decode-sanitized-read-absent.md");
      await expect(
        execFileAsync(process.execPath, [SCRIPT, missing]),
      ).rejects.toMatchObject({ code: 2 });

      const failure = await execFileAsync(process.execPath, [
        SCRIPT,
        missing,
      ]).catch((error) => error);
      expect(failure.stderr).toContain(missing);
    });
  });
});
