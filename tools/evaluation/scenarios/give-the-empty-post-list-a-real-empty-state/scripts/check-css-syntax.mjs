#!/usr/bin/env node
// an outcome-phase script judgment: is every CSS Module in the reconstructed
// workspace still well-formed after the probe's own diff was applied.
//
// Why the whole tree rather than one named file: the task never says which
// file a visual change belongs in, and tools/evaluation/mocks/README.md
// records that inkwell's own checks — including its linter — already pass
// in a materialized copy, so any file this reads that fails to parse was
// broken by the probe's own diff, not inherited from the mock. Scanning
// every `*.module.css` under `src/` sidesteps having to guess which one the
// probe touched.
//
// This is a lightweight, delimiter-based reading, not a real CSS parser: it
// walks a file split on `{`, `}`, and `;` and checks each resulting segment
// is either an opening rule/at-rule, a closing brace, or a
// "property: value" declaration (the last declaration in a block may omit
// its trailing `;`, which CSS itself allows). It does not validate that a
// value is well-formed CSS on its own terms — only that the file's overall
// shape is intact.
//
// usage: node check-css-syntax.mjs <context.json>

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-css-syntax.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const dir = context.input?.dir ?? "src";
if (typeof dir !== "string" || dir.length === 0) {
  fail("context.input.dir, when present, must be a non-empty, workspace-relative directory.");
}

/** every `*.module.css` file under `root`, workspace-relative, recursively. */
function findModuleCssFiles(root) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true, recursive: true });
  } catch (error) {
    fail(`could not read ${root} from the reconstructed workspace: ${error.message}`);
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".module.css"))
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name));
}

/**
 * @param {string} content
 * @returns {string[]} human-readable violations, empty when the file is well-formed
 */
function validateCssSyntax(content) {
  const text = content.replace(/\/\*[\s\S]*?\*\//g, "");
  const violations = [];
  let depth = 0;
  let segStart = 0;

  const isDeclaration = (segment) => {
    const match = segment.match(/^(--[A-Za-z0-9-]+|[A-Za-z-]+)\s*:\s*([\s\S]+)$/);
    if (!match) return false;
    // a second "prop:" starting its own line inside a value usually means a missing ";"
    // merged two declarations, not a multi-line value — none of this mock's CSS values
    // put a bare newline before an identifier and colon; a value that spans lines
    // (Button.module.css's `transition`) uses a trailing comma instead.
    return !/\n\s*(--[A-Za-z0-9-]+|[A-Za-z-]+)\s*:/.test(match[2]);
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "{" && ch !== "}" && ch !== ";") continue;
    const segment = text.slice(segStart, i).trim();
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      if (depth === 0) {
        violations.push(`a "}" appears with no block open, near ${JSON.stringify(segment.slice(0, 60))}`);
      } else {
        depth--;
      }
      if (segment.length > 0 && !isDeclaration(segment)) {
        violations.push(`text before a "}" is neither empty nor a declaration: ${JSON.stringify(segment.slice(0, 60))}`);
      }
    } else if (!isDeclaration(segment)) {
      violations.push(`text before a ";" is not a "property: value" declaration: ${JSON.stringify(segment.slice(0, 60))}`);
    }
    segStart = i + 1;
  }

  const trailing = text.slice(segStart).trim();
  if (trailing.length > 0) {
    violations.push(`trailing content after the last declaration: ${JSON.stringify(trailing.slice(0, 60))}`);
  }
  if (depth !== 0) violations.push(`the file ends with ${depth} block(s) still unclosed`);

  return violations;
}

const files = findModuleCssFiles(dir);
if (files.length === 0) {
  fail(`no *.module.css file exists under ${dir} in the reconstructed workspace — this factor has nothing to check.`);
}

const perFileViolations = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch (error) {
    fail(`could not read ${file}: ${error.message}`);
  }
  const violations = validateCssSyntax(content);
  if (violations.length > 0) perFileViolations.push(`${file}: ${violations.join("; ")}`);
}

const result = perFileViolations.length === 0;
const evidence = result
  ? `every one of ${files.length} CSS Module file(s) under ${dir} is still well-formed`
  : perFileViolations.join(" | ");

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
