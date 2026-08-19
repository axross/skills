// nine script-judgment branches that used to signal "I could not judge this"
// by exiting non-zero, when what they had actually found was an unmet
// expectation — the material a factor reads was there, and what its judgment
// looked for simply was not in it. docs/specs/skill-evaluation.md, "The
// factor", states the line this file holds each branch to: that shape is a
// real `false`, not an error, and an error stays reserved for a judgment a
// script genuinely could not make — the material itself missing, unreadable,
// or internally inconsistent, or something the judgment's own recognizer
// cannot classify either way.
//
// each FALSE_CONDITIONS row below materializes the minimum workspace one
// scenario script actually reads — never the mock its scenario declares, and
// never the reconstructed-workspace machinery under tools/evaluation/src/ —
// and asserts the two things every one of these branches must now do:
// `{"result": false, "evidence": …}` on stdout, and a zero exit. Two of the
// eleven rows below are two shapes of the same table condition
// (confirm-a-draft-save-like-a-publish-does's check-function-contains.mjs
// errors on either marker going missing), so eleven rows cover the nine
// conditions the issue's own table names.
//
// ERROR_CONDITIONS is the other half of the same claim: a genuine error path
// this change deliberately leaves alone — the material itself absent, or a
// context file that will not parse, or a block whose own shape this reader
// cannot close — still exits non-zero. A regression that flattened one of
// those into `false` too would be exactly the mistake this file exists to
// catch in the other direction.
//
// every script under test here is invoked the same way a real judgment run
// invokes it: as a child process, with the reconstructed workspace as its
// cwd and a context.json file as its one argument — see runScript in
// tests/helpers/run.mjs. nothing here imports the scripts, so this exercises
// the same process boundary tools/evaluation/src/factor-judgment.mjs's own
// runScriptJudgment does.

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { runScript } from "../helpers/run.mjs";

const VITEST_CONFIG_BROWSER_ONLY = `export default {
  test: {
    projects: [
      { test: { name: "browser", include: ["src/**/*.browser.test.tsx"] } },
    ],
  },
};
`;

const VITEST_CONFIG_UNIT_ONLY = `export default {
  test: {
    projects: [
      { test: { name: "unit", include: ["src/**/*.test.ts"] } },
    ],
  },
};
`;

/**
 * materialize `condition.workspace` under a fresh temp directory, write
 * `condition.context` beside it as context.json, and run
 * `condition.scenario`'s `condition.script` against that workspace exactly
 * as a real judgment would — cwd set to the workspace, the context file's
 * path as the script's one argument.
 *
 * @param {{
 *   scenario: string,
 *   script: string,
 *   workspace?: Record<string, string>,
 *   context?: unknown,
 * }} condition
 */
async function runScenarioScript({ scenario, script, workspace = {}, context = {} }) {
  const dir = await tempDir();
  for (const [relativePath, content] of Object.entries(workspace)) {
    await writeFileIn(dir, relativePath, content);
  }
  const contextPath = await writeFileIn(dir, "context.json", JSON.stringify(context));
  const scriptPath = `tools/evaluation/scenarios/${scenario}/scripts/${script}`;
  return runScript(scriptPath, [contextPath], { cwd: dir });
}

/**
 * @typedef {object} FalseCondition
 * @property {string} name
 * @property {string} scenario
 * @property {string} script
 * @property {Record<string, string>} [workspace]
 * @property {unknown} [context]
 * @property {RegExp} evidence a pattern the reported evidence must match
 */

