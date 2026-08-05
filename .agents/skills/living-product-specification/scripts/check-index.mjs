#!/usr/bin/env node
// Orphan detection: a document nobody can reach.
//
// This command owns one direction only — is a file listed? Whether a listed
// link resolves is check-references.mjs's question, so no defect is reported
// twice.
//
// Individual decision records are exempt. The log is append-only, so indexing
// each record would grow the one file read unconditionally without bound. The
// index carries a single line for the directory instead, and that line is
// checked here.

import { join, relative, sep } from "node:path";

import {
  extractLinks,
  main,
  nonDecisionDocuments,
  resolveLink,
  selfName,
  siblingHelp,
} from "./corpus.mjs";

const USAGE = `Usage: ${selfName(import.meta.url)} [<corpus-dir>]

Check that every document in a product-specification corpus is listed in
index.md. Run it after adding or removing a document.

An individual decision record is exempt — the index links decisions/ once, as a
directory, because an append-only log would otherwise grow the index without
bound. Defaults to ./docs.

Exit codes: 0 every document is listed, or the project has no corpus.
            1 findings. 2 bad invocation.
${siblingHelp(selfName(import.meta.url))}`;

function run(corpus) {
  const index = corpus.documents.find((doc) => doc.relative === "index.md");
  const linked = new Set(
    extractLinks(index.text).map(({ target }) => resolveLink(index.path, target)),
  );

  const findings = [];

  for (const doc of nonDecisionDocuments(corpus)) {
    if (doc.relative === "index.md") continue;
    if (!linked.has(doc.path)) {
      findings.push({
        category: "unindexed",
        message: `${doc.relative} is not linked from index.md`,
      });
    }
  }

  if (corpus.hasDecisions) {
    const decisionsDir = join(corpus.root, "decisions");
    const reachable = [...linked].some(
      (target) => target === decisionsDir || relative(decisionsDir, target).split(sep)[0] !== "..",
    );
    if (!reachable) {
      findings.push({
        category: "unindexed",
        message: "decisions/ is not linked from index.md, so the decision log is unreachable",
      });
    }
  }

  return findings;
}

process.exitCode = await main({
  usage: USAGE,
  argv: process.argv.slice(2),
  run,
  pass: (corpus) =>
    `Every document is listed in index.md (${nonDecisionDocuments(corpus).length - 1} indexed).`,
});
