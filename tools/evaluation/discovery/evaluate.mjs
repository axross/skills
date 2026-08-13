#!/usr/bin/env node
// resolve one case, prepare its probe workspace, run its declared repeats
// serially against it, and write one probe record per repeat.
//
// ONE PROCESS, NOT TWO. tools/effect-eval splits setup.mjs from evaluate.mjs
// because its probes fan out across separate runners under two conditions.
// Discovery has one condition — see tools/discovery-eval/README.md — so
// preparing a case's workspace and probing it happen together here, and a
// case's repeats run serially against the one workspace they share.
//
// TWO MODES, NEVER MIXED IN ONE DISPATCH. A case declaring a `mock` runs
// situated: a materialized mock, the whole skill corpus installed, Read,
// Glob, Grep and Skill permitted, a runaway turn guard. A case declaring
// none runs bare: a scratch workspace holding `.claude/skills` and nothing
// else, Skill only, two turns. `--head-skills` forces bare regardless of what
// the case declares — see src/plan.mjs and src/head-overlay.mjs.
//
// `--head-skills` NEVER RECORDS. Staging a pull request's head SKILL.md text
// as prompt content is safe only because the model that reads it can then do
// nothing filesystem-shaped — see src/head-overlay.mjs's header. Combining it
// with `--out` would be a request to persist that run as a case measurement,
// which is a different claim than "route on this text once and report it",
// so evaluate.mjs refuses the combination outright rather than writing one.
//
// `--prompt` NEVER RECORDS EITHER, for a related but distinct reason. It
// replaces the resolved case's prompt and nothing else — mock, patch, tiers,
// repeats and corpus stay the case's own, so the prompt is the only variable
// — and a run whose prompt is not the one the fixture declares would, if
// `--out` were honoured, put a false prompt into the comparability key of
// every future comparison (`predecessorMismatches` in src/summary.mjs
// compares `case.prompt`). So `--prompt` refuses `--out` outright, the same
// way and for the same shape of reason `--head-skills` does. It also refuses
// `--head-skills`: a prompt override stays situated and takes text from a
// maintainer (`workflow_dispatch` requires repository write access), while
// `--head-skills` forces bare and takes text from a pull request's head —
// two different threat models and two different workspaces that must not
// meet in one run. See docs/operations/evaluation-dispatch.md for the use
// rule a prompt override is bound by and the comparability cost that makes
// it rare.
//
// exit codes:
//   0  a probe record was written (or --dry-run wrote one with no spawn), or
//      a whole-fixture --dry-run preview printed with no --case given
//   2  bad invocation, a missing workspace input, or the `claude` CLI not on
//      PATH
//   3  a transcript held a credential this tool could not account for and was
//      not written
//   4  admission refused the run before any probe was spawned

import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { redactTranscript } from "../lib/credentials.mjs";
import { materialize } from "../lib/mock-workspace.mjs";
import { admitCase } from "./src/admission.mjs";
import { UNRECOGNISED, corpusInvocability, descriptionDigests, treeDigest } from "./src/fingerprint.mjs";
import {
  allowOverlayContent,
  assertRealDirectory,
  planOverlay,
  resolveInside,
} from "./src/head-overlay.mjs";
import {
  canonicalJson,
  DATA_ROOT,
  FIXTURE_FILE,
  newId,
  probeName,
  probePaths,
  SUMMARY_FILE,
} from "./src/layout.mjs";
import { MODES, planFor, PROVISIONAL_SITUATED_TURN_CAP } from "./src/plan.mjs";
import { extractSignals } from "./src/signals.mjs";
import { buildConfiguration, runProbe, shellQuote } from "./src/spawn.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const INSTALLED_SKILLS_ROOT = join(REPO_ROOT, ".claude", "skills");

