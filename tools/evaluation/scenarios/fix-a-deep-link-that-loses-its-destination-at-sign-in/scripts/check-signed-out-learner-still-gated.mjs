#!/usr/bin/env node
// an outcome-phase script judgment: the "what had to not" companion to
// check-declarative-auth-gate.mjs. Checks that a signed-out learner is still
// kept out of the authenticated subtree by SOME mechanism (declarative or,
// on an unmodified workspace, the pre-existing imperative one), and that a
// neutral surface still renders while the session is still resolving —
// rather than the authenticated tree being simply thrown open, or the
// signed-out tree flashing at launch.
//
// docs/specs/skill-evaluation.md, "Three phases": an outcome factor is
// handed the diff and the task, but this factor answers a question about the
// FINAL tree, so it reads the reconstructed workspace (this process's own
// cwd) the same way its sibling script does. Deliberately generous about
// which file the gate lives in and which mechanism it uses — see that
// sibling's own header for why a walk of app/ and src/ replaces one
// hard-coded path.
//
// Two conditions:
//
//   1. GATE STILL EXISTS — some file still declares a Stack.Protected guard,
//      OR some file still redirects (imperatively, in any form) to
//      /sign-in. Either is evidence that access is still conditioned on the
//      session rather than thrown open; this factor does not care which —
//      that distinction belongs to check-declarative-auth-gate.mjs.
//   2. NEUTRAL SURFACE WHILE RESOLVING — some single file both compares the
//      session status against "loading" and renders a recognizably neutral
//      surface (LoadingScreen, an ActivityIndicator, or a component whose
//      own name says Loading/Splash/Neutral) — the same shape
//      authenticated-layout.tsx:15-17 already has today.
//
// This is a same-file co-occurrence check rather than a scoped read of the
// surrounding statements, which is a real limitation: a status==="loading"
// check and a neutral render that ended up in the same file for unrelated
// reasons would satisfy it. Given recall's own layout files are small and
// single-purpose, that is not a distinction this factor tries to make.
//
// usage: node check-signed-out-learner-still-gated.mjs <context.json>

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-signed-out-learner-still-gated.mjs <context.json>");

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
const LOADING_STATUS_RE = /["']loading["']\s*===|===\s*["']loading["']/;
const NEUTRAL_SURFACE_RE = /<(?:LoadingScreen|ActivityIndicator|\w*(?:Loading|Splash|Neutral)\w*)\b/;

const gateFiles = files
  .filter((file) => DECLARATIVE_GUARD_RE.test(file.content) || SIGN_IN_REDIRECT_RE.test(file.content))
  .map((file) => file.path);
const neutralFiles = files
  .filter((file) => LOADING_STATUS_RE.test(file.content) && NEUTRAL_SURFACE_RE.test(file.content))
  .map((file) => file.path);

const gateStillExists = gateFiles.length > 0;
const rendersNeutralWhileResolving = neutralFiles.length > 0;
const result = gateStillExists && rendersNeutralWhileResolving;

const evidenceParts = [];
evidenceParts.push(
  gateStillExists
    ? `access is still conditioned on the session in ${gateFiles.join(", ")}`
    : "no file conditions access on the session any more — the authenticated tree reads as open",
);
evidenceParts.push(
  rendersNeutralWhileResolving
    ? `a neutral surface still renders while the session resolves, in ${neutralFiles.join(", ")}`
    : "no file renders a recognizable neutral surface while the session status is \"loading\"",
);

process.stdout.write(`${JSON.stringify({ result, evidence: evidenceParts.join("; ") })}\n`);
