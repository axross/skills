#!/usr/bin/env node
// decode-sanitized-read.mjs — recover readable text from a sanitized GitHub read.
//
// A GitHub tool channel commonly returns issue and pull-request text through an
// HTML sanitizer (see ../SKILL.md › Editing an Existing Body). That pipeline
// runs in three stages: it deletes tags and HTML comments, decodes character
// references, and then escapes the five characters an HTML escaper covers. This
// command inverts the third stage and nothing else.
//
// What it recovers:
//   the five character references the escape stage can emit, resolved so the
//   text reads as prose again rather than as markup.
//
// What it CANNOT recover, ever:
//   - deleted tags and HTML comments, which carry no residue to invert;
//   - the difference between a stored character and a stored reference naming
//     that character. The pipeline decodes before it escapes, so both arrive
//     identical and the read is many-to-one.
//
// Decoded output is therefore a readable reconstruction, NOT the stored bytes.
// Do not write it back over a body, and do not report it as what is stored. To
// obtain stored bytes, read through a route that does not sanitize, and compare
// against the response field parsed as structured data — an extractor's stdout
// and a shell capture each move a trailing newline, in opposite directions.
//
// The single pass is the correctness argument. Resolving the references one
// after another, with the ampersand entity first, decodes a stored reference
// one level too many — and nothing reports it. One regex, one pass, no
// replacement output rescanned.
//
// It is dependency-light (Node standard library only) so it runs anywhere the
// skill is installed.
//
// Usage:
//   node decode-sanitized-read.mjs <file>   # decode the contents of a file
//   node decode-sanitized-read.mjs -        # decode stdin
//   <producer> | node decode-sanitized-read.mjs   # decode stdin when no arg
//
// Exit codes:
//   0  the input was decoded and written to stdout
//   2  bad invocation — no input could be read

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// The five references an HTML escaper emits, and the characters they name.
// Keyed by the exact reference text so the lookup cannot resolve a reference
// this map does not list.
export const ESCAPE_STAGE_REFERENCES = Object.freeze({
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&#34;": '"',
  "&#39;": "'",
});

// Matches exactly the five references above and nothing else. Alternation in a
// single pass is what makes this the inverse of one escape: `String.replace`
// continues after each match rather than rescanning what it just wrote, so a
// reference produced by the replacement is left alone.
const ESCAPE_STAGE_PATTERN = /&(?:amp|lt|gt|#34|#39);/g;

/**
 * Invert the escape stage of a sanitized read.
 *
 * @param {string} text Text as the tool channel returned it.
 * @returns {string} The same text with the escape stage undone. Input carrying
 *   none of the five references is returned unchanged.
 */
export function decodeSanitizedRead(text) {
  if (typeof text !== "string") {
    throw new TypeError(
      `decodeSanitizedRead expects a string, received ${typeof text}`,
    );
  }
  return text.replace(
    ESCAPE_STAGE_PATTERN,
    (reference) => ESCAPE_STAGE_REFERENCES[reference],
  );
}

const USAGE = `Usage:
  node decode-sanitized-read.mjs <file>   decode the contents of a file
  node decode-sanitized-read.mjs -        decode stdin
  <producer> | node decode-sanitized-read.mjs

Inverts the escape stage of a sanitized GitHub read: the five character
references an HTML escaper emits are resolved, and nothing else is touched.

Deleted tags and HTML comments are NOT recovered, and a stored character cannot
be told from a stored reference naming it. The output is a readable
reconstruction, not the stored bytes — do not write it back over a body.

Exit codes:
  0  decoded, written to stdout
  2  bad invocation`;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

async function main() {
  const arg = process.argv[2];

  if (arg === "--help" || arg === "-h") {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  let input;
  if (arg === undefined || arg === "-") {
    if (arg === undefined && process.stdin.isTTY) {
      fail(`No input. Pass a file, or pipe text in.\n\n${USAGE}`);
    }
    input = await readStdin();
  } else {
    try {
      input = await readFile(arg, "utf8");
    } catch (error) {
      fail(`Cannot read ${arg}: ${error.code ?? error.message}`);
    }
  }

  process.stdout.write(decodeSanitizedRead(input));
  process.exit(0);
}

// Only run as a command. Imported as a module, this file exposes the decoder
// and its reference map without touching argv, stdin, or the exit code.
// `pathToFileURL` rather than string concatenation: it encodes a path that
// needs it, so a checkout under a directory with a space still matches.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
