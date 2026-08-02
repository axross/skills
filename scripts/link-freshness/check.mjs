#!/usr/bin/env node
// check.mjs — external documentation-link freshness audit for THIS repository.
//
// Answers a question no offline check can: do the URLs this tree cites still
// resolve? check-links.mjs resolves RELATIVE `.md` links against the file system
// and ignores `http(s)://` targets entirely, so until now nothing here looked at
// an external link at all.
//
// WHY IT EXISTS NOW. The skills that mirror a vendor's API are being moved off
// reproduced option tables and onto a link plus the non-obvious caveat (#179).
// That trades a table which goes stale VISIBLY — a wrong default a reader can
// catch — for a link that rots SILENTLY. This audit is the other half of that
// trade, and without it the trade is not safe to make.
//
// ── IT REACHES THE NETWORK, SO IT IS NOT A GATE AND NOT A TEST.
// It runs from one scheduled workflow (.github/workflows/link-freshness.yaml) on
// the default branch and nowhere else. It is in no npm script, no merge gate,
// and no hook, and tests/repository/scheduled-audit-tools.test.mjs asserts every
// one of those — so wiring it into `npm run check` has to break a test first.
// That matters more than tidiness: `npm test` must stay offline and
// deterministic, and a network call inside it would make the merge gate depend
// on whether a publisher's CDN is up.
//
// ── WHY IT IS NOT PULL-REQUEST TRIGGERED. #171 specifies this and the reason is
// load-bearing: the reviewer workflow denies `WebFetch,WebSearch,Task` against
// an untrusted pull request head, and a fetching job triggered by a pull request
// would hand that capability back on head-controlled content. A `SKILL.md` in a
// fork's branch is text an outsider writes; a job that fetches every URL in it
// is a request forgery primitive with this repository's egress. Scheduled, from
// the default branch, the URLs probed are only ever ones already merged.
//
// ── THE OTHER FORGERY VECTOR, WHICH THE TRIGGER DOES NOT CLOSE. Being merged
// makes a URL reviewed; it does not make the HOST honest, and this script
// follows redirects by hand — re-requesting whatever a `location` header names.
// A citation that was ordinary at review time can start redirecting to an
// internal address weeks later. Every hop, the first included, is therefore
// re-validated by address-guard.mjs, which is where that threat and its residual
// rebinding window are set out in full.
//
// ── WHY IT CAN FAIL, UNLIKE THE THREE REPORTING TOOLS.
// report-obligation-load.mjs, report-skill-duplication.mjs, and the discovery
// evaluation cannot fail by construction — no threshold, an undecidable defect,
// and non-determinism respectively. A dead link has none of those problems: it
// is a fact, it is decidable, and it is repairable. So this one fails, in the
// shape branch-governance-audit.yaml already uses. What it will NOT fail on is a
// host that refused to answer — see classify.mjs, where that decision lives.
//
// Usage:
//   node scripts/link-freshness/check.mjs [options] [<path> ...]
//
// Exit codes:
//   0  no link was confirmed dead (unverifiable and moved links are reported)
//   1  at least one link is confirmed dead
//   2  bad invocation

import { refusalReason } from "./address-guard.mjs";
import {
  ALIVE,
  classifyOutcome,
  DEAD,
  failsRun,
  GET_FALLBACK_STATUSES,
  isRetryableStatus,
  MOVED,
  PERMANENT_REDIRECT_STATUSES,
  REDIRECT_STATUSES,
  UNVERIFIABLE,
  VERDICTS,
} from "./classify.mjs";
import { collectUrls } from "./urls.mjs";

/**
 * Identifies the audit to the hosts it probes, with somewhere to complain. A
 * default Node user-agent reads as an unattributed scraper, which is how a
 * repository earns a block that then shows up here as `unverifiable` forever.
 */
const USER_AGENT =
  "axross-skills-link-freshness/1 (+https://github.com/axross/skills)";

const DEFAULTS = {
  /** Concurrent probes. Low enough to stay polite across ~80 hosts. */
  concurrency: 8,
  /** Per-request timeout, in milliseconds. */
  timeout: 15_000,
  /** Extra attempts after the first, for a retryable status or a transport error. */
  retries: 2,
  /** Base backoff between attempts, doubled each retry. */
  retryDelay: 1_000,
  /** Redirect hops followed before giving up, which also breaks a redirect loop. */
  maxHops: 10,
};

const USAGE = `Usage: check.mjs [options] [<path> ...]

Probe every external http(s) URL cited in the Markdown under <path> and report
which ones no longer resolve. With no <path>, the whole tree below the working
directory is audited.

  --dry-run            list the URLs that would be probed and exit; makes NO
                       network request
  --concurrency <n>    concurrent probes (default ${DEFAULTS.concurrency})
  --timeout <ms>       per-request timeout (default ${DEFAULTS.timeout})
  --retries <n>        extra attempts on a retryable status or transport error
                       (default ${DEFAULTS.retries})
  --help, -h           show this message

Only a link confirmed dead — a 404 or 410 that survives a retry — fails the run.
A host that rate-limits, blocks, or times out is reported as unverifiable and
never affects the exit code.

Exit codes: 0 nothing confirmed dead, 1 one or more dead, 2 bad invocation.`;

