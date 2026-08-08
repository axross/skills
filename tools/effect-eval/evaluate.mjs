#!/usr/bin/env node
// run one probe against one prepared workspace, and write its probe record.
//
// one probe, not a case. the probes of one case run as a matrix across separate
// runners so they share a wall-clock window and service drift lands on both
// conditions alike. this is what one cell of that matrix invokes; nothing here
// knows about the other cells and nothing here aggregates.
//
// the transcript is stored verbatim, which is the point of the rebuild. the
// instrument this replaces stored extracted signals and discarded the raw
// stream, reasoning that a later question would be a threshold over the signal
// already extracted. it was not: reading six recovered session logs answered
// three questions the stored records could not — which tools each run used, the
// per-message token usage, and the model each message reported.
//
// a non-zero exit from the CLI is expected: with a turn cap of 100 a
// legitimately long run ends in `error_max_turns` and a non-zero status. the
// stream is complete either way, so the exit code is never read as failure.
//
// the order of the writes is deliberate. the transcript is redacted and written
// first, before anything reads the workspace, because everything after that
// point touches model-produced content and can meet something unforeseen. a
// failure there costs the fields it would have produced, never the one file
// that cannot be re-acquired.
//
// exit codes:
//   0  a probe record was written (or --dry-run wrote one with no spawn)
//   2  bad invocation, a missing workspace, or the `claude` CLI not on PATH
//   3  the transcript could not be vouched for and was not written

import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { redactTranscript, stripCredentials } from "../lib/credentials.mjs";
import { captureDiff, runGitCapture } from "./src/capture.mjs";
import { skillDigests, treeDigest } from "./src/fingerprint.mjs";
import {
  canonicalJson,
  CONDITIONS,
  DATA_ROOT,
  FIXTURE_FILE,
  newId,
  probeName,
  probePaths,
} from "./src/layout.mjs";
import { buildArgv, buildConfiguration, shellQuote } from "./src/spawn.mjs";

// up to 100 turns of edits and diffs, where the discovery probe is one turn of
// a single tool call.
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;

const USAGE = `Usage: evaluate.mjs [options]

Run one probe against a workspace setup.mjs prepared, and write its probe
record — metadata.json (declared), transcript.jsonl and changes.patch
(measured) — into a probe directory under the case measurement.

  --workspace <dir>     a workspace setup.mjs produced (required)
  --case <id>           the evaluation case's identifier (required)
  --condition <name>    ${CONDITIONS.join(" or ")} (required)
  --out <dir>           the case measurement directory to write the probe
                         directory into (required)
  --fixture <path>      the case fixture to read the task from
                         (default: data/effect-eval/fixture.json)
  --probe-id <hex>      the probe directory's id, for a reproducible tree
                         (default: eight random hex digits)
  --run-url <url>       the dispatch that produced this probe, recorded as
                         provenance
  --runtime-version <v> the CLI version this probe runs against, recorded in
                         the fingerprint (default: $CLAUDE_CODE_VERSION, or the
                         version the transcript reports, or null)
  --dry-run             fingerprint the workspace and write the record with a
                         synthetic transcript; spawn nothing. The record is
                         marked \`trigger.kind: "dry-run"\` so it cannot be
                         mistaken for a measurement.
  --help                this text

Exit codes: 0 a probe record was written, 2 bad invocation, 3 the transcript
held a credential this tool could not account for and was not written.`;

function fail(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
const fail2 = (message) => fail(2, message);

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function parseArgv(argv) {
  const options = {
    workspace: null,
    caseId: null,
    condition: null,
    out: null,
    fixture: join(DATA_ROOT, FIXTURE_FILE),
    probeId: null,
    runUrl: null,
    runtimeVersion: process.env.CLAUDE_CODE_VERSION ?? null,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };
    if (arg === "--workspace") options.workspace = next();
    else if (arg === "--case") options.caseId = next();
    else if (arg === "--condition") options.condition = next();
    else if (arg === "--out") options.out = next();
    else if (arg === "--fixture") options.fixture = next();
    else if (arg === "--probe-id") options.probeId = next();
    else if (arg === "--run-url") options.runUrl = next();
    else if (arg === "--runtime-version") options.runtimeVersion = next();
    else if (arg === "--dry-run") options.dryRun = true;
    else fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
  }
  return options;
}

async function readCase(fixturePath, caseId) {
  let fixture;
  try {
    fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  } catch (error) {
    fail2(`Could not read the case fixture at ${fixturePath}: ${error.message}`);
  }
  const declared = (fixture.cases ?? []).find((entry) => entry.id === caseId);
  if (!declared) {
    const known = (fixture.cases ?? []).map((entry) => entry.id).join(", ") || "(none)";
    fail2(`${fixturePath} declares no case ${JSON.stringify(caseId)}. Known cases: ${known}`);
  }
  return declared;
}

/**
 * shaped like the CLI's, carrying no measurement — so a dry run exercises the
 * whole pipeline, redaction and derivation included, rather than only the half
 * that precedes the spawn.
 */
