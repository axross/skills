#!/usr/bin/env node
// an outcome-phase script judgment: does the Node-only "unit" project's own
// `include` still name only `.ts` files, with no `.tsx` pattern added.
//
// This guards against the wrong fix for the sibling factor in this
// scenario (check-toast-test-reaches-browser-project.mjs): widening the
// Node project — `environment: "node"`, no DOM — to also swallow
// PublishToast's real-DOM render would make that project collect a test
// that would fail the moment it actually ran there. This factor never runs
// the suite to observe that failure; it reads vitest.config.ts structurally
// and checks the unit project's declared include never grew a `.tsx`
// pattern, which is the textual signal of that mistake being made. When
// vitest.config.ts carries no "unit" project with a locatable include array
// at all, that is a real `false`: the file is there and readable, and the
// project structure this factor expects simply is not in it.
//
// usage: node check-unit-project-stays-ts-only.mjs <context.json>

import { readFileSync } from "node:fs";

import { projectInclude } from "./vitest-config.mjs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-unit-project-stays-ts-only.mjs <context.json>");
// this factor reads the final workspace directly and needs neither an
// expectation nor any material, so context.json's own content is unread —
// only its presence (the contract every script judgment is invoked under)
// is checked above.

let config;
try {
  config = readFileSync("vitest.config.ts", "utf8");
} catch (error) {
  fail(`could not read vitest.config.ts from the reconstructed workspace: ${error.message}`);
}

const unitInclude = projectInclude(config, "unit");
if (unitInclude === null) {
  const evidence = 'vitest.config.ts has no project named "unit" with a locatable include array.';
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

const widenedToTsx = unitInclude.filter((pattern) => pattern.endsWith(".tsx"));
const result = widenedToTsx.length === 0;
const evidence = result
  ? `vitest.config.ts's unit project include is still ${JSON.stringify(unitInclude)} — no pattern ends in .tsx.`
  : `vitest.config.ts's unit project include is now ${JSON.stringify(unitInclude)}, which adds ${widenedToTsx.map((p) => JSON.stringify(p)).join(", ")} — the Node-only project would now collect a real-DOM render it has no browser to run.`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
