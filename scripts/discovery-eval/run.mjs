#!/usr/bin/env node
// run.mjs — skill discovery evaluation for THIS repository.
//
// Answers the one question every other check here cannot: when a prompt arrives,
// does discovery surface the RIGHT skills? Every mechanical check in this
// repository measures form — frontmatter shape, bullet syntax, link integrity,
// section anatomy. REVIEW.md floors a stale description/when_to_use at Major and
// discovery-breaking frontmatter at Critical, yet nothing tests whether the
// discovery text actually routes.
//
// WHAT IS MEASURED. The real Claude Code CLI, against a scratch workspace, one
// turn per run, with only the `Skill` tool available. That is the genuine
// discovery surface: the same skill listing Claude Code injects into the system
// prompt and the same tool the model invokes. A cheaper proxy — handing a model
// the 19 description strings and asking which apply — measures a DIFFERENT
// selection mechanism, and this repository has spent five units learning to tell
// a proxy from the real thing.
//
// THE WORKSPACE CARRIES NO CLAUDE.md, AND THAT IS LOAD-BEARING. This
// repository's own CLAUDE.md mandates professional-behavior,
// software-development and loop-engineering in EVERY session. Running the
// evaluation inside this checkout would measure that working agreement rather
// than discovery, and would do so silently — every case would "pass" for the
// wrong reason.
//
// EXIT 1 FROM THE CLI IS NORMAL. With `--max-turns 1` the CLI terminates with
// `result.subtype: error_max_turns` and a non-zero status. That is the expected
// terminal state of a one-turn probe, not a failure, and the runner treats it as
// such.
//
// THIS NEVER GATES. It is non-deterministic, it costs money per run, and it
// needs a secret that fork pull requests do not receive. A flaky merge gate gets
// bypassed or deleted; this exits 0 whatever it finds, and its output is a
// finding for a human. tests/repository/reporting-tools.test.mjs keeps it out of
// the enforced set on purpose, so wiring it in has to be a deliberate act.
//
// It lives at the repository root rather than inside a skill for the same reason
// report-obligation-load.mjs does: it reports on a tree rather than validating
// one, and every script bundled in a skill is named in that skill's prose, so
// adding one there would be an authoring change — which this is not.
//
// Usage:
//   node scripts/discovery-eval/run.mjs [options]
//
// Exit codes:
//   0  a report was produced — ALWAYS, whatever it found
//   2  bad invocation: an unknown flag, an unparseable fixture, a missing CLI

import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { deltaAgainst, tallyAll, trackedSkills } from "./compare.mjs";
import { compareCorpus, corpusDigest } from "./corpus.mjs";
import {
  DEFAULT_DETERMINISM_REPEATS,
  MIN_DETERMINISM_REPEATS,
  renderDeterminism,
} from "./determinism.mjs";
import { parseBaseline, parseFixture, ValidationError } from "./fixture.mjs";
import {
  allowOverlayContent,
  assertRealDirectory,
  evalEnvironment,
  planOverlay,
  resolveInside,
} from "./overlay.mjs";
import {
  BASELINE_MARKER,
  renderBaseline,
  renderCorpusBuckets,
  renderProbeBudget,
  renderReport,
} from "./report.mjs";
import { parseStream } from "./stream.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const INSTALLED_ROOT = join(REPO_ROOT, ".claude", "skills");
/** The same path as the reader knows it — absolute paths never enter output. */
const INSTALLED_DISPLAY = ".claude/skills";
const DEFAULT_FIXTURE = join(REPO_ROOT, "evals", "discovery", "fixture.json");
const DEFAULT_BASELINE = join(REPO_ROOT, "evals", "discovery", "baseline.json");

/** Repeats per case. Enough to see a split distribution, cheap enough to run. */
const DEFAULT_REPEATS = 5;

/**
 * Dollars per one-turn probe, measured over a 100-probe run against the
 * 19-skill corpus of the time. The rate is the figure that survives a fixture
 * change; a full-run total is always derived from it, so a printed estimate
 * cannot drift out of step with the probe count beside it. A short run costs
 * MORE per probe — the ~4,500-token discovery listing is identical every time,
 * so prompt caching amortizes it only once a run is long enough to reuse it.
 */
