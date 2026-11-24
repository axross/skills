#!/usr/bin/env node
import { main, resolveLink, selfName, siblingHelp } from "./docs.mjs";

const usage = `Usage: ${selfName(import.meta.url)} [<docs-dir>]

Check relative links in Markdown, images and OKF path fields. In an OKF bundle, check Markdown
heading fragments and resolve / from the bundle root. External sources need URLs.
Exit codes: 0 pass or no index, 1 findings, 2 bad invocation or read error.
${siblingHelp(selfName(import.meta.url))}`;

async function run(docs) {
  const findings = [];

  for (const doc of docs.documents) {
    for (const { target, line, field } of doc.links) {
      let { path, page, fragment, error } = await resolveLink(
        docs,
        doc,
        target,
      );
      if (
        !error &&
        docs.okf &&
        fragment &&
        (page || path.endsWith(".md")) &&
        !page?.anchors.has(fragment)
      )
        error = "has no matching fragment";
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
  run,
  pass: (docs) =>
    `Every relative link resolves across ${docs.documents.length} documents.`,
});
