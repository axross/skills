#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { main, resolveLink, selfName, siblingHelp } from "./docs.mjs";

const usage = `Usage: ${selfName(import.meta.url)} [--source-root <checkout>] [<docs-dir>]

Check relative links in Markdown, images and OKF path fields. In an OKF bundle, check Markdown
heading fragments and resolve / from the bundle root. With --source-root, authored links
may also reach local files in the containing checkout. Standalone exports use source URLs.
Exit codes: 0 pass or no index, 1 findings, 2 bad invocation or read error.
${siblingHelp(selfName(import.meta.url))}`;

/**
 * report unresolved local destinations with their source line and field.
 * @throws if a destination cannot be inspected due to a filesystem error.
 */
async function run(docs, _evidence, sourceRoot) {
  const findings = [];
  const sourceAnchors = new Map();

  for (const doc of docs.documents) {
    for (const link of doc.links) {
      const { target, line, field } = link;
      let { path, page, fragment, error, sourceLink } = link.error
        ? link
        : await resolveLink(docs, doc, target, field ? undefined : sourceRoot);
      if (!error && field === "license" && !(await stat(path)).isFile())
        error = "does not resolve to a license file";
      if (
        !error &&
        docs.okf &&
        fragment &&
        (page || path.toLowerCase().endsWith(".md"))
      ) {
        let anchors = page?.anchors;
        if (!anchors && sourceLink && (await stat(path)).isFile()) {
          if (!sourceAnchors.has(path)) {
            const { readMarkdown } = await import("./okf.mjs");
            const text = await readFile(path, "utf8");
            sourceAnchors.set(path, readMarkdown(text).anchors);
          }
          anchors = sourceAnchors.get(path);
        }
        if (!anchors?.has(fragment)) error = "has no matching fragment";
      }
      if (error)
        findings.push({
          category: field ?? "link",
          message: `${doc.relative}:${line} → ${target} ${error}`,
        });
    }
  }
  return findings;
}
process.exitCode = await main({
  usage,
  allowSourceRoot: true,
  run,
  pass: (docs) =>
    `Every relative link resolves across ${docs.documents.length} documents.`,
});