const PROBE_COST_USD = 0.026;

/**
 * Every tool except `Skill` is denied. The measurement is which skill discovery
 * selects; a run that starts doing the work is noise, and a run that can reach
 * the filesystem or the network is a liability given it may be holding
 * attacker-authored skill text from a pull request head.
 */
const DISALLOWED_TOOLS = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "Task",
  "Agent",
  "NotebookEdit",
  "TodoWrite",
].join(",");

const USAGE = `Usage: run.mjs [options]

Run this repository's prompt fixture through real Claude Code skill discovery
and report which expected skills were missed and which unexpected ones fired.

  --repeats <n>        runs per case (default ${DEFAULT_REPEATS})
  --only <case-id>     evaluate one case; repeatable
  --fixture <path>     fixture JSON (default evals/discovery/fixture.json)
  --baseline <path>    baseline JSON (default evals/discovery/baseline.json)
  --head-skills <dir>  overlay head SKILL.md files from this directory
  --head-sha <sha>     record the evaluated head commit in the report
  --dry-run            validate the fixture and print the plan; no model call
  --emit-baseline      also print a baseline document for a human to commit
  --determinism        repeat ONE case (--only) and report its stability instead
                       of the usual report; ${DEFAULT_DETERMINISM_REPEATS} repeats by default, ${MIN_DETERMINISM_REPEATS} minimum
  --help               this text

Exit codes: 0 a report was produced (always), 2 bad invocation.
This reports; it never gates.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The corpus comparison as `--dry-run` prints it: compact, and silent when the
 * corpus matches, exactly as the report's own notice is.
 *
 * Dry-run builds no workspace, so this reads the installed root — which is what
 * a real run's workspace is copied from, and differs from it only when a head
 * overlay is applied. The line says which root it read so that distinction is
 * never guessed at.
 */
function dryRunCorpusLines(baseline, installedCorpus) {
  const corpus = compareCorpus(baseline.corpus, installedCorpus);
  if (!corpus.recorded) {
    return [
      "Corpus not recorded in the baseline, so drift cannot be ruled out.",
    ];
  }
  if (!corpus.drifted) return [];
  return [
    `Corpus drift against the baseline, over ${INSTALLED_DISPLAY}:`,
    ...renderCorpusBuckets(corpus),
  ];
}

/**
 * Build the scratch workspace: the whole corpus, and deliberately nothing else.
 *
 * The whole corpus is installed even when the fixture labels only three skills.
 * Bounding the WORKSPACE to the pilot would make a spurious trigger from any
 * other skill structurally invisible, which is the opposite of what the fixture
 * is for.
 *
 * @returns {Promise<{ dir: string, corpusSize: number, overlaid: string[], corpus: Record<string, string> }>}
 */
async function buildWorkspace(headSkillsDir) {
  const dir = await mkdtemp(join(tmpdir(), "discovery-eval-"));
  const skillRoot = join(dir, ".claude", "skills");
  // `dereference` is load-bearing, not a detail. The skills CLI installs either
  // real directories (--copy) or SYMLINKS back into the source tree, and a
  // symlinked skill directory in the workspace would make the head overlay
  // below write straight THROUGH it into the working tree — path containment
  // alone cannot catch that, because resolve() does not follow links. Copying
  // targets means the workspace holds only real files.
  await cp(INSTALLED_ROOT, skillRoot, { recursive: true, dereference: true });

  // No CLAUDE.md is written. See this file's header — that omission is the
  // difference between measuring discovery and measuring this repository's
  // working agreement.

  const overlaid = [];
  if (headSkillsDir) {
    // The workflow stages head files under repository-relative paths, so what
    // is read here is the same string the allowlist judges — no reconstruction,
    // and nothing derived from the head file's own contents.
    const changed = await readdir(headSkillsDir, { recursive: true });
    const paths = changed
      .map((entry) => entry.split(sep).join("/"))
      .filter((entry) => entry.endsWith("SKILL.md"));
    const { allowed, rejected } = planOverlay(paths);
    for (const { path, reason } of rejected) {
      process.stderr.write(`overlay refused ${JSON.stringify(path)}: ${reason}\n`);
    }
    for (const { path, skill } of allowed) {
      const source = join(headSkillsDir, path);
      const text = await readFile(source, "utf8");

      // The path allowlist bounds what a hostile skill can do; this bounds what
      // it can cost, since overlaid discovery text is re-sent with every probe.
      const content = allowOverlayContent(text);
      if (!content.allowed) {
        process.stderr.write(
          `overlay refused ${JSON.stringify(path)}: ${content.reason}\n`,
        );
        continue;
      }

      // Destination derived from the DIFF PATH, never from any `name:` field
      // inside the head file, and re-checked for containment before the write.
      const destination = resolveInside(skillRoot, join(skill, "SKILL.md"));
      // A pull request that ADDS a skill has no directory here yet. The name
      // is allowlist-validated kebab-case and the path is already confirmed
      // inside the workspace, so creating it is safe.
      await mkdir(dirname(destination), { recursive: true });
      await assertRealDirectory(dirname(destination));
      await rm(destination, { force: true });
      await writeFile(destination, text, "utf8");
      overlaid.push(skill);
    }
  }

  // Digested from the ASSEMBLED workspace, not from the installed root, so a
  // run with a head overlay fingerprints the text it actually measured. With no
  // overlay the two are identical, which is the ordinary case.
  const corpus = await corpusDigest(skillRoot);
  return { dir, corpusSize: Object.keys(corpus).length, overlaid, corpus };
}

/** One probe: spawn the CLI in the workspace and read back what it selected. */
function probe(prompt, workspace) {
  const result = spawnSync(
    "claude",
    [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--max-turns",
      "1",
      "--allowedTools",
      "Skill",
      "--disallowedTools",
      DISALLOWED_TOOLS,
    ],
    {
      cwd: workspace,
      encoding: "utf8",
      env: evalEnvironment(process.env),
      maxBuffer: 32 * 1024 * 1024,
    },
  );

  if (result.error) {
    if (result.error.code === "ENOENT") {
      fail2(
        "The `claude` CLI is not on PATH. This evaluation drives the real CLI; install it or run with --dry-run.",
      );
    }
    throw result.error;
  }
  // A non-zero status is EXPECTED here: --max-turns 1 ends in error_max_turns.
  // The stream is what matters, and it is complete either way.
  return parseStream(result.stdout);
}

function parseArguments(argv) {
  const options = {
    repeats: DEFAULT_REPEATS,
    repeatsExplicit: false,
    only: [],
    fixture: DEFAULT_FIXTURE,
    baseline: DEFAULT_BASELINE,
    headSkills: null,
    headSha: null,
    dryRun: false,
    emitBaseline: false,
    determinism: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        fail2(`Option "${argument}" needs a value.\n${USAGE}`);
      }
      index += 1;
      return value;
    };

    switch (argument) {
      case "--repeats": {
        const value = Number(next());
        if (!Number.isInteger(value) || value < 1) {
          fail2("--repeats needs a positive integer.");
        }
        options.repeats = value;
        // Passing the flag is a deliberate "use THIS many", so it wins over
        // every per-case declaration. That is what keeps `--only <case>
        // --repeats 10` doing the obvious thing while iterating on one case.
        options.repeatsExplicit = true;
        break;
      }
      case "--only":
        options.only.push(next());
        break;
      case "--fixture":
        options.fixture = resolve(next());
        break;
      case "--baseline":
        options.baseline = resolve(next());
        break;
      case "--head-skills":
        options.headSkills = resolve(next());
        break;
      case "--head-sha":
        options.headSha = next();
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--emit-baseline":
        options.emitBaseline = true;
        break;
      case "--determinism":
        options.determinism = true;
        break;
      default:
        fail2(`Unknown option "${argument}".\n${USAGE}`);
    }
  }
  return options;
}