function fail2(message) {
  process.stderr.write(`${message}\n${USAGE}\n`);
  process.exit(2);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A transport failure, described in the terms a maintainer can act on: a DNS
 * miss, an expired certificate, and a timeout call for three different responses.
 */
function errorReason(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return "timed out";
  }
  const code = error?.cause?.code ?? error?.code;
  if (code) return `network error (${code})`;
  return `network error (${error?.message ?? "unknown"})`;
}

/**
 * One request, following redirects BY HAND.
 *
 * `fetch`'s own redirect following reports `redirected` as a bare boolean and
 * hides the status of each hop — which loses the only thing worth knowing here.
 * A 302 is a temporary arrangement and says nothing about the link; a 301 or 308
 * says the citation is out of date even though it still works. Following
 * manually is what makes `moved` mean something.
 *
 * Manual following also means re-issuing a request to a host the REMOTE SERVER
 * names, so every hop — the first included — is re-validated against
 * address-guard.mjs before it is made. Without that, a merged citation whose
 * host later starts redirecting to `169.254.169.254` would have this runner
 * probe the cloud metadata endpoint on the next scheduled run, and nothing at
 * review time could have shown it. See address-guard.mjs for the threat and for
 * the rebinding window it does not close.
 *
 * @returns {Promise<import("./classify.mjs").Outcome>}
 */
async function requestOnce(url, { method, timeout, maxHops }) {
  let current = url;
  let permanentRedirect = false;

  for (let hop = 0; hop <= maxHops; hop += 1) {
    const refusal = await refusalReason(current);
    // Deterministic, so it is marked non-retryable: re-resolving a name that
    // just answered with a private address three more times learns nothing and
    // triples the lookups.
    if (refusal) return { kind: "error", reason: refusal, retryable: false };

    const response = await fetch(current, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(timeout),
      headers: { "user-agent": USER_AGENT, accept: "*/*" },
    });

    if (!REDIRECT_STATUSES.has(response.status)) {
      return {
        kind: "status",
        status: response.status,
        permanentRedirect,
        finalUrl: current,
      };
    }

    const location = response.headers.get("location");
    // A redirect with nowhere to go is the host's problem, not a hop. Reported
    // as the status it actually sent rather than followed into nothing.
    if (!location) {
      return {
        kind: "status",
        status: response.status,
        permanentRedirect,
        finalUrl: current,
      };
    }

    if (PERMANENT_REDIRECT_STATUSES.has(response.status)) permanentRedirect = true;
    current = new URL(location, current).toString();
  }

  return { kind: "error", reason: `more than ${maxHops} redirects` };
}

/**
 * One request with retries, so a transient answer never reaches a verdict.
 *
 * Returns as soon as a status is definitive. A retryable status or a transport
 * error is retried with doubling backoff, and whatever the last attempt produced
 * is what gets classified — a 429 that stays a 429 is still unverifiable, which
 * is the correct answer rather than a fallback.
 */
async function attempt(url, method, options) {
  let outcome;

  for (let index = 0; index <= options.retries; index += 1) {
    if (index > 0) await delay(options.retryDelay * 2 ** (index - 1));

    try {
      outcome = await requestOnce(url, { ...options, method });
    } catch (error) {
      outcome = { kind: "error", reason: errorReason(error) };
    }

    if (outcome.kind === "status" && !isRetryableStatus(outcome.status)) {
      return outcome;
    }
    // A refused address is a decision, not a transport blip.
    if (outcome.kind === "error" && outcome.retryable === false) return outcome;
  }
  return outcome;
}

/**
 * Probe one URL to a verdict.
 *
 * Three passes, each earning its place:
 *   1. `HEAD` — cheap, and enough for most hosts.
 *   2. `GET`, when `HEAD` came back 403/405/501 — "not like that", not "not here".
 *   3. `GET` again, only when the answer was DEAD — the "stable across retries"
 *      requirement. A 404 is the one verdict that fails the run, so it is the one
 *      verdict worth paying an extra request to be sure of, and a host that
 *      answers 404 once and 200 next is believed on the 200.
 */
async function probeUrl(url, options) {
  let outcome = await attempt(url, "HEAD", options);

  if (outcome.kind === "status" && GET_FALLBACK_STATUSES.has(outcome.status)) {
    outcome = await attempt(url, "GET", options);
  }

  const classified = classifyOutcome(outcome);
  if (classified.verdict !== DEAD) return classified;

  await delay(options.retryDelay);
  return classifyOutcome(await attempt(url, "GET", options));
}

