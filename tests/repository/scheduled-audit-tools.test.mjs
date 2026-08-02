// Network-reaching audits must stay out of the merge gates.
//
// This is the sibling of reporting-tools.test.mjs, and it is a SEPARATE file
// rather than a fourth entry there on purpose. That file's invariant is that its
// three tools cannot fail — no threshold, an undecidable defect, and
// non-determinism — and it asserts exactly that by running each one and
// requiring exit 0. The link-freshness audit can and should fail: a dead link is
// a fact, it is decidable, and it is repairable. Folding a can-fail auditor into
// that list would either break its exit-0 assertion or quietly weaken the claim
// it makes about the other three.
//
// What makes this one dangerous is different, so the guard is different. It
// reaches the NETWORK. Wired into `npm test`, `npm run check`, or
// merge-checks.yaml, every merge in this repository would depend on ~80 external
// publishers being reachable from a GitHub runner — a gate that fails for
// reasons no contributor can fix, which this repository's own argument says gets
// bypassed or deleted rather than repaired.
//
// The second hazard is the one .github/workflows/link-freshness.yaml documents
// at length: a pull-request trigger would point a URL-dereferencing job at text
// an outside contributor controls, handing back exactly the capability
// claude-review.yaml denies against an untrusted head. The trigger assertion
// below is the mechanical half of that argument.
//
// A grep proves these today; this file proves them on every run.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";
import { GATES } from "./gates.mjs";

/**
 * @typedef {object} ScheduledAudit
 * @property {string} script    repository-relative path to the script
 * @property {string} needle    the string any wiring of it would contain
 * @property {string} workflow  the ONE workflow allowed to name it
 */

/** @type {ScheduledAudit[]} */
const SCHEDULED_AUDITS = [
  {
    script: SCRIPTS.linkFreshness,
    // Matched by PATH, not basename: "check.mjs" alone is generic enough to
    // collide with unrelated text and would make the assertions meaningless.
    //
    // The audit now ships inside agent-skill-authoring, so this path also
    // appears under `.claude/skills/` as an installed copy. That is harmless
    // here on purpose: every sweep below reads .github/workflows, package.json,
    // .claude/hooks, and the gate registry — never the installed skill tree — so
    // a copy of the SCRIPT can never be mistaken for a WIRING of it.
    needle: "skills/agent-skill-authoring/scripts/link-freshness/check.mjs",
    workflow: "link-freshness.yaml",
  },
];

/** Triggers that expose a workflow to content an outside contributor controls. */
const FORBIDDEN_TRIGGERS = ["pull_request", "pull_request_target"];

/** Every file under `dir`, as absolute paths. */
async function filesUnder(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

/** A workflow's `on:` block, as raw text — everything up to the next top-level key. */
async function triggerBlockOf(workflow) {
  const yaml = await readFile(repoPath(".github/workflows", workflow), "utf8");
  const match = yaml.match(/^on:\n([\s\S]*?)(?=^\S)/m);
  if (!match) throw new Error(`No 'on:' block found in ${workflow}`);
  return match[1];
}

describe("network-reaching audits are not gates", () => {
  it.each(SCHEDULED_AUDITS)(
    "runs $script from exactly its own workflow",
    async (audit) => {
      const naming = [];
      for (const path of await filesUnder(repoPath(".github/workflows"))) {
        const yaml = await readFile(path, "utf8");
        if (yaml.includes(audit.needle)) {
          naming.push(path.slice(path.lastIndexOf("/") + 1));
        }
      }

      // Stronger than "appears nowhere": it must appear in EXACTLY one, so
      // neither wiring it into a gating workflow nor quietly losing its own
      // trigger can pass unnoticed.
      expect(
        naming.sort(),
        `${audit.script} must be invoked by ${audit.workflow} and by no other workflow`,
      ).toEqual([audit.workflow]);
    },
  );

  it.each(SCHEDULED_AUDITS)(
    "keeps $script out of the merge-gating workflow specifically",
    async (audit) => {
      // Named separately from the sweep above because this is the assertion that
      // actually matters: merge-checks.yaml is what blocks a pull request.
      const yaml = await readFile(
        repoPath(".github/workflows/merge-checks.yaml"),
        "utf8",
      );
      expect(
        yaml,
        `${audit.script} would make every merge depend on ~80 external publishers being reachable`,
      ).not.toContain(audit.needle);
    },
  );

  it.each(SCHEDULED_AUDITS)("keeps $script out of every npm script", async (audit) => {
    const packageJson = JSON.parse(await readFile(repoPath("package.json"), "utf8"));

    for (const [scriptName, command] of Object.entries(packageJson.scripts)) {
      expect(
        command,
        `npm script "${scriptName}" invokes a network-reaching audit, which would make it non-deterministic and offline-hostile`,
      ).not.toContain(audit.needle);
    }
  });

  it.each(SCHEDULED_AUDITS)("keeps $script out of every hook", async (audit) => {
    for (const path of await filesUnder(repoPath(".claude/hooks"))) {
      const source = await readFile(path, "utf8");
      expect(
        source,
        `${path} invokes a network-reaching audit, which would stall a session on other people's servers`,
      ).not.toContain(audit.needle);
    }
  });

  it.each(SCHEDULED_AUDITS.map((audit) => audit.script))(
    "keeps %s out of the gate registry",
    (script) => {
      expect(
        GATES.map((entry) => entry.script),
        "a network-reaching audit registered as a gate would run inside `npm test`",
      ).not.toContain(script);
    },
  );
});

describe("the link-freshness workflow's trigger", () => {
  it.each(SCHEDULED_AUDITS)(
    "gives $workflow no pull-request trigger of any kind",
    async (audit) => {
      const triggers = await triggerBlockOf(audit.workflow);

      // THE security property, not a style preference. A job that dereferences
      // every URL in the tree, triggered by a pull request, dereferences URLs an
      // outside contributor just wrote — server-side request forgery with this
      // repository's egress, reachable by anyone who can open a pull request.
      for (const trigger of FORBIDDEN_TRIGGERS) {
        expect(
          triggers,
          `${audit.workflow} must never be triggered by ${trigger}: it fetches every URL in the tree, and a pull request head is attacker-controlled text`,
        ).not.toContain(trigger);
      }
    },
  );

  it.each(SCHEDULED_AUDITS)(
    "runs $workflow on a schedule, so it only ever probes merged content",
    async (audit) => {
      expect(await triggerBlockOf(audit.workflow)).toContain("schedule:");
    },
  );

  it.each(SCHEDULED_AUDITS)("gives $workflow a read-only token", async (audit) => {
    const yaml = await readFile(
      repoPath(".github/workflows", audit.workflow),
      "utf8",
    );
    const permissions = yaml.match(/^permissions:\n([\s\S]*?)(?=^\S)/m);

    expect(permissions, `${audit.workflow} must declare a permissions block`).not.toBeNull();
    // It comments nothing, opens nothing, and pushes nothing. Anything beyond
    // `contents: read` is a capability it has no use for.
    expect(permissions[1].trim()).toBe("contents: read");
  });
});

describe("the link-freshness audit's offline path", () => {
  it("exits 0 from --dry-run without making a request", () => {
    // The audit itself needs a network, so its contract is asserted on the one
    // path that does not. This is also what keeps the suite offline: no test in
    // this repository probes a URL.
    const result = runScript(SCRIPTS.linkFreshness, ["--dry-run"]);

    expect(result).toPassCleanly();
    expect(result.stdout).toContain("No network request was made.");
  });
});