/**
 * The determinism mode's own invocation rules, refused before anything is read.
 *
 * Checked here rather than after the fixture loads because none of them depend
 * on it: the mode's repeat count deliberately ignores per-case declarations, so
 * every one of these is knowable from the argument list alone — and a refusal
 * that costs nothing is a refusal that can be made freely.
 *
 * @param {object} options
 * @returns {number} the effective repeat count
 */
function determinismRepeats(options) {
  if (options.only.length !== 1) {
    fail2(
      `--determinism measures ONE case repeated against an unchanged corpus, so it needs exactly one --only; ${
        options.only.length === 0 ? "none was given" : `${options.only.length} were given`
      }. Its whole subject is how a single case behaves under repetition, and a run spanning several cases would confound that with the difference between them.`,
    );
  }
  if (options.emitBaseline) {
    fail2(
      "--determinism cannot be combined with --emit-baseline. A baseline is a fixture-wide document, and a single case's probe run cannot produce one; emitting a partial document that looks committable is the failure this refuses.",
    );
  }

  // An explicit --repeats still wins, as it does everywhere else — but the
  // floor is checked against the EFFECTIVE count, so `--repeats 9` is refused
  // whether or not the case declares something smaller.
  const repeats = options.repeatsExplicit ? options.repeats : DEFAULT_DETERMINISM_REPEATS;
  if (repeats < MIN_DETERMINISM_REPEATS) {
    fail2(
      `--determinism needs at least ${MIN_DETERMINISM_REPEATS} repeats to say anything; ${repeats} was requested. Below that the runs test has no power and the interval spans most of the unit line, so the run would spend money to produce a result no reader could act on.`,
    );
  }
  return repeats;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArguments(argv);
  const determinismCount = options.determinism ? determinismRepeats(options) : null;
  // One enumeration of the installed root: its keys are the known skill names
  // the fixture and baseline are validated against, and its values are the
  // digests --dry-run compares.
  const installedCorpus = await corpusDigest(INSTALLED_ROOT);
  const knownSkills = Object.keys(installedCorpus);

  let fixture;
  try {
    fixture = parseFixture(await readFile(options.fixture, "utf8"), { knownSkills });
  } catch (error) {
    if (error instanceof ValidationError) {
      fail2(`${basename(options.fixture)} is not valid:\n  ${error.problems.join("\n  ")}`);
    }
    fail2(`Cannot read ${options.fixture}: ${error.message}`);
  }

  let baseline = null;
  try {
    baseline = parseBaseline(await readFile(options.baseline, "utf8"), { knownSkills });
  } catch (error) {
    if (error instanceof ValidationError) {
      fail2(`${basename(options.baseline)} is not valid:\n  ${error.problems.join("\n  ")}`);
    }
    // A missing baseline is ordinary on a first run; the report says so.
  }

  if (options.only.length > 0) {
    const unknown = options.only.filter(
      (id) => !fixture.cases.some((entry) => entry.id === id),
    );
    if (unknown.length > 0) fail2(`No such case: ${unknown.join(", ")}.`);
    fixture = {
      ...fixture,
      cases: fixture.cases.filter((entry) => options.only.includes(entry.id)),
    };
  }

  // One rule, used by the dry run and the real run alike, so the estimate can
  // never describe a plan the run does not follow. In determinism mode the
  // count is fixed for the run — the per-case declaration is deliberately
  // overridden, since a case that earns 2 repeats for a settled verdict is
  // exactly the kind whose stability is worth measuring.
  const repeatsFor = (testCase) =>
    determinismCount ??
    (options.repeatsExplicit ? options.repeats : (testCase.repeats ?? options.repeats));
  const totalProbes = fixture.cases.reduce(
    (sum, testCase) => sum + repeatsFor(testCase),
    0,
  );
  const reduced = fixture.cases.filter(
    (testCase) => repeatsFor(testCase) !== options.repeats,
  );
  const repeatsNote =
    reduced.length > 0 ? `${reduced.length} case(s) declare fewer` : null;

  if (options.dryRun && determinismCount) {
    process.stdout.write(
      [
        `Determinism probe: ${fixture.cases[0].id}, ${determinismCount} sequential repeat(s) against one unchanged workspace.`,
        `Corpus: ${knownSkills.length} skill(s) would be installed into the workspace.`,
        renderProbeBudget(determinismCount, PROBE_COST_USD, "this one case"),
        "No model call was made.",
        "",
      ].join("\n"),
    );
    process.exit(0);
  }

  if (options.dryRun) {
    const runs = totalProbes;
    process.stdout.write(
      [
        `Fixture OK: ${fixture.cases.length} case(s), ${options.repeats} repeat(s) each${repeatsNote ? ` except ${reduced.length} that declare their own` : ""}.`,
        `Corpus: ${knownSkills.length} skill(s) would be installed into the workspace.`,
        baseline
          ? `Baseline OK: recorded on "${baseline.model}" at ${baseline.repeats} repeat(s).`
          : "No baseline recorded yet.",
        ...(baseline ? dryRunCorpusLines(baseline, installedCorpus) : []),
        renderProbeBudget(runs, PROBE_COST_USD),
        "No model call was made.",
        "",
      ].join("\n"),
    );
    process.exit(0);
  }

  if (options.headSkills && !(await isDir(options.headSkills))) {
    fail2(`--head-skills directory does not exist: ${options.headSkills}`);
  }

  const {
    dir: workspace,
    corpusSize,
    overlaid,
    corpus,
  } = await buildWorkspace(options.headSkills);

  const runsByCase = new Map();
  let model = null;
  let cost = 0;
  try {
    for (const testCase of fixture.cases) {
      const runs = [];
      const repeats = repeatsFor(testCase);
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        const result = probe(testCase.prompt, workspace);
        runs.push(result.skills);
        model ??= result.model;
        cost += result.cost;
      }
      runsByCase.set(testCase.id, runs);
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }

  const observedModel = model ?? "unknown";

  // A DISTINCT RENDER, not a variant of the report. It shares the workspace
  // builder, the probe function, the corpus digest and the cost accounting —
  // but it answers a different question, has no verdicts and no baseline to
  // compare against, so folding it into renderReport would mean threading a
  // mode flag through every block of a report that no longer applies.
  if (determinismCount) {
    const [testCase] = fixture.cases;
    process.stdout.write(
      renderDeterminism({
        testCase,
        runs: runsByCase.get(testCase.id) ?? [],
        tracked: trackedSkills(testCase, fixture.expectAlways ?? []),
        context: { model: observedModel, corpusSize },
      }),
    );
    process.stderr.write(`Approximate cost of this run: $${cost.toFixed(2)}\n`);
    process.exit(0);
  }

  const tallies = tallyAll(fixture, runsByCase);
  const delta = deltaAgainst(tallies, baseline, observedModel, corpus);

  process.stdout.write(
    renderReport({
      fixture,
      tallies,
      delta,
      context: {
        model: observedModel,
        repeats: options.repeats,
        repeatsNote,
        corpusSize,
        headSha: options.headSha,
        workspaceNote:
          overlaid.length > 0
            ? `${overlaid.length} skill(s) overlaid from the head: ${overlaid.sort().join(", ")}`
            : null,
      },
    }),
  );
  process.stderr.write(`Approximate cost of this run: $${cost.toFixed(2)}\n`);

  if (options.emitBaseline) {
    process.stdout.write(
      `\n${BASELINE_MARKER}\n${renderBaseline(tallies, {
        model: observedModel,
        repeats: options.repeats,
        corpus,
        // Supplied rather than stamped inside the renderer so the pure module
        // stays deterministic and testable. Truncated to whole seconds: a run
        // takes minutes, so milliseconds would claim a precision the
        // measurement does not have.
        recordedAt: `${new Date().toISOString().slice(0, 19)}Z`,
      })}`,
    );
  }

  // Always 0: this reports, it never judges. See the header's no-gate note.
  process.exit(0);
}

main();
