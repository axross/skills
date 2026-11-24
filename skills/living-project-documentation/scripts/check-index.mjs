#!/usr/bin/env node
import { basename } from "node:path";
import { main, resolveLink, selfName, siblingHelp } from "./docs.mjs";

const usage = `Usage: ${selfName(import.meta.url)} [--evidence <bundle-relative-file.md>]... [<docs-dir>]

Check direct listings in legacy docs and root-to-page routes through indexes in
OKF bundles. Require a nonempty concept type except for index.md, log.md and
exact untyped evidence paths. Each evidence exception prints a warning.
Exit codes: 0 pass or no index, 1 findings, 2 bad invocation or read error.
${siblingHelp(selfName(import.meta.url))}`;

/**
 * follow index routes and include named evidence cited by reachable companions.
 * @throws on unexpected filesystem errors while resolving a route.
 */
async function reachable(docs, evidence) {
  const reached = new Set([docs.index.path]);
  const pending = [docs.index];
  while (pending.length) {
    const index = pending.pop();
    for (const link of index.links) {
      if (link.html || link.image || link.field) continue;
      const { page: doc } = await resolveLink(docs, index, link.target);
      if (!doc || reached.has(doc.path)) continue;
      reached.add(doc.path);
      if (docs.okf && basename(doc.path) === "index.md") pending.push(doc);
    }
  }
  // a named source is discoverable through its indexed companion.
  if (docs.okf && evidence.size) {
    for (const page of docs.documents) {
      if (!reached.has(page.path) || !page.meta?.has("type")) continue;
      for (const link of page.links) {
        if (
          link.html ||
          link.image ||
          (link.field && !link.field.startsWith("sources."))
        )
          continue;
        const { page: source } = await resolveLink(docs, page, link.target);
        if (source && evidence.has(source.relative)) reached.add(source.path);
      }
    }
  }
  return reached;
}

/**
 * report unreachable pages and metadata findings, consuming exact evidence exceptions.
 * @throws if the bundle's navigation cannot be inspected.
 */
async function run(docs, evidence) {
  const reached = await reachable(docs, evidence);
  const findings = [];
  for (const doc of docs.documents) {
    if (
      !reached.has(doc.path) &&
      !(docs.okf && basename(doc.path) === "log.md")
    ) {
      findings.push({
        category: "unindexed",
        message: `${doc.relative} is not linked from index.md`,
      });
    }
    if (!docs.okf) continue;
    if (doc.metadataError)
      findings.push({
        category: "frontmatter",
        message: `${doc.relative}: ${doc.metadataError}`,
      });
    if (["index.md", "log.md"].includes(basename(doc.path))) continue;
    const type = doc.meta?.get("type");
    if (typeof type === "string" && type.trim()) continue;
    if (!doc.meta?.has("type") && evidence.delete(doc.relative)) {
      console.log(`WARN  ${doc.relative}: named untyped evidence`);
    } else {
      findings.push({
        category: "type",
        message: `${doc.relative} needs a nonempty string type`,
      });
    }
  }
  for (const name of evidence)
    findings.push({
      category: "evidence",
      message: `${name} does not name an untyped evidence document`,
    });
  return findings;
}

process.exitCode = await main({
  usage,
  allowEvidence: true,
  run,
  pass: (docs) =>
    `Every living page is reachable from the root index (${docs.documents.length} Markdown files).`,
});