/**
 * Run `worker` over `items` with at most `limit` in flight, preserving order.
 *
 * A hand-rolled pool rather than chunked `Promise.all`: chunking idles the whole
 * pool waiting on the slowest URL in each chunk, and one host that sits at the
 * timeout would then stall every batch it appears in.
 */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    },
  );

  await Promise.all(runners);
  return results;
}

/** Section headings, each stating what the verdict costs the run. */
const SECTIONS = {
  [DEAD]: "DEAD — the host says it is gone. This is what fails the run.",
  [MOVED]:
    "MOVED — still resolves, through a permanent redirect. Informational.",
  [UNVERIFIABLE]:
    "UNVERIFIABLE — no answer from this network. Never affects the outcome.",
};

/**
 * Render the report.
 *
 * Alive URLs are counted, not listed: 200-odd working links are noise around the
 * handful that need a decision. Everything printed is sorted upstream, and
 * nothing checkout-dependent appears, so two runs over an unchanged tree diff
 * cleanly.
 */
function render(results, { fileCount, siteCount }) {
  const byVerdict = new Map(VERDICTS.map((verdict) => [verdict, []]));
  for (const result of results) byVerdict.get(result.verdict).push(result);

  const lines = [
    `Link freshness for ${results.length} unique URL(s) across ${siteCount} site(s) in ${fileCount} Markdown file(s).`,
    "",
  ];

  for (const verdict of [DEAD, MOVED, UNVERIFIABLE]) {
    const found = byVerdict.get(verdict);
    if (found.length === 0) continue;

    lines.push(`${SECTIONS[verdict]} (${found.length})`, "");
    for (const { url, detail, sites } of found) {
      lines.push(`  ${url}`, `    ${detail}`);
      for (const site of sites) lines.push(`      ${site}`);
      lines.push("");
    }
  }

  const dead = byVerdict.get(DEAD).length;
  lines.push(
    `alive ${byVerdict.get(ALIVE).length}` +
      `  moved ${byVerdict.get(MOVED).length}` +
      `  unverifiable ${byVerdict.get(UNVERIFIABLE).length}` +
      `  dead ${dead}`,
    "",
    dead === 0
      ? "No link was confirmed dead."
      : `${dead} link(s) confirmed dead. Fix the citation, or record why it stays.`,
  );
  return lines.join("\n");
}

function parseCount(raw, flag) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    fail2(`${flag} needs a non-negative integer, got "${raw}".`);
  }
  return value;
}

function parseArgs(argv) {
  const options = { ...DEFAULTS, dryRun: false };
  const roots = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      roots.push(arg);
      continue;
    }

    switch (arg) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--concurrency":
        index += 1;
        options.concurrency = parseCount(argv[index], arg) || 1;
        break;
      case "--timeout":
        index += 1;
        options.timeout = parseCount(argv[index], arg);
        break;
      case "--retries":
        index += 1;
        options.retries = parseCount(argv[index], arg);
        break;
      default:
        fail2(`Unknown option "${arg}".`);
    }
  }

  return { options, roots: roots.length > 0 ? roots : ["."] };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const { options, roots } = parseArgs(argv);
  const { urls, fileCount, siteCount } = await collectUrls(roots);

  if (urls.length === 0) {
    process.stdout.write(
      `No external URLs found under ${roots.join(", ")} (${fileCount} Markdown file(s) read).\n`,
    );
    process.exit(0);
  }

  // The offline path. It exists so this script's extraction can be exercised by
  // the test suite and by a maintainer without spending anyone's rate limit —
  // and so a run that is about to probe can be previewed first.
  if (options.dryRun) {
    const lines = [
      `Would probe ${urls.length} unique URL(s) across ${siteCount} site(s) in ${fileCount} Markdown file(s).`,
      "",
    ];
    for (const { url, sites } of urls) {
      lines.push(`  ${url}`);
      for (const site of sites) lines.push(`    ${site}`);
    }
    lines.push("", "No network request was made.");
    process.stdout.write(`${lines.join("\n")}\n`);
    process.exit(0);
  }

  let completed = 0;
  const results = await mapWithConcurrency(
    urls,
    options.concurrency,
    async ({ url, sites }) => {
      const { verdict, detail } = await probeUrl(url, options);
      completed += 1;
      // Progress goes to stderr so stdout stays the report and stays diffable.
      if (completed % 25 === 0 || completed === urls.length) {
        process.stderr.write(`  probed ${completed}/${urls.length}\n`);
      }
      return { url, sites, verdict, detail };
    },
  );

  process.stdout.write(`${render(results, { fileCount, siteCount })}\n`);
  process.exit(failsRun(results.map((result) => result.verdict)) ? 1 : 0);
}

main();