function syntheticTranscript(configuration) {
  return (
    [
      JSON.stringify({
        type: "system",
        subtype: "init",
        model: configuration.model.model,
        version: configuration.runtime.version ?? undefined,
        skills: [],
      }),
      JSON.stringify({
        type: "result",
        subtype: "success",
        num_turns: 0,
        total_cost_usd: 0,
      }),
    ].join("\n") + "\n"
  );
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArgv(argv);
  for (const [flag, value] of [
    ["--workspace", options.workspace],
    ["--case", options.caseId],
    ["--condition", options.condition],
    ["--out", options.out],
  ]) {
    if (!value) fail2(`${flag} is required.\n${USAGE}`);
  }
  if (!CONDITIONS.includes(options.condition)) {
    fail2(`--condition must be one of ${CONDITIONS.join(", ")}, got ${options.condition}.`);
  }
  if (!(await isDirectory(options.workspace))) {
    fail2(`No workspace directory at ${options.workspace} — run setup.mjs first.`);
  }

  const declared = await readCase(options.fixture, options.caseId);
  const workspace = resolve(options.workspace);

  // before the spawn, which is the only moment it means what it says: the
  // workspace as the model first sees it. taken afterwards it would digest the
  // model's own edits and every probe would report a different tree.
  const projectTree = await treeDigest(workspace);
  const skills = await skillDigests(join(workspace, ".claude", "skills"));

  // before the spawn for the same reason as the digest: the model has Bash and
  // could commit.
  //
  // diagnostic only, never the comparability key — it says what differed where
  // `tree` says only that something did. see fingerprint.mjs for why a commit
  // hash cannot be the key. failing a paid probe over a diagnostic field would
  // be disproportionate, so a failure here costs the field and warns.
  let projectCommit = null;
  try {
    projectCommit = runGitCapture(["rev-parse", "HEAD"], workspace).trim();
  } catch (error) {
    process.stderr.write(
      `warning: could not read the workspace's HEAD (${error.message}); the probe is still ` +
        "recorded, with project.commit absent\n",
    );
  }

  if (options.condition === "skill-absent" && Object.keys(skills).length > 0) {
    fail2(
      `The workspace at ${workspace} has ${Object.keys(skills).join(", ")} installed, but ` +
        "--condition skill-absent. The condition and the workspace disagree; nothing was spawned.",
    );
  }
  if (options.condition === "skill-present" && Object.keys(skills).length === 0) {
    fail2(
      `The workspace at ${workspace} has no skill installed, but --condition skill-present. ` +
        "The condition and the workspace disagree; nothing was spawned.",
    );
  }

  const configuration = buildConfiguration({
    // part of the condition, so recorded rather than inferred. a local run that
    // names none records null, which the check reads as "not stated" rather
    // than as agreement.
    runtimeVersion: options.runtimeVersion,
    projectName: declared.mock,
    projectTree,
    projectCommit,
    skills,
    prompt: declared.task.prompt,
    targetModule: declared.task.targetModule,
  });
  const argvForCli = buildArgv(configuration);

  let rawStdout;
  let cliExitCode = null;
  if (options.dryRun) {
    process.stderr.write(
      `DRY RUN — nothing spawned. The command would have been:\n  claude ${argvForCli
        .map(shellQuote)
        .join(" ")}\n`,
    );
    rawStdout = syntheticTranscript(configuration);
  } else {
    const result = spawnSync("claude", argvForCli, {
      cwd: workspace,
      encoding: "utf8",
      env: stripCredentials(process.env),
      maxBuffer: MAX_BUFFER_BYTES,
    });
    if (result.error) {
      if (result.error.code === "ENOENT") {
        fail2(
          "The `claude` CLI is not on PATH. This probe drives the real CLI; install it or " +
            "run with --dry-run.",
        );
      }
      throw result.error;
    }
    rawStdout = result.stdout;
    cliExitCode = result.status;
  }

  // refuse rather than write something this tool cannot vouch for — see
  // tools/lib/credentials.mjs.
  let transcriptText;
  let redactedNames = [];
  try {
    ({ text: transcriptText, redacted: redactedNames } = redactTranscript(rawStdout));
  } catch (error) {
    fail(3, `${error.message}`);
  }

  const directory = join(options.out, probeName(options.condition, options.probeId ?? newId()));
  await mkdir(directory, { recursive: true });
  const paths = probePaths(directory);

  // the one file that cannot be re-acquired goes down first.
  await writeFile(paths.transcript, transcriptText, "utf8");

  const metadata = {
    timestamp: `${new Date().toISOString().slice(0, 19)}Z`,
    trigger: options.dryRun
      ? { kind: "dry-run", url: null }
      : { kind: options.runUrl ? "github-actions" : "local", url: options.runUrl },
    instrument: {
      commit: process.env.GITHUB_SHA ?? null,
      node: process.version,
      os: process.env.RUNNER_OS ?? process.platform,
    },
    cliExitCode,
    configuration,
  };
  await writeFile(paths.metadata, canonicalJson(metadata), "utf8");

  // guarded: a capture failure costs the diff and nothing else, the transcript
  // being already on disk.
  let diff = "";
  try {
    ({ diff } = captureDiff(workspace));
  } catch (error) {
    process.stderr.write(
      `warning: capture failed (${error.message}); the probe is still recorded, with an ` +
        "empty changes.patch\n",
    );
  }
  await writeFile(paths.changes, diff ?? "", "utf8");

  if (redactedNames.length > 0) {
    process.stderr.write(`redacted from the transcript: ${redactedNames.join(", ")}\n`);
  }
  process.stdout.write(`${directory}\n`);
}

main();
