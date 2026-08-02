#!/usr/bin/env node
// Does a review contract actually catch what it was written for?
//
// This drives the REAL `claude` CLI over a recorded pull request and reports
// which of that change's known defects the review anchored a finding on. It is
// the outcome measurement REVIEW.md never had: #170 rewrote the review contract
// and could only hand-walk the result by eye, because the CI reviewer reads
// REVIEW.md from the base ref and so reviews a contract change under the
// previous contract.
//
// IT CANNOT GATE, for three independent reasons: it is non-deterministic, it
// costs real money per run, and it needs a secret that fork pull requests never
// receive. tests/repository/reporting-tools.test.mjs holds it out of the gate
// registry, every npm script, and every hook, so wiring it in has to be a
// deliberate act rather than an accident.
//
// EXIT 0 ON EVERY VALID INVOCATION, whatever the numbers. See report.mjs.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { estimateCost, loadFixture } from "./fixture.mjs";
import { renderReport } from "./report.mjs";
import { scoreCase } from "./score.mjs";
import { lensEnumeration, parseStream } from "./stream.mjs";
import { materialise, probePrompt } from "./workspace.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const FIXTURE = join(REPO_ROOT, "evals", "review", "fixture.json");
const ANCHOR_SERVER = join(HERE, "anchor-server.mjs");

// A review probe reads a whole diff across many turns, unlike a discovery
// probe's single turn. Calibrated against the first real run of the #166 case:
// four probes over a 58-file diff cost $18.81, or ~$4.70 each. The first
// estimate here was $0.75 and under-priced a run six-fold, which is the wrong
// direction to be wrong in for the number a maintainer reads before spending.
// Still an order of magnitude rather than a quote — cost scales with diff size,
// and a real run reports what it actually spent.
const ESTIMATED_USD_PER_PROBE = 4.7;
const MAX_TURNS = 60;

const HELP = `review-eval — does a review contract catch what it was written for?

Usage:
  node scripts/review-eval/run.mjs [options]

Options:
  --dry-run              Validate the fixture and print a cost estimate. Makes no
                         model call and needs no secret or CLI.
  --review-ref <ref>     Git ref to take REVIEW.md from. Repeatable: pass twice to
                         run both contracts and compare. Defaults to HEAD.
  --case <id>            Run only this case. Repeatable.
  --fixture <path>       Fixture file (default evals/review/fixture.json).
  --help                 Show this.

Reports, never gates: exits 0 on every valid invocation whatever it finds.
A target is reported reached or not reached — an existence claim, never a rate.
`;

function parseArgs(argv) {
  const options = { dryRun: false, reviewRefs: [], cases: [], fixture: FIXTURE, help: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--review-ref":
        options.reviewRefs.push(argv[++i]);
        break;
      case "--case":
        options.cases.push(argv[++i]);
        break;
      case "--fixture":
        options.fixture = argv[++i];
        break;
      default:
        throw new Error(`Unknown option: ${argv[i]}`);
    }
  }
  return options;
}

/** One probe: spawn the CLI over the case's diff and read back what it anchored. */
function probe({ workspace, anchorLog }) {
  const mcpConfig = join(workspace.dir, "mcp.json");
  writeFileSync(
    mcpConfig,
    JSON.stringify({ mcpServers: { inline: { command: "node", args: [ANCHOR_SERVER] } } }),
  );

  const result = spawnSync(
    "claude",
    [
      "-p",
      probePrompt(workspace),
      "--output-format",
      "stream-json",
      "--verbose",
      "--mcp-config",
      mcpConfig,
      // Without this the session's own GitHub MCP server stays reachable and a
      // probe can post a real comment on a real pull request.
      "--strict-mcp-config",
      "--allowedTools",
      "Read,Grep,Glob,mcp__inline__create_inline_comment",
      "--disallowedTools",
      "WebFetch,WebSearch,Task",
      "--permission-mode",
      "acceptEdits",
      "--max-turns",
      String(MAX_TURNS),
    ],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, REVIEW_EVAL_ANCHOR_LOG: anchorLog },
    },
  );

  if (result.error?.code === "ENOENT") {
    throw new Error(
      "The `claude` CLI is not on PATH. This evaluation drives the real CLI; install it or run with --dry-run.",
    );
  }

  // A non-zero status is not failure: the CLI exits non-zero when it hits the
  // turn cap, and a probe that reviewed and then ran out of turns still produced
  // every anchor it emitted.
  const parsed = parseStream(result.stdout ?? "");
  return { ...parsed, lens: lensEnumeration(parsed.summary) };
}

