#!/usr/bin/env node
// the admit job of .github/workflows/discovery-eval.yaml.
//
// it resolves the whole dispatch before any probe spawns: which mode this run
// is (a pull request's head skills, evaluated bare and reported; a prompt
// override, evaluated situated-or-bare exactly as the case declares and
// reported; or a measurement, evaluated per the fixture and landed), which
// cases the matrix covers, and — for the money at stake — whether the
// projected total fits the fixture's cap.
//
// THREE MODES, ONE PURE FUNCTION. mode is `"head"` when `--pull-request` is
// non-empty (and it must then parse to a positive integer, or the dispatch
// refuses outright — see lib/discovery-eval-fixture.mjs's
// parsePullRequestInput — rather than silently falling through to a
// measurement dispatch), `"override"` when `--prompt` is non-empty, and
// `"measurement"` otherwise. `--pull-request` and `--prompt` together are
// refused here, before any probe spawns: a pull request's head text and a
// maintainer's own override text are two different threat models and two
// different workspaces, and this is the one place a dispatch naming both
// gets caught before the fan-out.
//
// SAFETY PROPERTY 5 LIVES HERE, for both non-recording modes. `records` is
// `mode === "measurement"` and nothing else decides it — the land job's `if:`
// reads this output rather than re-deriving the mode a second way, which is
// the same "one resolution, not two" discipline effect-eval-landing-plan.mjs
// documents. A head-mode or override-mode dispatch's per-case plan
// (discovery-eval-probe-plan.mjs) never receives `--out`, so it structurally
// cannot materialize a case measurement — see that script's header for the
// other half of this property.
//
// ADMISSION IS FIXTURE-WIDE HERE, unlike evaluate.mjs's own per-case call.
// evaluate.mjs projects one case's repeats against the fixture's whole
// `capUsd`, which is right for a single invocation but says nothing about a
// dispatch matrixing over many cases at once — a large fan-out projecting
// over the cap is exactly the scenario this script exists to catch before
// spawning jobs that would each individually look affordable.
//
// EACH CASE IS PROJECTED AT THE MODE THAT DISPATCH WILL ACTUALLY RUN IT IN
// (src/plan.mjs's `planFor`), never the mode the case merely declares. A head
// dispatch (`--pull-request` set) forces every case bare, so it is projected
// at `unmeasuredProbeCostCeilingUsd.bare` — roughly an order of magnitude
// below the situated figure. Projecting a bare run at the situated figure was
// the defect this file was rewritten to fix: pricing every case as situated
// inflates a head dispatch's projection by that same order of magnitude, for
// no reason its actual (bare-only) tool posture justifies. See
// tools/discovery-eval/src/admission.mjs's header for why superseding a
// ceiling with a committed measurement is per mode too.
//
// AN OVERRIDE DISPATCH (`--prompt` set) PRICES EXACTLY LIKE A MEASUREMENT ONE
// — each case at its own declared mode, never forced bare — because it stays
// situated: forcing bare would move two variables at once (the prompt and
// the workspace) when the whole point is to hold the workspace fixed and vary
// only the prompt. Admission still binds it, projecting from the case's
// committed measurements where they exist and from the declared ceiling
// where they do not, exactly as any first run of a case is priced — there is
// no separate rule for "a case with no committed measurement yet" here or in
// tools/discovery-eval/src/admission.mjs.
//
// A MEASUREMENT DISPATCH PROJECTS EACH CASE AT ITS OWN DECLARED MODE — a
// mock-declaring case at `.situated`, and (independent of any `--pull-request`
// forcing) the fixture's cases that declare no `mock` at `.bare`, because
// they run bare in a plain measurement dispatch too. Honestly pricing those
// bare-declared cases lowers the whole fixture's projected total relative to
// the pre-fix bug's uniform-situated arithmetic, which priced every case —
// bare-declared ones included — at the situated ceiling. The fixture's
// current whole-fixture projection, at whatever size the fixture is today,
// is stated in data/discovery-eval/README.md ("What is committed here") and
// nowhere else — recomputing it here from a case count or a probe count
// would go stale the next time a case moves, which is what happened to this
// very comment once already, which is why it no longer carries one.
//
// PRICING A MEASUREMENT DISPATCH CONSERVATIVELY — as though every case ran
// situated, so the whole corpus keeps refusing until something has been
// measured — was considered and declined. It would contradict the per-case
// line this same script prints, which names the mode it projected: a total
// that prices a case at $0.35 above a line reading `$0.05 each [bare]` is
// not a stop-loss, it is a wrong number, and a guard nobody can reconcile
// with its own output is one nobody trusts. The stop-loss is unconditional
// where it matters — any projection over the cap refuses, before any probe
// spawns — and an unmeasured case is already priced pessimistically by the
// ceiling it projects from.
//
// exit codes:
//   0  admitted; mode, the case list, and the projection are on stdout and in
//      $GITHUB_OUTPUT
//   2  bad invocation, an unknown case, or an input that does not resolve
//   4  refused — the projected total exceeds the fixture's cap, and nothing
//      downstream runs

