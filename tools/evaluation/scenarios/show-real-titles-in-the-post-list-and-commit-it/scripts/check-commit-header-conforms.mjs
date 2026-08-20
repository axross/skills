#!/usr/bin/env node
// a transcript-phase script judgment: does the commit the probe left behind
// carry a Conventional Commits header.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "transcript", so the only material
// factor-judgment.mjs's materialFor hands it is the raw transcript string —
// the CLI's `--output-format stream-json` stdout, one JSON object per line.
//
// Why the transcript and not the workspace: capture.mjs stages the probe's
// work and diffs it against the commit the probe started from, content
// against content, so that a probe which committed its work is captured
// identically to one that left it uncommitted. That is deliberate, and it
// means a commit *message* reaches no outcome-phase factor at all. It does
// reach this one, because `git commit -m "…"` is a Bash call and the
// transcript stores every tool_use block's own input verbatim.
//
// Why this does not spawn skills/conventional-commits/scripts/check-commit-message.mjs,
// which validates the same header: that would make the judgment a moving
// target. If the skill's allowed types or separator rules ever broaden,
// every measurement already stored would silently change meaning — and
// #392 settled that a changed judge is a new measurement rather than an
// update. The type set lives in this factor's declared `input`, where it is
// part of the stored record, and the grammar lives below, where a change to
// it shows up in this file's own diff. It is also a narrower claim than the
// validator makes: this judges the header alone, never the body separation
// or the footers the validator also checks.
//
// Which commit is judged, when a probe made several: the last one whose
// message this can read. A probe that wrote "WIP" and then corrected itself
// is the target skill working rather than failing, so crediting the message
// that stands is the honest reading. The cost is stated rather than hidden —
// a probe that made two genuinely different commits is judged on its second.
//
// The false-versus-error line (tests/repository/scenario-script-false-versus-error.test.mjs):
// a transcript carrying no `git commit` at all is a real `false` — the
// material was there and what this looked for was not in it — and the
// scenario's own completion-floor factor is what reports the absence as
// such. An error stays reserved for the two things this genuinely cannot
// judge: material that is missing or malformed, and a transcript whose only
// commits pass their message somewhere this cannot read it (`-F file`,
// `--amend --no-edit`), which its recognizer cannot classify either way.
//
// usage: node check-commit-header-conforms.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-commit-header-conforms.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const types = context.input?.types;
if (!Array.isArray(types) || types.length === 0 || types.some((type) => typeof type !== "string")) {
  fail("context.input.types must be a non-empty array of strings naming the allowed commit types.");
}

const transcript = context.material?.transcript;
if (typeof transcript !== "string") {
  fail("context.material.transcript must be a string — this script judges the transcript phase alone.");
}

// `<type>[(scope)][!]: <description>`, the same shape Conventional Commits
// v1.0.0 defines: a required `: ` separator with exactly one space, and a
// scope, when present, in non-empty parentheses.
//
// the type is matched case-insensitively against the declared set below,
// because that is what the contract being scored says: SKILL.md › Type —
// "MUST treat types as case-insensitive in parsing but SHOULD write them
// lowercase". The skill's own validator lower-cases before its membership
// check and passes `Fix:` with a warning, so scoring it `false` here would
// have this factor disagree with the very contract it exists to measure.
// The SHOULD is deliberately not enforced: a factor is a boolean, and
// failing a conforming header over a style preference would be a false
// negative dressed as rigour.
const HEADER_RE = /^([A-Za-z]+)(?:\(([^)]*)\))?(!)?: (.+)$/;

// a `git commit` anywhere in a command, skipping leading `git` flag tokens
// (`git --no-pager commit`) and whatever precedes it in the line
// (`cd x && …`, `FOO=bar git commit …`).
//
// what this deliberately does NOT match is a `git` flag that takes its value
// as a separate token — `git -C dir commit`, whose `dir` is not a flag, so
// the alternation cannot step over it. That form is missed rather than read.
// Widening the pattern to accept it was considered and rejected: the
// scenario's completion-floor factor recognizes a commit by the literal
// substring `git commit` (judgments/check-transcript-tool-input-mentions.mjs),
// which misses that form too, and the two factors reading a transcript
// differently is worse than both reading it narrowly — a floor reporting
// "never committed" beside a header verdict of `true` is a contradictory
// record, where two narrow readings at least agree. None of the 13 real
// commits across the retired instrument's 224 transcripts uses it.
const COMMIT_RE = /\bgit\s+(?:-\S+\s+)*commit\b/g;

