#!/usr/bin/env node
// a discovery-phase script judgment: did the probe invoke the factor's
// expected skill at all.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "discovery", so the only material evaluate.mjs
// handed it is the skill invocations — see factor-judgment.mjs's
// materialFor.
//
// usage: node check-discovery.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-discovery.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const expectedSkill = context.expect?.skill;
if (typeof expectedSkill !== "string" || expectedSkill.length === 0) {
  fail('context.expect.skill must be a non-empty string naming the skill to look for.');
}

const invoked = context.material?.skillsInvoked;
if (!Array.isArray(invoked)) {
  fail("context.material.skillsInvoked must be an array — this script judges the discovery phase alone.");
}

const result = invoked.includes(expectedSkill);
const evidence = result
  ? `the probe invoked the Skill tool with "${expectedSkill}"`
  : `the probe's invoked skills were [${invoked.map((name) => `"${name}"`).join(", ")}], which does not include "${expectedSkill}"`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