const USAGE = `Usage: evaluate.mjs --case <id> [options]
       evaluate.mjs --dry-run                (preview every case in the fixture)

Resolve one case, materialize its probe workspace (situated: a mock, every
library skill installed; bare: a scratch directory holding .claude/skills
only), run its repeats serially, and write one probe record per repeat —
metadata.json (declared) and transcript.jsonl (measured) — under a fresh
probe-<id> directory inside --out.

  --case <id>           the fixture case to run. required, unless --dry-run is
                         given with no --case, which previews every case
  --out <dir>            the case measurement directory to write probe
                         directories into. required unless --head-skills is
                         given — see --head-skills below
  --fixture <path>       the case fixture to read
                         (default: ${join(DATA_ROOT, FIXTURE_FILE)})
  --repeats <n>          override the case's declared repeat count
  --turn-cap <n>         override the provisional situated turn cap
                         (default: ${PROVISIONAL_SITUATED_TURN_CAP} — see src/plan.mjs)
  --probe-id <hex>       a probe directory's id, for a reproducible tree;
                         repeatable, one per repeat in order. a repeat beyond
                         the ids given gets a random one
  --run-url <url>        the dispatch that produced these probes, recorded as
                         provenance
  --runtime-version <v>  the CLI version these probes run against
                         (default: $CLAUDE_CODE_VERSION, or the version the
                         transcript reports, or null)
  --head-skills <dir>    stage head SKILL.md files from this directory —
                         .agents/skills/<name>/SKILL.md paths only, everything
                         else refused (see src/head-overlay.mjs). Forces bare
                         mode. Refuses --out: a head run reports, it never
                         records
  --head-sha <sha>       record the evaluated head commit in a head run's report
  --prompt <text>        replace the resolved case's prompt with this text;
                         everything else — mock, patch, tiers, repeats,
                         corpus — stays the case's own, so the prompt is the
                         only variable. Stays situated or bare exactly as the
                         case declares. Refuses --out and --head-skills: a
                         prompt override reports, it never records. See this
                         file's header and docs/operations/evaluation-dispatch.md
                         for the use rule
  --dry-run              fingerprint the workspace and write each probe record
                         with a synthetic transcript; spawn nothing. Marked
                         \`trigger.kind: "dry-run"\` so it cannot be mistaken
                         for a measurement
  --help                 this text

Exit codes: 0 written (or previewed), 2 bad invocation, 3 the transcript held
a credential this tool could not account for, 4 admission refused the run.`;

