#!/usr/bin/env node
// the probe job's plan, for .github/workflows/effect-eval.yaml.
//
// it resolves what one matrix cell needs — which mock to materialize, which
// skills its condition installs, and whether evaluate.mjs is to spawn anything
// — and emits them as JSON for the workflow to read with `jq`. it runs nothing
// itself: the workflow stays visibly in charge of what it invokes, which is
// also what keeps this script a pure function a test can call.
//
// that testability is the whole reason it exists. this derivation used to be a
// shell loop in the workflow body:
//
//   while IFS= read -r skill; do args+=(--skill "${skill}"); done \
//     < <(node -e '... process.stdout.write(c.skills.join("\n"))')
//
// `join` emits no trailing newline, so `read` took the last element and then
// returned non-zero at EOF; `while` keys on that status, so the body never ran
// and --skill never reached setup.mjs. the skill-present condition installed
// nothing — the treatment group with no treatment — and it cleared an
// independent review and three planted-violation checks, because the only
// assertions available read the workflow's text and never its behaviour. a
// loop that parses correctly and runs zero times passes every one of them.
//
// size is not why this is a file. a three-line inline conditional has the same
// defect.
//
// exit codes:
//   0  the plan is on stdout as JSON
//   2  bad invocation, an unknown case, an unknown condition, or a dry-run
//      input that is neither "true" nor "false"

import { join, resolve } from "node:path";

import { CONDITIONS } from "../../tools/evaluation/effect/src/layout.mjs";
import { DEFAULT_ROOT, parseDryRunInput, readDeclaredCase } from "./lib/effect-eval-fixture.mjs";

const USAGE = `Usage: effect-eval-probe-plan.mjs --case <id> --condition <c> --dry-run-input <b>

Resolve one probe matrix cell into the mock, the skills its condition installs,
and the flags evaluate.mjs is to receive. Prints JSON; runs nothing.

  --case <id>              the case to plan (required)
  --condition <c>          ${CONDITIONS.join(" | ")} (required)
  --dry-run-input <b>      the dispatch's dry-run input, "true" or "false" (required)
  --root <dir>             the data root (default: ${DEFAULT_ROOT})
  --help                   this text

Output: {"mock": ..., "skills": [...], "patch": ..., "evaluateFlags": [...]}

"patch" is the absolute path of the case's declared patch, resolved against the
data root, or "" when the case declares none.

Exit codes: 0 planned, 2 bad invocation or an input that does not resolve.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = { caseId: null, condition: null, dryRunInput: null, root: DEFAULT_ROOT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };
    if (arg === "--case") options.caseId = next();
    else if (arg === "--condition") options.condition = next();
    else if (arg === "--dry-run-input") options.dryRunInput = next();
    else if (arg === "--root") options.root = next();
    else fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
  }
  return options;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArgv(argv);
  if (!options.caseId) fail2(`--case is required.\n${USAGE}`);
  if (options.condition === null) fail2(`--condition is required.\n${USAGE}`);
  if (options.dryRunInput === null) fail2(`--dry-run-input is required.\n${USAGE}`);

  // against the instrument's own list rather than a second literal copy, so a
  // condition added there cannot be silently unknown here.
  if (!CONDITIONS.includes(options.condition)) {
    fail2(
      `Unknown condition ${JSON.stringify(options.condition)}. ` +
        `Known: ${CONDITIONS.join(", ")}`,
    );
  }

  let dryRun;
  try {
    dryRun = parseDryRunInput(options.dryRunInput);
  } catch (error) {
    fail2(error.message);
  }

  let declared;
  try {
    declared = await readDeclaredCase(options.root, options.caseId);
  } catch (error) {
    fail2(error.message);
  }

  const plan = {
    mock: declared.mock,
    // the condition is itself the skill set: skill-present installs what the
    // case declares, skill-absent installs nothing. that mapping used to be a
    // YAML `if`, where nothing could execute it.
    skills: options.condition === "skill-present" ? (declared.skills ?? []) : [],
    // a patch belongs to a case rather than to a condition: both conditions
    // have to start from one project tree, or the comparability check the
    // summary runs fails by construction. resolved here rather than in the
    // workflow because the declared path is relative to the fixture that
    // declares it, and the workflow has no idea where that is. "" rather than
    // null, so the workflow's `jq -er` yields an empty string to test rather
    // than the text "null" — and so a field that is missing rather than empty
    // is the one case that exits non-zero there.
    patch: declared.patch ? resolve(join(options.root, declared.patch)) : "",
    evaluateFlags: dryRun ? ["--dry-run"] : [],
  };

  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

main();