/** @type {FalseCondition[]} */
const FALSE_CONDITIONS = [
  {
    name: 'document-a-rollback-someone-can-follow / check-rollback-lead-in.mjs: the "Rolling back" section carries no ordered list to introduce',
    scenario: "document-a-rollback-someone-can-follow",
    script: "check-rollback-lead-in.mjs",
    workspace: {
      "docs/deployment.md": "# Deployment\n\n## Rolling back\n\nRedeploy the previous commit's build.\n",
    },
    evidence: /carries no ordered list/,
  },
  {
    name: 'document-a-rollback-someone-can-follow / check-rollback-lead-in.mjs: docs/deployment.md has no "## Rolling back" heading',
    scenario: "document-a-rollback-someone-can-follow",
    script: "check-rollback-lead-in.mjs",
    workspace: {
      "docs/deployment.md": "# Deployment\n\n## Reverting a deploy\n\nRedeploy the previous commit's build.\n",
    },
    evidence: /no longer has a .*Rolling back.* heading/,
  },
  {
    name: 'document-a-rollback-someone-can-follow / check-rollback-ordered-list.mjs: docs/deployment.md has no "## Rolling back" heading',
    scenario: "document-a-rollback-someone-can-follow",
    script: "check-rollback-ordered-list.mjs",
    workspace: {
      "docs/deployment.md": "# Deployment\n\n## Reverting a deploy\n\nRedeploy the previous commit's build.\n",
    },
    evidence: /no longer has a .*Rolling back.* heading/,
  },
  {
    name: "give-the-empty-post-list-a-real-empty-state / check-css-property-group-order.mjs: the touched CSS Module's added lines carry no declaration the reference places in a group",
    scenario: "give-the-empty-post-list-a-real-empty-state",
    script: "check-css-property-group-order.mjs",
    context: {
      material: {
        diff:
          "diff --git a/src/components/Card.module.css b/src/components/Card.module.css\n" +
          "--- a/src/components/Card.module.css\n" +
          "+++ b/src/components/Card.module.css\n" +
          "@@ -1,3 +1,4 @@\n" +
          " .card {\n" +
          "+  box-shadow: 0 0 0 1px red;\n" +
          " }\n",
      },
    },
    evidence: /contain no declaration this reference places in a group/,
  },
  {
    name: "bring-the-analytics-event-names-into-one-scheme / check-call-site-event-names.mjs: no trackEvent( call with a literal first argument in the named files",
    scenario: "bring-the-analytics-event-names-into-one-scheme",
    script: "check-call-site-event-names.mjs",
    workspace: {
      "src/routes/PostEditorPage.tsx": "export function PostEditorPage() {\n  return null;\n}\n",
      "src/routes/Layout.tsx": "export function Layout() {\n  return null;\n}\n",
    },
    context: {
      input: {
        files: ["src/routes/PostEditorPage.tsx", "src/routes/Layout.tsx"],
        expectedCount: 3,
      },
    },
    evidence: /contains a trackEvent\( call with a literal first argument/,
  },
  {
    name: 'bring-the-analytics-event-names-into-one-scheme / check-declared-event-names.mjs: the named file declares no "interface Events" block',
    scenario: "bring-the-analytics-event-names-into-one-scheme",
    script: "check-declared-event-names.mjs",
    workspace: {
      "src/lib/analytics.ts": "export function trackEvent(name) {}\n",
    },
    context: {
      input: { file: "src/lib/analytics.ts", interfaceName: "Events", expectedCount: 3 },
    },
    evidence: /declares no "interface Events" block/,
  },
  {
    name: "confirm-a-draft-save-like-a-publish-does / check-function-contains.mjs: the start marker is absent from the named file",
    scenario: "confirm-a-draft-save-like-a-publish-does",
    script: "check-function-contains.mjs",
    workspace: {
      "src/routes/PostEditorPage.tsx": 'export function handlePublish() {\n  setToast("published");\n}\n',
    },
    context: {
      input: {
        file: "src/routes/PostEditorPage.tsx",
        startMarker: "function handleSaveDraft",
        endMarker: "function handlePublish",
        mustContainAll: ["setToast("],
      },
    },
    evidence: /does not contain the start marker/,
  },
  {
    name: "confirm-a-draft-save-like-a-publish-does / check-function-contains.mjs: the end marker after the start marker is absent from the named file",
    scenario: "confirm-a-draft-save-like-a-publish-does",
    script: "check-function-contains.mjs",
    workspace: {
      "src/routes/PostEditorPage.tsx": "export function handleSaveDraft() {\n  // no confirmation yet\n}\n",
    },
    context: {
      input: {
        file: "src/routes/PostEditorPage.tsx",
        startMarker: "function handleSaveDraft",
        endMarker: "function handlePublish",
        mustContainAll: ["setToast("],
      },
    },
    evidence: /does not contain the end marker/,
  },
  {
    name: "keep-the-locale-notes-true-after-changing-the-fallback / check-resolve-translation-guard.mjs: resolveTranslation's start marker is absent from the module",
    scenario: "keep-the-locale-notes-true-after-changing-the-fallback",
    script: "check-resolve-translation-guard.mjs",
    workspace: {
      "shared/resolve-translation.ts": "// resolveTranslation used to live here.\nexport const placeholder = true;\n",
    },
    evidence: /no longer contains "export function resolveTranslation"/,
  },
  {
    name: 'run-the-toast-tests-the-suite-never-collects / check-unit-project-stays-ts-only.mjs: vitest.config.ts has no "unit" project with a locatable include array',
    scenario: "run-the-toast-tests-the-suite-never-collects",
    script: "check-unit-project-stays-ts-only.mjs",
    workspace: {
      "vitest.config.ts": VITEST_CONFIG_BROWSER_ONLY,
    },
    evidence: /no project named "unit"/,
  },
  {
    name: 'run-the-toast-tests-the-suite-never-collects / check-toast-test-reaches-browser-project.mjs: vitest.config.ts has no "browser" project with a locatable include array',
    scenario: "run-the-toast-tests-the-suite-never-collects",
    script: "check-toast-test-reaches-browser-project.mjs",
    workspace: {
      "vitest.config.ts": VITEST_CONFIG_UNIT_ONLY,
      "src/components/PublishToast/PublishToast.tsx": "// no browser test here\n",
    },
    evidence: /no project named "browser"/,
  },
];

describe("a scenario script reports false, not an error, when its material is there but empty", () => {
  it.each(FALSE_CONDITIONS.map((condition) => [condition.name, condition]))(
    "%s",
    async (_name, condition) => {
      const result = await runScenarioScript(condition);

      expect(result.code, `expected exit 0; the script's own output was:\n${result.output}`).toBe(0);

      let parsed;
      expect(() => {
        parsed = JSON.parse(result.stdout);
      }, `stdout did not parse as JSON:\n${result.output}`).not.toThrow();
      expect(parsed.result).toBe(false);
      expect(parsed.evidence).toMatch(condition.evidence);
    },
  );
});

/**
 * @typedef {object} ErrorCondition
 * @property {string} name
 * @property {string} scenario
 * @property {string} script
 * @property {Record<string, string>} [workspace]
 * @property {unknown} [context]
 */

/** @type {ErrorCondition[]} */
const ERROR_CONDITIONS = [
  {
    name: "document-a-rollback-someone-can-follow / check-rollback-lead-in.mjs: docs/deployment.md itself is missing from the workspace",
    scenario: "document-a-rollback-someone-can-follow",
    script: "check-rollback-lead-in.mjs",
  },
  {
    name: "document-a-rollback-someone-can-follow / check-rollback-ordered-list.mjs: docs/deployment.md itself is missing from the workspace",
    scenario: "document-a-rollback-someone-can-follow",
    script: "check-rollback-ordered-list.mjs",
  },
  {
    name: 'bring-the-analytics-event-names-into-one-scheme / check-declared-event-names.mjs: the "interface Events" block never closes',
    scenario: "bring-the-analytics-event-names-into-one-scheme",
    script: "check-declared-event-names.mjs",
    workspace: {
      "src/lib/analytics.ts": "export interface Events {\n  postPublished: string;\n",
    },
    context: {
      input: { file: "src/lib/analytics.ts", interfaceName: "Events", expectedCount: 3 },
    },
  },
];

describe("the genuine error paths beside them stay errors", () => {
  it.each(ERROR_CONDITIONS.map((condition) => [condition.name, condition]))(
    "%s",
    async (_name, condition) => {
      const result = await runScenarioScript(condition);

      expect(result.code, `expected a non-zero exit; the script's own output was:\n${result.output}`).not.toBe(0);
    },
  );

  it("a context file that will not parse as JSON is still a genuine error, not a false result", async () => {
    const dir = await tempDir();
    await writeFileIn(dir, "docs/deployment.md", "# Deployment\n\n## Rolling back\n\nRedeploy.\n");
    const contextPath = await writeFileIn(dir, "context.json", "not json{{{");

    const result = runScript(
      "tools/evaluation/scenarios/document-a-rollback-someone-can-follow/scripts/check-rollback-lead-in.mjs",
      [contextPath],
      { cwd: dir },
    );

    expect(result.code, `expected a non-zero exit; the script's own output was:\n${result.output}`).not.toBe(0);
  });
});
