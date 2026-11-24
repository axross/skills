#!/usr/bin/env node
import { join } from "node:path";
import { realpath } from "node:fs/promises";
import {
  main,
  resolveLink,
  selfName,
  siblingHelp,
  withinRoot,
} from "./docs.mjs";

const usage = `Usage: ${selfName(import.meta.url)} [<docs-dir>]

Check relative Markdown links and images. In an OKF bundle, check Markdown
heading fragments and resolve / from the bundle root. External sources need URLs.
Exit codes: 0 pass or no index, 1 findings, 2 bad invocation or read error.
${siblingHelp(selfName(import.meta.url))}`;

async function run(docs) {
  const findings = [];

  const root = await realpath(docs.root);
  for (const doc of docs.documents) {
    for (const { target, line } of doc.links) {
      const resolved = resolveLink(docs, doc, target);
      let { path, fragment, error } = resolved;
      if (!error) {
        try {
          const actual = await realpath(path);
          if (docs.okf && !withinRoot(root, actual))
            error = "leaves the bundle; use a source URL";
          else if (docs.okf && fragment) {
            const targetPage =
              docs.byPath.get(path) ?? docs.byPath.get(join(path, "index.md"));
            if (
              (targetPage || path.endsWith(".md")) &&
              !targetPage?.anchors.has(fragment)
            )
              error = "has no matching fragment";
          }
        } catch (reason) {
          if (!["ENOENT", "ENOTDIR", "ELOOP"].includes(reason.code))
            throw reason;
          error = "does not resolve";
        }
      }
      if (error)
        findings.push({
          category: "link",
          message: `${doc.relative}:${line} → ${target} ${error}`,
        });
    }
  }
  return findings;
}
process.exitCode = await main({
  usage,
  run,
  pass: (docs) =>
    `Every relative link resolves across ${docs.documents.length} documents.`,
});
