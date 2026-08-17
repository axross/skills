#!/usr/bin/env node
// an outcome-phase script judgment: does the reconstructed workspace gate the
// authenticated route tree declaratively — a Stack.Protected guard at a
// navigator — with the imperative bounce-to-sign-in gone.
//
// docs/specs/skill-evaluation.md, "Three phases": an outcome factor is handed
// the diff and the task, but this factor's own question — what the FINAL
// tree looks like — is answered by reading the reconstructed workspace
// (this process's own cwd) rather than the diff, the same way
// check-file-contains.mjs's sibling scripts already do.
//
// Why a walk of app/ and src/ rather than one named path: this scenario's
// own scenario.json plan record says the fix may legitimately land in
// app/_layout.tsx, app/(app)/_layout.tsx, or src/session/authenticated-layout.tsx
// — and a probe is free to restructure the route tree further (a new group,
// a renamed layout). A single hard-coded path would miss any of those.
//
// Two conditions, both read from the same corpus of text:
//
//   1. DECLARATIVE — some file contains a `<Stack.Protected ... guard=`
//      usage: expo-router's own declarative gating API
//      (skills/expo-app-development/references/navigators-and-layouts.md's
//      own example block), which is the mechanism the taught MUST rule
//      names.
//   2. BOUNCE GONE — no file still contains a `<Redirect ...>` whose `href`
//      resolves to "/sign-in", in bare-string form (`href="/sign-in"`, the
//      exact anti-pattern authenticated-layout.tsx:20 ships today) OR in
//      object form (`href={{ pathname: "/sign-in", ... }}`, the shape a
//      hand-rolled return-path parameter would take). This factor is
//      deliberately opinionated about the second form too: threading a
//      return-path parameter through the existing imperative redirect still
//      redirects imperatively from inside a screen, which is the pattern the
//      taught rule forbids regardless of what the redirect carries.
//
// Limitation, stated rather than hidden: a `<Redirect href={signInPath} />`
// built from a variable or a template literal that never spells "/sign-in"
// as a literal in this file is not found by this scan. A hand-rolled
// indirection that goes that far is not the return-path fix this factor
// exists to catch.
//
// usage: node check-declarative-auth-gate.mjs <context.json>

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-declarative-auth-gate.mjs <context.json>");

try {
  JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

/** every non-spec .ts/.tsx file under `root`, read as { path, content }. */
function readSourceFiles(root) {
  const files = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (/\.spec\.(ts|tsx)$/.test(entry.name)) continue;
      try {
        if (!statSync(full).isFile()) continue;
        files.push({ path: full, content: readFileSync(full, "utf8") });
      } catch {
        // unreadable entry — skip rather than fail the whole walk on it
      }
    }
  }
  walk(root);
  return files;
}

const files = [...readSourceFiles("app"), ...readSourceFiles("src")];
if (files.length === 0) {
  fail("no .ts/.tsx files found under app/ or src/ in the reconstructed workspace — this factor cannot be judged.");
}

const DECLARATIVE_GUARD_RE = /<Stack\.Protected\b[^>]*\bguard\s*=/;
const SIGN_IN_REDIRECT_RE = /<Redirect\b[^>]*\bhref\s*=\s*(?:"\/sign-in"|'\/sign-in'|\{[\s\S]*?\/sign-in[\s\S]*?\})/;

const declarativeFiles = files.filter((file) => DECLARATIVE_GUARD_RE.test(file.content)).map((file) => file.path);
const bounceFiles = files.filter((file) => SIGN_IN_REDIRECT_RE.test(file.content)).map((file) => file.path);

const hasDeclarativeGate = declarativeFiles.length > 0;
const bounceGone = bounceFiles.length === 0;
const result = hasDeclarativeGate && bounceGone;

const evidenceParts = [];
evidenceParts.push(
  hasDeclarativeGate
    ? `a Stack.Protected guard is declared in ${declarativeFiles.join(", ")}`
    : "no file declares a Stack.Protected guard",
);
evidenceParts.push(
  bounceGone
    ? "no file redirects to /sign-in imperatively"
    : `${bounceFiles.join(", ")} still redirect${bounceFiles.length === 1 ? "s" : ""} to /sign-in imperatively`,
);

process.stdout.write(`${JSON.stringify({ result, evidence: evidenceParts.join("; ") })}\n`);