import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";

import { ceilingFor, meanProbeCost } from "../../tools/discovery-eval/src/admission.mjs";
import { SUMMARY_FILE } from "../../tools/discovery-eval/src/layout.mjs";
import { planFor } from "../../tools/discovery-eval/src/plan.mjs";
import {
  DEFAULT_ROOT,
  parseDryRunInput,
  parsePromptInput,
  parsePullRequestInput,
  readFixture,
} from "./lib/discovery-eval-fixture.mjs";

const USAGE = `Usage: discovery-eval-admit.mjs --dry-run-input <b> [options]

Resolve a discovery-eval dispatch's mode and case list, project its total
cost, and refuse before any probe spawns when that projection exceeds the
fixture's cap.

  --case <id>          run one case rather than the whole fixture (optional)
  --pull-request <n>    a pull request number: this dispatch evaluates that
                         pull request's changed skills, bare, and records
                         nothing (optional; empty means not a head dispatch)
  --prompt <text>       override the selected case's prompt: this dispatch
                         evaluates it exactly as declared (situated or bare)
                         and records nothing (optional; empty means not an
                         override dispatch). Refused together with
                         --pull-request
  --repeats <n>         override every selected case's declared repeat count
                         (optional; blank honours each case's own declaration)
  --dry-run-input <b>   the dispatch's raw dry_run input, "true" or "false"
                         (required)
  --root <dir>          the data root (default: ${DEFAULT_ROOT})
  --help                this text

Exit codes: 0 admitted, 2 bad invocation, 4 refused.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = {
    caseId: null,
    pullRequest: null,
    prompt: null,
    repeats: null,
    dryRunInput: null,
    root: DEFAULT_ROOT,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };
    if (arg === "--case") options.caseId = next();
    else if (arg === "--pull-request") options.pullRequest = next();
    else if (arg === "--prompt") options.prompt = next();
    else if (arg === "--repeats") options.repeats = next();
    else if (arg === "--dry-run-input") options.dryRunInput = next();
    else if (arg === "--root") options.root = next();
    else fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
  }
  return options;
}

/**
 * every past probe cost of `caseId` measured IN `mode`, one figure per
 * committed measurement.
 *
 * mirrors evaluate.mjs's own `historicalCostsFor` exactly — no `comparable`
 * filter, unlike the effect side's admit script, and the same mode filter —
 * so this projection agrees with what evaluate.mjs will independently
 * compute per case. A measurement recorded in the other mode must not
 * supersede this mode's ceiling; see
 * tools/discovery-eval/src/admission.mjs's header.
 */
async function historicalCostsFor(root, caseId, mode) {
  let raw;
  try {
    raw = await readFile(join(root, SUMMARY_FILE), "utf8");
  } catch {
    return [];
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    return [];
  }
  return (Array.isArray(doc.measurements) ? doc.measurements : [])
    .filter(
      (entry) =>
        entry.case === caseId &&
        entry.workspace?.mode === mode &&
        typeof entry.totalCostUsd === "number" &&
        Number.isInteger(entry.probeCount) &&
        entry.probeCount > 0,
    )
    .map((entry) => entry.totalCostUsd / entry.probeCount);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArgv(argv);
  if (options.dryRunInput === null) fail2(`--dry-run-input is required.\n${USAGE}`);

  let dryRun;
  let pullRequest;
  let prompt;
  try {
    dryRun = parseDryRunInput(options.dryRunInput);
    pullRequest = parsePullRequestInput(options.pullRequest ?? undefined);
    prompt = parsePromptInput(options.prompt ?? undefined);
  } catch (error) {
    fail2(error.message);
  }

  // refused here, before any probe spawns: a pull request's head text and a
  // maintainer's own override text are two different threat models and two
  // different workspaces, and must not meet in one dispatch — see this
  // file's header and tools/discovery-eval/evaluate.mjs's own refusal of the
  // same combination.
  if (pullRequest !== null && prompt !== null) {
    fail2(
      "--pull-request and --prompt cannot both be given: a pull-request dispatch evaluates " +
        "untrusted head text, forced bare; a prompt override evaluates a maintainer's own text, " +
        `staying situated. Drop one of them.\n${USAGE}`,
    );
  }

  // --prompt REQUIRES --case, and this is the only place that can enforce it.
  // An override replaces ONE case's declared prompt; substituting the same
  // text into every other case's is meaningless, because each case's
  // mustInclude/mustExclude tiers belong to a different skill. Without this,
  // a blank `case` falls through to the whole-fixture selection below and a
  // dispatch that reads like one reworded case fans out across the corpus —
  // 40 probes' worth of spend producing artifacts comparable with nothing.
  // discovery-eval-probe-plan.mjs already requires --case unconditionally at
  // its own CLI level, so only admission can widen the matrix, and only
  // admission can refuse before it does.
  if (prompt !== null && !options.caseId) {
    fail2(
      "--prompt overrides one case's declared prompt, so it needs --case naming which one. " +
        "Without it this would run the whole fixture with the same text substituted into every " +
        `case, which is comparable with nothing. Drop --prompt to admit an ordinary measurement dispatch instead.\n${USAGE}`,
    );
  }

  if (options.repeats !== null) {
    const value = Number(options.repeats);
    if (!Number.isInteger(value) || value < 1) fail2("--repeats needs a positive integer.");
    options.repeats = value;
  }

  let fixture;
  try {
    fixture = await readFixture(options.root);
  } catch (error) {
    fail2(error.message);
  }

  let caseIds;
  if (options.caseId) {
    if (!fixture.cases.some((entry) => entry.id === options.caseId)) {
      const known = fixture.cases.map((entry) => entry.id).join(", ");
      fail2(`${options.root}/fixture.json declares no case ${JSON.stringify(options.caseId)}. Known: ${known}`);
    }
    caseIds = [options.caseId];
  } else {
    caseIds = fixture.cases.map((entry) => entry.id);
  }

  // safety property 5's positive half, generalised to three modes: mode is
  // this expression and nothing else decides it. every downstream reader —
  // the probe plan, the land job's `if:` — reads `records` from this job's
  // output rather than re-deriving it.
  const mode = pullRequest !== null ? "head" : prompt !== null ? "override" : "measurement";
  const records = mode === "measurement";

  let projectedTotalUsd = 0;
  const lines = [];
  for (const caseId of caseIds) {
    const declared = fixture.cases.find((entry) => entry.id === caseId);
    const repeats = options.repeats ?? declared.repeats ?? 1;
    // the mode THIS DISPATCH runs the case in, not the mode it declares — a
    // head dispatch (mode === "head") forces every case bare regardless of
    // any `mock` the case names. An override dispatch (mode === "override")
    // forces nothing, so it prices exactly like a measurement one. See this
    // file's header.
    const plan = planFor(declared, { headSkills: mode === "head" });
    const historicalCosts = await historicalCostsFor(options.root, caseId, plan.mode);
    const measured = meanProbeCost(historicalCosts);
    const perProbeUsd = measured ?? ceilingFor(fixture.unmeasuredProbeCostCeilingUsd, plan.mode);
    const basis = measured === null ? `the fixture's declared ${plan.mode} ceiling` : `committed ${plan.mode} measurements`;
    const caseCostUsd = perProbeUsd * repeats;
    projectedTotalUsd += caseCostUsd;
    lines.push(
      `  ${caseId} (${plan.mode}): ${repeats} probe(s) at $${perProbeUsd.toFixed(2)} each [${basis}] = ` +
        `$${caseCostUsd.toFixed(2)}`,
    );
  }

  const admitted = projectedTotalUsd <= fixture.capUsd;
  process.stderr.write(
    `${mode} dispatch over ${caseIds.length} case(s)${dryRun ? " (dry run)" : ""}:\n` +
      `${lines.join("\n")}\n` +
      `Total: $${projectedTotalUsd.toFixed(2)} against a $${fixture.capUsd.toFixed(2)} cap` +
      `${admitted ? " — admitted" : " — REFUSED"}\n`,
  );

  if (!admitted) {
    process.stderr.write(
      "\nThis is a finding, not a threshold to adjust. Narrow the dispatch with --case, or wait " +
        "for a comparable measurement to replace the fixture's unmeasuredProbeCostCeilingUsd with a " +
        "real figure — raising the cap is a spending decision and is not this script's call.\n",
    );
    process.exit(4);
  }

  const outputs = {
    mode,
    cases: JSON.stringify(caseIds),
    records: String(records),
    "cap-usd": fixture.capUsd,
    "projected-usd": Number(projectedTotalUsd.toFixed(2)),
  };
  process.stdout.write(`${JSON.stringify(outputs)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    const gh = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
    await appendFile(process.env.GITHUB_OUTPUT, `${gh.join("\n")}\n`, "utf8");
  }
}

main();