function runArm({ fixture, cases, reviewRef }) {
  const results = [];
  const errors = [];
  let cost = 0;
  let model = null;

  for (const testCase of fixture.cases) {
    if (cases.length > 0 && !cases.includes(testCase.id)) continue;

    let workspace;
    try {
      workspace = materialise({ repoRoot: REPO_ROOT, testCase, reviewRef });
    } catch (error) {
      errors.push(`${testCase.id} @ ${reviewRef ?? "HEAD"}: ${error.message}`);
      continue;
    }

    const probes = [];
    for (let i = 0; i < testCase.repeats; i++) {
      const anchorLog = join(workspace.dir, `anchors-${i}.jsonl`);
      writeFileSync(anchorLog, "");
      try {
        const outcome = probe({ workspace, anchorLog });
        cost += outcome.cost;
        model ??= outcome.model;
        probes.push(outcome);
      } catch (error) {
        // One failed probe degrades to a recorded error rather than aborting the
        // run, so an expensive multi-case run is not lost to a single hiccup.
        errors.push(`${testCase.id} probe ${i + 1} @ ${reviewRef ?? "HEAD"}: ${error.message}`);
      }
    }

    rmSync(workspace.dir, { recursive: true, force: true });
    if (probes.length > 0) results.push(scoreCase(testCase, probes));
  }

  return { contract: reviewRef ?? "HEAD (working tree)", results, errors, cost, model };
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${HELP}`);
    process.exit(2);
  }

  if (options.help) {
    process.stdout.write(HELP);
    return;
  }

  let fixture;
  try {
    fixture = loadFixture(options.fixture);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }

  const selected = {
    ...fixture,
    cases: fixture.cases.filter((c) => options.cases.length === 0 || options.cases.includes(c.id)),
  };
  if (selected.cases.length === 0) {
    process.stderr.write(`No case matched ${options.cases.join(", ")}\n`);
    process.exit(2);
  }

  const arms = options.reviewRefs.length > 0 ? options.reviewRefs : [null];

  if (options.dryRun) {
    const { probes, usd } = estimateCost(selected, ESTIMATED_USD_PER_PROBE, arms.length);
    process.stdout.write(
      [
        `Fixture valid: ${selected.cases.length} case(s), ${arms.length} contract arm(s).`,
        "",
        ...selected.cases.map(
          (c) =>
            `  ${c.id}: ${c.repeats} repeat(s), ${c.mustAnchor.length} target(s)` +
            `${c.mustNotAnchor?.length ? `, ${c.mustNotAnchor.length} false-positive guard(s)` : ""}`,
        ),
        "",
        `Would run ${probes} probe(s) at roughly ${ESTIMATED_USD_PER_PROBE.toFixed(2)} USD each.`,
        `Rough total: $${usd.toFixed(2)} — an order-of-magnitude estimate, not a quote.`,
        "",
        "No model was called and no secret was read.",
        "",
      ].join("\n"),
    );
    return;
  }

  const completed = arms.map((reviewRef) =>
    runArm({ fixture: selected, cases: options.cases, reviewRef }),
  );
  process.stdout.write(
    `${renderReport({
      arms: completed,
      errors: completed.flatMap((arm) => arm.errors),
    })}\n`,
  );
}

main();
