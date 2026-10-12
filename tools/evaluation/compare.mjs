#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalJson } from "./src/layout.mjs";
import { computeTreatmentReport } from "./src/treatment-report.mjs";

const USAGE = `Usage: compare.mjs <declaration.json> <observations.json>

Reports an explicitly declared candidate-minus-baseline treatment comparison.
Reads two independently supplied files and emits one JSON report on stdout.
Never writes inputs, scans measurements, calls models or dispatches actors.
Unknown or confounded qualification is report data, not an invocation failure.

Exit codes: 0 report emitted, 1 unreadable/invalid inputs, 2 bad invocation.`;

/** reports only after both immutable inputs are read and validated. */
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  if (args.length !== 2 || args.some((arg) => arg.startsWith("-"))) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  try {
    const paths = await Promise.all(args.map((path) => realpath(resolve(path))));
    if (paths[0] === paths[1]) throw new Error("Declaration and observations must be separate inputs.");
    const bytes = await Promise.all(paths.map((path) => readFile(path)));
    const inputs = bytes.map((value, index) => {
      try {
        const decoded = value.toString("utf8");
        if (!Buffer.from(decoded).equals(value)) throw new Error("Invalid UTF-8");
        return JSON.parse(decoded);
      } catch (error) {
        throw new Error(`${index === 0 ? "Declaration" : "Observations"} is not valid JSON encoded as UTF-8.`, { cause: error });
      }
    });
    const report = computeTreatmentReport(inputs[0], inputs[1]);
    report.inputFiles = Object.fromEntries(["declaration", "observations"].map((kind, index) => [kind, {
      content: `sha256:${createHash("sha256").update(bytes[index]).digest("hex")}`,
    }]));
    process.stdout.write(canonicalJson(report));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

await main();
