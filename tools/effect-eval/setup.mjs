#!/usr/bin/env node
// setup.mjs — prepare one workspace for one probe, and print its path.
//
// ONE OF THREE ENTRY POINTS, EACH ONE VERB. setup prepares a workspace,
// evaluate runs one probe against a prepared workspace, summarize derives the
// summary layer over a finished case measurement. The split is not cosmetic:
// the probes of one case run as a matrix across separate runners, so preparing,
// probing, and summarising happen in different processes on different machines
// and cannot be one command.
//
// WHY THE HARNESS INSTALLS THE DEPENDENCIES AND NOT THE MODEL. Every probe run
// before this instrument's predecessor was fixed spent three to five of its
// twelve to fifteen turns discovering node_modules was absent, running npm
// install, and re-running the tests. That is the harness's own setup showing up
// inside the measurement: it costs turns and money in both conditions, it puts
// a network-dependent step in every probe, and it lets each run resolve its own
// dependency versions. A real developer opens a repository whose dependencies
// are already installed.
//
// Usage:
//   node tools/effect-eval/setup.mjs [options]
//
// Exit codes:
//   0  the workspace path was printed to stdout
//   2  bad invocation, a malformed mock, or a failure preparing the workspace

import { materialize } from "./src/workspace.mjs";

const DEFAULT_MOCK = "content-site";

const USAGE = `Usage: setup.mjs [options]

Expand a mock project (mocks/<mock>) into an isolated, git-backed temporary
directory, install the condition's skills into its .claude/skills/, and print
the workspace path.

  --mock <name>    which mocks/ fixture to materialize (default: ${DEFAULT_MOCK})
  --skill <name>   a skill to install into the workspace's .claude/skills/<name>,
                    copied from this repository's OWN installed skills;
                    repeatable. Passing none is the skill-absent condition.
  --install        run \`npm ci\` in the workspace, so a probe starts from
                    installed dependencies rather than spending its own turns on
                    them. Off by default: the default path touches no network,
                    which is what keeps this tool's own tests hermetic. Needs
                    npm on PATH and a network.
  --help           this text

Exit codes: 0 the workspace path was printed, 2 bad invocation or a fixture
that failed to materialize.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = { mock: DEFAULT_MOCK, skills: [], install: false };
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
