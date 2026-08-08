#!/usr/bin/env node
// prepare one workspace for one probe, and print its path.
//
// one of three entry points, each one verb: setup prepares, evaluate probes,
// summarize derives. the split follows the work rather than taste — the probes
// of one case run as a matrix across separate runners, so the three happen in
// different processes on different machines and cannot be one command.
//
// `--install` is what keeps the harness's own setup out of the measurement.
// without it every probe spent three to five of its twelve to fifteen turns
// discovering node_modules was absent, installing it, and re-running the tests:
// turns and money in both conditions, a network-dependent step in every probe,
// and each run resolving its own dependency versions. it is off by default so
// this tool's own tests stay hermetic. for a mock that drives a browser it also
// downloads that browser, which npm does not carry — see mock-workspace.mjs.
//
// `--patch` is how a case brings the broken starting state its own prompt
// describes, without the mock shipping one. the mechanism lives in tools/lib
// because a mock belongs to neither evaluation; this entry point only passes
// the path through.
//
// exit codes:
//   0  the workspace path was printed to stdout
//   2  bad invocation, a malformed mock, a patch that does not apply, or a
//      failure preparing the workspace

import { materialize } from "../lib/mock-workspace.mjs";

const DEFAULT_MOCK = "content-site";

const USAGE = `Usage: setup.mjs [options]

Expand a mock project (mocks/<mock>) into an isolated, git-backed temporary
directory, install the condition's skills into its .claude/skills/, and print
the workspace path.

  --mock <name>    which mocks/ fixture to materialize (default: ${DEFAULT_MOCK})
  --skill <name>   a skill to install into the workspace's .claude/skills/<name>,
                    copied from this repository's OWN installed skills;
                    repeatable. Passing none is the skill-absent condition.
  --patch <path>   a unified diff to apply after the copy and before the
                    history is replayed, so a case can bring the broken starting
                    state its prompt describes without the mock shipping one. It
                    may touch history.jsonc, and must when it changes the file
                    set.
  --install        run \`npm ci\` in the workspace — and, for a mock that
                    declares @playwright/test, download the browser its
                    end-to-end command needs — so a probe starts from a prepared
                    workspace rather than spending its own turns on it. Off by
                    default: the default path touches no network, which is what
                    keeps this tool's own tests hermetic. Needs npm on PATH and
                    a network.
  --help           this text

Exit codes: 0 the workspace path was printed, 2 bad invocation or a fixture
that failed to materialize.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = { mock: DEFAULT_MOCK, skills: [], install: false, patch: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };
    if (arg === "--mock") options.mock = next();
    else if (arg === "--skill") options.skills.push(next());
    else if (arg === "--patch") options.patch = next();
    else if (arg === "--install") options.install = true;
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
  try {
    const workspace = await materialize(options);
    process.stdout.write(`${workspace}\n`);
  } catch (error) {
    fail2(error instanceof Error ? error.message : String(error));
  }
}

main();