// the message flag, in any form git accepts: a short `-m`, a short cluster
// ending in m (`-am`), or the long `--message`, followed by `=` or blank.
const MESSAGE_FLAG_RE = /(?:^|\s)(?:--message(?:=|\s+)|-[A-Za-z]*m(?:=|\s+))/;

/**
 * the subject line of the message a single `git commit …` invocation passes
 * inline, or null when it passes none this can read.
 *
 * three forms are recognized, which is every form the 224 retired probe
 * transcripts actually used: the `"$(cat <<'EOF' … EOF)"` heredoc that
 * dominates them, a plain double-quoted string, and a single-quoted one.
 *
 * @param {string} rest the command text from the end of `git … commit` on
 * @returns {string|null}
 */
function subjectFrom(rest) {
  const flag = MESSAGE_FLAG_RE.exec(rest);
  if (flag === null) return null;

  const value = rest.slice(flag.index + flag[0].length);

  // `-m "$(cat <<'EOF'` / `<<EOF` / `<<-EOF` — the subject is the line after it.
  const heredoc = /^"\$\(\s*cat\s+<<-?\s*'?[A-Za-z_][A-Za-z0-9_]*'?\s*\r?\n([^\n]*)/.exec(value);
  if (heredoc !== null) return heredoc[1];

  // `-m "…"`, honouring a backslash-escaped quote inside it. only the first
  // line is the subject; a multi-line message carries its body after it.
  const doubleQuoted = /^"((?:[^"\\]|\\.)*)"/.exec(value);
  if (doubleQuoted !== null) return doubleQuoted[1].split("\n")[0].replace(/\\(["`$\\])/g, "$1");

  // `-m '…'` — a single-quoted shell string has no escape processing at all.
  const singleQuoted = /^'([^']*)'/.exec(value);
  if (singleQuoted !== null) return singleQuoted[1].split("\n")[0];

  return null;
}

// every tool_use block's own input, read the same way
// tools/evaluation/src/transcript/events.mjs's toolUseBlocks does and
// re-read here rather than imported, because a judgment script is spawned as
// its own process rather than imported (factor-judgment.mjs's
// runScriptJudgment) and stays runnable on its own. A stream line that does
// not parse as JSON is skipped rather than treated as a failure: a truncated
// final line is ordinary, not corrupt.
const commands = [];
for (const line of transcript.split("\n")) {
  const text = line.trim();
  if (text === "") continue;
  let event;
  try {
    event = JSON.parse(text);
  } catch {
    continue;
  }
  const content = event?.message?.content;
  if (!Array.isArray(content)) continue;
  for (const block of content) {
    if (block?.type !== "tool_use") continue;
    const command = block.input?.command;
    if (typeof command === "string") commands.push(command);
  }
}

let commitInvocations = 0;
const subjects = [];
for (const command of commands) {
  COMMIT_RE.lastIndex = 0;
  let match;
  while ((match = COMMIT_RE.exec(command)) !== null) {
    commitInvocations += 1;
    const subject = subjectFrom(command.slice(match.index + match[0].length));
    if (subject !== null) subjects.push(subject);
  }
}

if (subjects.length === 0) {
  if (commitInvocations > 0) {
    fail(
      `the transcript's ${commitInvocations} \`git commit\` invocation(s) passed no message this ` +
        "script can read — a `-F <file>`, an `--amend --no-edit`, or an editor-composed message " +
        "leaves the header outside the tool input, so whether it conforms cannot be judged either way.",
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      result: false,
      evidence: `no \`git commit\` appears in any of the transcript's ${commands.length} shell command(s), so no header was written to judge`,
    })}\n`,
  );
  process.exit(0);
}

// the message that stands — see this file's header for why the last rather
// than every one.
const subject = subjects[subjects.length - 1];
const header = HEADER_RE.exec(subject);
const allowed = new Set(types);

let result = false;
let reason;
if (header === null) {
  reason = "it does not take the form `<type>[(scope)][!]: <description>`";
} else if (!allowed.has(header[1].toLowerCase())) {
  reason = `its type "${header[1]}" is not one of [${types.join(", ")}]`;
} else if (header[2] !== undefined && header[2].trim() === "") {
  reason = "its scope is present but empty";
} else {
  result = true;
}

const evidence = result
  ? `the last commit header this transcript wrote was ${JSON.stringify(subject)}, which conforms`
  : `the last commit header this transcript wrote was ${JSON.stringify(subject)}, and ${reason}`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
