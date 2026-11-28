import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { judgeFactor } from "../../../src/factor-judgment.mjs";
import { materialize } from "../../../src/mock-workspace.mjs";
import { loadScenario } from "../../../src/scenario.mjs";

if (process.argv.length !== 3)
  throw new Error("Usage: node replay.mjs <pinned validate.py>");

const validator = resolve(process.argv[2]);
const controls = fileURLToPath(new URL("./", import.meta.url));
const scenario = await loadScenario(resolve(controls, ".."));
const checker = resolve(
  controls,
  "../../../../../skills/living-project-documentation/scripts/check-docs.mjs",
);
const scratch = await mkdtemp(join(tmpdir(), "inkwell-manual-"));
console.log(`Control workspaces and checker reports: ${scratch}`);

const baseline = await materialize({
  mock: scenario.mock,
  patch: join(scenario.dir, scenario.patch),
  agentsMd: scenario.harness.agentsMd,
});
const discovery = scenario.factors.find(({ phase }) => phase === "discovery");
const receipt = scenario.factors.find(
  ({ phase, judgment }) => phase === "outcome" && judgment.method === "script",
);

async function checkFactor(factor, workspace, probe, expected) {
  const outcome = await judgeFactor(factor, {
    scenarioDir: scenario.dir,
    workspace,
    probe,
  });
  assert.equal(outcome.result, expected, JSON.stringify(outcome));
}

const variants = {
  metadata: ["metadata"],
  renamed: ["metadata", "renamed"],
  "index-only": ["metadata", "index-only"],
  repaired: ["repaired"],
  "old-index": ["repaired", "old-index"],
  "over-split": ["repaired", "over-split"],
  unsupported: ["repaired", "unsupported"],
  staged: ["metadata", "staged"],
  "coherent-flat": ["repaired", "coherent-flat"],
};

try {
  for (const [name, patches] of Object.entries(variants)) {
    const workspace = join(scratch, name);
    await cp(baseline, workspace, { recursive: true });
    for (const patch of patches) {
      execFileSync("git", ["apply", join(controls, patch + ".diff")], {
        cwd: workspace,
      });
    }
    const report = execFileSync(
      process.execPath,
      [checker, "--validator", validator, "docs"],
      { cwd: workspace, encoding: "utf8" },
    );
    await writeFile(join(scratch, name + ".log"), report);
    await checkFactor(
      receipt,
      workspace,
      { diff: "", task: scenario.task },
      true,
    );
    console.log(`${name}: structural pass, receipt preserved`);
  }
  await checkFactor(
    discovery,
    baseline,
    { skillsInvoked: scenario.targetSkills },
    true,
  );
  await checkFactor(
    discovery,
    baseline,
    { skillsInvoked: scenario.peerSkills },
    false,
  );
  const path = join(baseline, receipt.judgment.input.files[0].path);
  await writeFile(path, "changed receipt\n");
  await checkFactor(
    receipt,
    baseline,
    { diff: "", task: scenario.task },
    false,
  );
  await rm(path);
  await checkFactor(
    receipt,
    baseline,
    { diff: "", task: scenario.task },
    false,
  );
  console.log(
    "Discovery selected/absent and receipt altered/missing controls passed.",
  );
} finally {
  await rm(baseline, { recursive: true, force: true });
}
