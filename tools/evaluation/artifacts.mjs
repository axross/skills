#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { admitBundles, dispatchContract, inspectPath, packBundle } from "./src/artifact-admission.mjs";
import { canonicalJson } from "./src/layout.mjs";

const USAGE = `Usage: artifacts.mjs <pack-probe|pack-judged|admit> --input <dir> --out <path>
  pack-probe / pack-judged: --selector <matrix-entry-json>
  admit: [--judged <dir>] --report <path> [--scenario <id>]

Context: GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SHA, GITHUB_RUN_ATTEMPT,
PROBE_MATRIX and JUDGMENT_MATRIX must describe the independently planned dispatch.
Bundle uploads contain only record.json. Downloads retain artifact-name directories.
Exit codes: 0 admitted/packaged (may be partial), 1 refused or failed, 2 bad invocation.`;

/**
 * invocation errors are distinct from refused material and failed effects.
 * @throws {Error} on absent, unknown, irrelevant, duplicate, or unpaired flags
 */
function optionsFrom(argv) {
  const [command, ...args] = argv;
  if (!["pack-probe", "pack-judged", "admit"].includes(command)) throw new Error(USAGE);
  const options = { command };
  const allowed = command === "admit" ? ["input", "out", "judged", "report", "scenario"]
    : ["input", "out", "selector"];
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.replace(/^--/, "");
    if (!allowed.includes(key) ||
      !args[index].startsWith("--") || !args[index + 1] || key in options) throw new Error(USAGE);
    options[key] = args[index + 1];
  }
  if (!options.input || !options.out ||
    (command === "admit" ? !options.report : !options.selector)) throw new Error(USAGE);
  if (command !== "admit") {
    options.selector = JSON.parse(options.selector);
    if (!options.selector || typeof options.selector !== "object" || Array.isArray(options.selector)) throw new Error(USAGE);
  }
  return options;
}

/**
 * stdout success follows both data and report writes; partial effects are not success.
 * @throws {Error} on refused material or failed filesystem effects
 */
async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  let options;
  let contract;
  try {
    options = optionsFrom(process.argv.slice(2));
    if (!/^[1-9]\d*$/.test(process.env.GITHUB_RUN_ATTEMPT)) throw new Error("Invalid dispatch attempt");
    contract = dispatchContract({
      identity: { repository: process.env.GITHUB_REPOSITORY, runId: process.env.GITHUB_RUN_ID,
        sourceCommit: process.env.GITHUB_SHA },
      probes: JSON.parse(process.env.PROBE_MATRIX), judgments: JSON.parse(process.env.JUDGMENT_MATRIX),
    });
    if (options.command === "admit") {
      const report = resolve(options.report);
      const out = resolve(options.out);
      if (report === out || [...contract.scenarios.values()].some((scenario) => {
        const measurement = join(out, scenario.measurementDirName);
        return report === measurement || report.startsWith(`${measurement}${sep}`);
      })) throw new Error("Report path overlaps a planned measurement destination");
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  const scenariosRoot = join(dirname(fileURLToPath(import.meta.url)), "scenarios");
  if (options.command === "admit") {
    await inspectPath(resolve(options.report));
    const report = await admitBundles({ probesRoot: resolve(options.input), judgedRoot: options.judged && resolve(options.judged),
      out: resolve(options.out), contract, scenariosRoot, scenarioId: options.scenario });
    await writeFile(resolve(options.report), canonicalJson(report));
    process.stdout.write(`Admission ${report.status}: ${report.copiedFiles} files; report ${options.report}\n`);
  } else {
    const bundle = await packBundle({ kind: options.command === "pack-probe" ? "probe" : "judged",
      input: resolve(options.input), selector: options.selector, contract,
      attempt: process.env.GITHUB_RUN_ATTEMPT, scenariosRoot });
    await mkdir(dirname(resolve(options.out)), { recursive: true });
    await writeFile(resolve(options.out), canonicalJson(bundle), { flag: "wx" });
    process.stdout.write(`Packaged ${bundle.name}: ${bundle.files.length} files\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`Artifact admission failed: ${error.message}\n`);
  process.exitCode = 1;
});