function fail(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
const fail2 = (message) => fail(2, message);

function parseArgv(argv) {
  const options = {
    caseId: null,
    out: null,
    fixture: join(DATA_ROOT, FIXTURE_FILE),
    repeats: null,
    turnCap: PROVISIONAL_SITUATED_TURN_CAP,
    probeIds: [],
    runUrl: null,
    runtimeVersion: process.env.CLAUDE_CODE_VERSION ?? null,
    headSkills: null,
    headSha: null,
    prompt: null,
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
    if (arg === "--case") options.caseId = next();
    else if (arg === "--out") options.out = next();
    else if (arg === "--fixture") options.fixture = next();
    else if (arg === "--repeats") {
      const value = Number(next());
      if (!Number.isInteger(value) || value < 1) fail2("--repeats needs a positive integer.");
      options.repeats = value;
    } else if (arg === "--turn-cap") {
      const value = Number(next());
      if (!Number.isInteger(value) || value < 1) fail2("--turn-cap needs a positive integer.");
      options.turnCap = value;
    } else if (arg === "--probe-id") options.probeIds.push(next());
    else if (arg === "--run-url") options.runUrl = next();
    else if (arg === "--runtime-version") options.runtimeVersion = next();
    else if (arg === "--head-skills") options.headSkills = resolve(next());
    else if (arg === "--head-sha") options.headSha = next();
    else if (arg === "--prompt") options.prompt = next();
    else if (arg === "--dry-run") options.dryRun = true;
    else fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
  }
  return options;
}

async function readFixture(fixturePath) {
  let raw;
  try {
    raw = await readFile(fixturePath, "utf8");
  } catch (error) {
    fail2(`Could not read the case fixture at ${fixturePath}: ${error.message}`);
  }
  let fixture;
  try {
    fixture = JSON.parse(raw);
  } catch (error) {
    fail2(`${fixturePath} is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(fixture.cases) || fixture.cases.length === 0) {
    fail2(`${fixturePath} declares no "cases".`);
  }
  if (!(fixture.capUsd > 0)) fail2(`${fixturePath} declares no positive "capUsd".`);
  for (const mode of MODES) {
    if (!(fixture.unmeasuredProbeCostCeilingUsd?.[mode] > 0)) {
      fail2(`${fixturePath} declares no positive "unmeasuredProbeCostCeilingUsd.${mode}".`);
    }
  }
  return fixture;
}

function findCase(fixture, caseId, fixturePath) {
  const declared = fixture.cases.find((entry) => entry.id === caseId);
  if (!declared) {
    const known = fixture.cases.map((entry) => entry.id).join(", ") || "(none)";
    fail2(`${fixturePath} declares no case ${JSON.stringify(caseId)}. Known cases: ${known}`);
  }
  return declared;
}

/**
 * every past probe cost of `caseId` measured IN `mode`, one figure per
 * committed measurement. A measurement recorded in the other mode is not
 * comparable and must not supersede this mode's ceiling — see
 * src/admission.mjs's header.
 */
async function historicalCostsFor(caseId, mode, rootSummaryPath) {
  let raw;
  try {
    raw = await readFile(rootSummaryPath, "utf8");
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

/**
 * the whole library corpus: every skill this repository's own `.claude/skills`
 * installs.
 *
 * a run reads every skill's frontmatter to build `invocability`, which makes it
 * the one moment a malformed `user-invocable` is in hand, so it is named on
 * stderr rather than left to be inferred from a downstream contamination
 * classification. REVIEW.md keeps that field fully in a reviewer's scope
 * precisely because nothing in CI checks it — this is a report, not a gate, and
 * it does not refuse the run.
 */
async function corpus() {
  const skills = await descriptionDigests(INSTALLED_SKILLS_ROOT);
  const invocability = await corpusInvocability(INSTALLED_SKILLS_ROOT);
  const unrecognised = Object.keys(invocability)
    .filter((name) => invocability[name] === UNRECOGNISED)
    .sort();
  if (unrecognised.length > 0) {
    process.stderr.write(
      `Unreadable user-invocable in ${unrecognised.length} skill(s): ${unrecognised.join(", ")}. ` +
        "isolation.mjs counts these as colliding rather than as ours, so a probe that loads one " +
        "reports contamination.\n",
    );
  }
  return { skills, invocability, names: Object.keys(skills) };
}

/** a scratch workspace holding `.claude/skills` and nothing else. */
async function buildBareWorkspace(skillNames) {
  const dir = await mkdtemp(join(tmpdir(), "discovery-eval-"));
  const skillsRoot = join(dir, ".claude", "skills");
  await mkdir(skillsRoot, { recursive: true });
  for (const name of skillNames) {
    // dereference: true is load-bearing — .claude/skills is a tree of
    // symlinks, and copying targets means the workspace holds only real
    // files, so a later write (a head overlay) can never land through a link
    // back into this repository's own installed skill. see
    // tools/lib/mock-workspace.mjs's header for the same hazard and fix.
    await cp(join(INSTALLED_SKILLS_ROOT, name), join(skillsRoot, name), {
      recursive: true,
      dereference: true,
    });
  }
  return dir;
}

/**
 * overlay allowed head SKILL.md files onto a workspace's `.claude/skills`.
 *
 * @returns {Promise<string[]>} the skills actually overlaid
 */
async function overlayHeadSkills(skillsRoot, headSkillsDir) {
  const changed = (await readdir(headSkillsDir, { recursive: true }))
    .map((entry) => entry.split(sep).join("/"))
    .filter((entry) => entry.endsWith("SKILL.md"));
  const { allowed, rejected } = planOverlay(changed);
  for (const { path, reason } of rejected) {
    process.stderr.write(`overlay refused ${JSON.stringify(path)}: ${reason}\n`);
  }

  const overlaid = [];
  for (const { path, skill } of allowed) {
    const text = await readFile(join(headSkillsDir, path), "utf8");
    const content = allowOverlayContent(text);
    if (!content.allowed) {
      process.stderr.write(`overlay refused ${JSON.stringify(path)}: ${content.reason}\n`);
      continue;
    }
    // destination derived from the diff path, never from a `name:` field
    // inside the head file — see head-overlay.mjs.
    const destination = resolveInside(skillsRoot, join(skill, "SKILL.md"));
    await mkdir(dirname(destination), { recursive: true });
    await assertRealDirectory(dirname(destination));
    await rm(destination, { force: true });
    await writeFile(destination, text, "utf8");
    overlaid.push(skill);
  }
  return overlaid;
}

async function wholeFixtureDryRun(fixture, fixturePath, options) {
  const rootSummaryPath = join(dirname(fixturePath), SUMMARY_FILE);
  let totalProbes = 0;
  let totalProjectedUsd = 0;
  const lines = [`Fixture OK: ${fixture.cases.length} case(s).`];

  for (const testCase of fixture.cases) {
    const plan = planFor(testCase, { headSkills: false, turnCap: options.turnCap });
    const repeats = options.repeats ?? testCase.repeats ?? 1;
    const historicalCosts = await historicalCostsFor(testCase.id, plan.mode, rootSummaryPath);
    const admission = admitCase({
      caseId: testCase.id,
      probeCount: repeats,
      declaredCapUsd: fixture.capUsd,
      historicalCosts,
      mode: plan.mode,
      unmeasuredProbeCostCeilingUsd: fixture.unmeasuredProbeCostCeilingUsd,
    });
    totalProbes += repeats;
    totalProjectedUsd += admission.projectedTotalUsd;
    lines.push(
      `  ${testCase.id}: ${plan.mode}, ${repeats} repeat(s), tools=[${plan.tools.join(",")}], ` +
        `turns=${plan.turns} — ${admission.reason}`,
    );
  }

  lines.push(
    `Projected: ${totalProbes} probe(s), $${totalProjectedUsd.toFixed(2)} total against a ` +
      `$${fixture.capUsd.toFixed(2)} cap.`,
    "No process was spawned; no network was reached.",
    "",
  );
  process.stdout.write(lines.join("\n"));
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArgv(argv);

  // --head-skills never records: staging untrusted prompt content and then
  // persisting the run as a case measurement are two different claims, and
  // this is the refusal that keeps them apart — see this file's header.
  if (options.headSkills && options.out) {
    fail2(
      "--head-skills evaluates untrusted head text; it reports, it never records. Drop --out " +
        `to run it, or drop --head-skills to record an ordinary measurement.\n${USAGE}`,
    );
  }

  // --prompt never records either, and for a related reason — see this
  // file's header. Refusing the combination outright, rather than
  // documenting it as a caution, is what makes "an override run cannot reach
  // land" structural rather than conventional.
  if (options.prompt !== null && options.out) {
    fail2(
      "--prompt overrides a case's prompt, so the run's prompt is not the one the fixture " +
        "declares; persisting it as that case's measurement would put a false prompt into the " +
        "comparability key of every future comparison. Drop --out to run it, or drop --prompt " +
        `to record an ordinary measurement.\n${USAGE}`,
    );
  }

  // --prompt and --head-skills are two different threat models — a
  // maintainer's own text evaluated situated, and a pull request's head text
  // evaluated bare — and two different workspaces. They must not meet in one
  // run.
  if (options.prompt !== null && options.headSkills) {
    fail2(
      "--prompt takes text from a maintainer and stays situated; --head-skills takes text from a " +
        "pull request's head and forces bare. Two different threat models and two different " +
        `workspaces must not meet in one run. Drop one of them.\n${USAGE}`,
    );
  }

  const wholeFixturePreview = options.dryRun && !options.caseId && !options.headSkills && !options.prompt;
  if (!options.caseId && !wholeFixturePreview) {
    fail2(`--case is required, unless --dry-run is given with no --case.\n${USAGE}`);
  }
  if (wholeFixturePreview && options.out) {
    fail2(`--out names one case's directory; it needs --case.\n${USAGE}`);
  }
  if (options.caseId && !options.out && !options.headSkills && !options.prompt) {
    fail2(`--out is required, unless --head-skills or --prompt is given.\n${USAGE}`);
  }

  const fixturePath = resolve(options.fixture);
  const fixture = await readFixture(fixturePath);

  if (wholeFixturePreview) {
    await wholeFixtureDryRun(fixture, fixturePath, options);
    process.exit(0);
  }

  const declaredCase = findCase(fixture, options.caseId, fixturePath);
  // --prompt replaces the prompt and nothing else — mock, patch, tiers,
  // repeats and corpus all come from `declaredCase` untouched, because every
  // read below goes through this one `testCase`, never `declaredCase`
  // directly, so the prompt is the only variable that can differ from the
  // fixture's own declaration. planFor never sees headSkills for this mode
  // (only --head-skills sets that), so an overridden case stays situated or
  // bare exactly as declared — see this file's header.
  const testCase = options.prompt !== null ? { ...declaredCase, prompt: options.prompt } : declaredCase;
  const plan = planFor(testCase, { headSkills: Boolean(options.headSkills), turnCap: options.turnCap });
  const repeats = options.repeats ?? testCase.repeats ?? 1;

  const { skills: corpusSkills, invocability, names: skillNames } = await corpus();

  const rootSummaryPath = join(dirname(fixturePath), SUMMARY_FILE);
  const historicalCosts = await historicalCostsFor(testCase.id, plan.mode, rootSummaryPath);
  const admission = admitCase({
    caseId: testCase.id,
    probeCount: repeats,
    declaredCapUsd: fixture.capUsd,
    historicalCosts,
    mode: plan.mode,
    unmeasuredProbeCostCeilingUsd: fixture.unmeasuredProbeCostCeilingUsd,
  });
  process.stderr.write(`${admission.reason}\n`);
  if (!options.dryRun && !admission.admitted) {
    fail(4, `Admission refused ${testCase.id}: ${admission.reason}`);
  }

  const patchPath = testCase.patch ? resolve(dirname(fixturePath), testCase.patch) : null;

  const workspace =
    plan.mode === "situated"
      ? await materialize({ mock: plan.workspace.mock, skills: skillNames, install: false, patch: patchPath })
      : await buildBareWorkspace(skillNames);

  try {
    let overlaid = [];
    if (options.headSkills) {
      overlaid = await overlayHeadSkills(join(workspace, ".claude", "skills"), options.headSkills);
    }

    // before any spawn, which is the only moment it means what the model
    // first saw. taken afterwards it would digest edits a probe cannot make
    // anyway — Bash and every editing tool are always denied — but the
    // ordering is kept identical to the effect side's on principle.
    const projectTree = plan.mode === "situated" ? await treeDigest(workspace) : null;

    if (!options.dryRun) {
      process.stderr.write(
        `Materialized ${plan.mode} workspace for ${testCase.id}${
          overlaid.length > 0 ? ` (head overlay: ${overlaid.sort().join(", ")})` : ""
        }.\n`,
      );
    }

    // identical across every repeat of this case — only the transcript each
    // repeat produces differs — so it is built once rather than per repeat.
    const configuration = buildConfiguration({
      runtimeVersion: options.runtimeVersion,
      plan,
      projectTree,
      skills: corpusSkills,
      invocability,
      testCase,
    });

    if (options.prompt !== null) {
      // the case, the overridden prompt, and its declared tiers, named once
      // — every probe's own metadata.json.configuration.case carries the
      // same fields (below), but a reader watching the run live should not
      // have to wait for the first probe to see what this dispatch is
      // actually asking.
      process.stderr.write(
        `${testCase.id}: prompt overridden to ${JSON.stringify(options.prompt)}\n` +
          `  mustInclude=[${(testCase.mustInclude ?? []).join(", ")}] ` +
          `mustExclude=[${(testCase.mustExclude ?? []).join(", ")}] ` +
          `mayInclude=[${(testCase.mayInclude ?? []).join(", ")}]\n`,
      );
    }

    for (let repeat = 0; repeat < repeats; repeat += 1) {
      let rawStdout;
      let cliExitCode;
      let cliArgv;
      try {
        ({ rawStdout, cliExitCode, argv: cliArgv } = runProbe(configuration, {
          workspace,
          dryRun: options.dryRun,
        }));
      } catch (error) {
        if (error.code === "ENOENT") fail2(error.message);
        throw error;
      }

      if (options.dryRun) {
        process.stderr.write(
          `DRY RUN — nothing spawned. The command would have been:\n  claude ${cliArgv
            .map(shellQuote)
            .join(" ")}\n`,
        );
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
      if (redactedNames.length > 0) {
        process.stderr.write(`redacted from the transcript: ${redactedNames.join(", ")}\n`);
      }

      // built regardless of --out: an override run's report (below) embeds
      // this exact object, so a caller reconstructing metadata.json from that
      // report gets the same shape a measurement would have written to disk.
      const probeId = options.probeIds[repeat] ?? newId();
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

      if (options.prompt !== null) {
        // an override run never records — --out is refused outright (see
        // this file's header) — so stdout is the only channel left for the
        // metadata and transcript a caller needs to hold onto: this is the
        // only copy either will ever have. One JSON line per probe, deriving
        // the terminal reason and what it selected the same deterministic
        // way summarize.mjs eventually would, so a reader can tell hit from
        // miss without re-deriving it themselves.
        const signals = extractSignals(transcriptText);
        process.stdout.write(
          `${JSON.stringify({
            probeId,
            repeat: repeat + 1,
            of: repeats,
            terminalReason: signals.terminalReason,
            selectedSkills: signals.selectedSkills,
            metadata,
            transcript: transcriptText,
          })}\n`,
        );
        continue;
      }

      if (!options.out) {
        // a head run with no --out: report, never record.
        process.stdout.write(
          `${testCase.id} repeat ${repeat + 1}/${repeats}: ${plan.mode}, cliExitCode=${cliExitCode}\n`,
        );
        continue;
      }

      const directory = join(options.out, probeName(probeId));
      await mkdir(directory, { recursive: true });
      const paths = probePaths(directory);
      // the one file that cannot be re-acquired goes down first.
      await writeFile(paths.transcript, transcriptText, "utf8");
      await writeFile(paths.metadata, canonicalJson(metadata), "utf8");
      process.stdout.write(`${directory}\n`);
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }

  process.exit(0);
}

main();
