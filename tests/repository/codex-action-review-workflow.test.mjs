import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";

const WORKFLOW = ".github/workflows/codex-action-review.yaml";
const readWorkflow = () => readFile(repoPath(WORKFLOW), "utf8");

function jobBlock(workflow, name, nextName) {
  const start = workflow.indexOf(`  ${name}:\n`);
  const end = nextName
    ? workflow.indexOf(`  ${nextName}:\n`, start + 1)
    : workflow.length;
  if (start < 0 || end < 0) throw new Error(`missing workflow job ${name}`);
  return workflow.slice(start, end);
}

function tableRow(markdown, input) {
  const row = markdown
    .split("\n")
    .find((line) => line.startsWith(`| ${input}`));
  if (!row) throw new Error(`missing walkthrough row: ${input}`);
  return row;
}

describe("Codex Action review admission", () => {
  it("uses only issue_comment created events and exact command equality", async () => {
    const workflow = await readWorkflow();

    expect(workflow).toContain("  issue_comment:\n    types: [created]");
    expect(workflow).toContain(
      "github.event.comment.body == '/codex-action-review'",
    );
    expect(workflow).not.toContain("contains(github.event.comment.body");
    expect(workflow).toContain("github.event.issue.pull_request");
  });

  it("requires explicit production enablement, a model, and a trusted actor", async () => {
    const workflow = await readWorkflow();
    const review = jobBlock(workflow, "review", "publish");

    expect(review).toContain("vars.CODEX_ACTION_REVIEW_ENABLED == 'true'");
    expect(review).toContain("vars.CODEX_ACTION_REVIEW_MODEL != ''");
    for (const association of ["OWNER", "MEMBER", "COLLABORATOR"]) {
      expect(review).toContain(`author_association == '${association}'`);
    }
    expect(review).toContain("!endsWith(github.actor, '[bot]')");
    expect(review).toContain(
      "github.actor == vars.CODEX_ACTION_REVIEW_ALLOWED_BOT",
    );
    expect(review).not.toMatch(/ALLOWED_BOT[^\n]*\*/u);
  });

  it("serializes review requests per pull request without cancelling a running request", async () => {
    const workflow = await readWorkflow();

    expect(workflow).toContain(
      "group: codex-action-review-${{ github.event.issue.number }}",
    );
    expect(workflow).toContain("cancel-in-progress: false");
  });
});

describe("Codex Action review trust boundaries", () => {
  it("pins every external action to a full commit SHA", async () => {
    const workflow = await readWorkflow();
    const uses = [...workflow.matchAll(/^\s+uses:\s+([^\s#]+)/gmu)].map(
      (match) => match[1],
    );

    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) {
      expect(action).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/u);
    }
  });

  it("checks out trusted controls and a separate merge snapshot without credentials", async () => {
    const workflow = await readWorkflow();
    const review = jobBlock(workflow, "review", "publish");

    expect(review).toContain("path: trusted-control");
    expect(review).toContain("path: pr-merge");
    expect(review).toContain(
      "ref: refs/pull/${{ github.event.issue.number }}/merge",
    );
    expect(review).toContain("fetch-depth: 2");
    expect(review.match(/persist-credentials: false/gmu)).toHaveLength(2);
    expect(review).toContain(
      "PR_SNAPSHOT_SHA: ${{ steps.pr-checkout.outputs.commit }}",
    );
  });

  it("gives the model job no GitHub write permission and no GitHub token", async () => {
    const workflow = await readWorkflow();
    const review = jobBlock(workflow, "review", "publish");
    const modelStep = review.slice(
      review.indexOf("- name: Review the static snapshot"),
    );

    expect(review).toContain("issues: read");
    expect(review).toContain("pull-requests: read");
    expect(review).not.toContain("issues: write");
    expect(review).not.toContain("pull-requests: write");
    expect(
      modelStep.slice(0, modelStep.indexOf("- name: Validate")),
    ).not.toContain("GITHUB_TOKEN");
  });

  it("uses the pinned read-only, drop-sudo, ephemeral Codex contract", async () => {
    const workflow = await readWorkflow();
    const review = jobBlock(workflow, "review", "publish");

    expect(review).toContain(
      "openai/codex-action@86365089eb2b84e0a8fb0717b304f8bdcb13b20e",
    );
    expect(review).toContain('codex-version: "0.138.0"');
    expect(review).toContain('permission-profile: ":read-only"');
    expect(review).toContain("safety-strategy: drop-sudo");
    expect(review).toContain(`codex-args: '["--ephemeral"]'`);
    expect(review).toContain("working-directory: ${{ env.REVIEW_DIRECTORY }}");
    expect(review).toContain("output-schema-file:");
  });

  it("validates before exposing one sanitized output and always requests cleanup", async () => {
    const workflow = await readWorkflow();
    const review = jobBlock(workflow, "review", "publish");

    expect(review).toContain("payload: ${{ steps.validate.outputs.payload }}");
    expect(review).toContain("id: validate");
    expect(review).toContain(
      "- name: Remove private review inputs\n        if: always()",
    );
    expect(review).not.toContain("actions/upload-artifact");
    expect(review).not.toContain("actions/cache");
    expect(review).not.toContain("GITHUB_STEP_SUMMARY");
    expect(review).not.toContain("pull_request.head.sha");
  });
});

describe("Codex Action publisher boundary", () => {
  it("runs separately with only the sanitized validator payload", async () => {
    const workflow = await readWorkflow();
    const review = jobBlock(workflow, "review", "publish");
    const publish = jobBlock(workflow, "publish");

    expect(publish).toContain("needs: review");
    expect(publish).toContain("needs.review.result == 'success'");
    expect(publish).toContain(
      "SANITIZED_PAYLOAD: ${{ needs.review.outputs.payload }}",
    );
    expect(review).toContain(
      "control_sha: ${{ steps.trusted-checkout.outputs.commit }}",
    );
    expect(publish).toContain("ref: ${{ needs.review.outputs.control_sha }}");
    expect(publish).not.toContain("requirements.sidecar");
    expect(publish).not.toContain("raw-result.json");
    expect(publish).not.toContain("OPENAI_API_KEY");
  });

  it("keeps GitHub write permission in the publisher job alone", async () => {
    const workflow = await readWorkflow();
    const publish = jobBlock(workflow, "publish");

    expect(publish).toContain("issues: write");
    expect(publish).toContain("contents: read");
    expect(publish).not.toContain("contents: write");
  });
});

describe("Codex Action review policy integration", () => {
  it("documents the disabled production gate and snapshot-only evidence", async () => {
    const [operations, policy] = await Promise.all([
      readFile(repoPath("docs/operations/code-review.md"), "utf8"),
      readFile(repoPath("REVIEW.md"), "utf8"),
    ]);

    expect(operations).toContain("CODEX_ACTION_REVIEW_ENABLED");
    expect(operations).toContain(
      "Keep the Codex route disabled until qualification",
    );
    expect(operations).toMatch(
      /does not claim\s+coverage of the pull request's current head/u,
    );
    expect(operations).toMatch(/no\s+start\/end head-equality check/u);
    expect(policy).toContain("## Codex Action Output Exception");
    expect(policy).toContain("Do not map P2 to Nit");
    expect(policy).toMatch(
      /every\s+`findings` or `blocked` Codex result is non-clean/u,
    );
  });

  it("preserves the Claude control-plane route without implicit fallback", async () => {
    const [operations, workflow, delivery] = await Promise.all([
      readFile(repoPath("docs/operations/code-review.md"), "utf8"),
      readFile(repoPath("docs/operations/development-workflow.md"), "utf8"),
      readFile(repoPath("docs/operations/github-delivery.md"), "utf8"),
    ]);

    expect(operations).toContain("Review control-plane changes through Claude");
    expect(operations).toContain("existing `@claude review` route");
    expect(workflow).toMatch(/A host switch MUST recover that\s+selection/u);
    expect(workflow).toContain("grants no automatic fallback to Claude");
    expect(delivery).toContain("MUST equal `/codex-action-review`");
    expect(delivery).toMatch(
      /comment ID, actor,\s+workflow run ID, and run attempt/u,
    );
  });

  it("keeps operation grants scoped across recovery and Action retries", async () => {
    const [delivery, loopState, resumption, operation, migration] =
      await Promise.all([
        readFile(repoPath("docs/operations/github-delivery.md"), "utf8"),
        readFile(
          repoPath(
            "skills/loop-engineering/references/run-state-and-reporting.md",
          ),
          "utf8",
        ),
        readFile(
          repoPath(
            "skills/loop-engineering/references/resuming-and-handoff.md",
          ),
          "utf8",
        ),
        readFile(
          repoPath(
            "skills/github-operation/references/publication-and-recovery.md",
          ),
          "utf8",
        ),
        readFile(repoPath("docs/operations/loop-migration.md"), "utf8"),
      ]);

    expect(loopState).toContain("## Scoped Operation Grants");
    expect(loopState).toContain("carry a matching grant forward");
    expect(loopState).toMatch(
      /MUST NOT bind a grant to an exact material revision/u,
    );
    expect(resumption).toContain("every proposed resumed effect");
    expect(delivery).toContain("| Authorization");
    expect(delivery).toContain("API-billed model execution");
    expect(delivery).toContain("remaining requests through");
    expect(delivery).toMatch(/do not remove other substantive\s+material/u);
    expect(delivery).toMatch(
      /publisher failure also leaves the\s+model result/u,
    );
    expect(operation).toContain("change-loop operation-grant scope");
    expect(operation).not.toMatch(
      /grant's operations, target, route, lifetime/u,
    );
    expect(operation).toContain("still-valid grant authorizes another attempt");
    expect(migration).toContain("Grant covers draft publication");
    expect(migration).toContain("Compound grant names draft updates");
    expect(migration).toContain("Mutable bot summary identifies an older");
  });

  it("retains terminal handoff substance without turning it into later review input", async () => {
    const [preflight, migration] = await Promise.all([
      readFile(
        repoPath(
          "skills/loop-engineering/references/pre-flight-review.md",
        ),
        "utf8",
      ),
      readFile(repoPath("docs/operations/loop-migration.md"), "utf8"),
    ]);
    const handoff = preflight.slice(
      preflight.indexOf("## Deferred Handoff"),
      preflight.indexOf("## Round Cap"),
    );

    expect(handoff).toMatch(
      /deferred finding's ID, severity, citation, claim, suggested fix/u,
    );
    expect(handoff).toMatch(/decision reason, and supporting evidence/u);
    expect(handoff).toMatch(
      /advisory round, reviewed material identity, and human-decision evidence/u,
    );
    expect(handoff).toMatch(
      /MUST NOT provide the substantive handoff, its findings, or its dispositions as input to a later fresh advisory review or use it as replacement input for mandatory external review/u,
    );
    expect(handoff).toMatch(
      /MUST report a missing substantive record after interruption as unavailable evidence and preserve only verified decision and process facts/u,
    );
    expect(handoff).toMatch(
      /Never reconstruct lost finding substance or treat the gap as permission for a new review round/u,
    );
    expect(migration).toContain("| Deferred handoff");
    const missingEvidence = tableRow(
      migration,
      "Substantive handoff evidence is missing after interruption",
    );
    expect(missingEvidence).toMatch(
      /report unavailable evidence, preserve verified facts/u,
    );
    expect(missingEvidence).toMatch(
      /do not reconstruct finding substance, and do not infer permission for a new round/u,
    );
    expect(missingEvidence).not.toMatch(/(?:complete|success)/u);
  });

  it("keeps authorized Issue publication separate from PR projection and unpublished delivery", async () => {
    const delivery = await readFile(
      repoPath("docs/operations/github-delivery.md"),
      "utf8",
    );
    const handoff = delivery.slice(
      delivery.indexOf("## Publish deferred pre-flight handoffs"),
      delivery.indexOf("For a status-only read"),
    );

    expect(handoff).toMatch(
      /MUST publish one `<!-- ai-agent -->` tracking-Issue comment for each informed decline when that effect is authorized/u,
    );
    expect(handoff).toMatch(/MUST retain in that comment the advisory round/u);
    expect(handoff).toMatch(
      /MUST put only the publication-safe projection in the draft PR's \*\*Risks and breaking changes\*\* section/u,
    );
    expect(handoff).toMatch(
      /MUST treat the Issue comment and PR updates as separate effects/u,
    );
    expect(handoff).toMatch(
      /Without authorization, retain the full ledger in the current permitted internal handoff/u,
    );
    expect(handoff).toMatch(/report its substance and the exact blocked effects/u);
    expect(handoff).toMatch(/keep delivery incomplete/u);

    const migration = await readFile(
      repoPath("docs/operations/loop-migration.md"),
      "utf8",
    );
    const bothEffects = tableRow(
      migration,
      "Human declines another advisory round; both publication effects authorized",
    );
    expect(bothEffects).toMatch(/Remaining findings become deferred/u);
    expect(bothEffects).toMatch(
      /a marked Issue comment preserves the substantive handoff/u,
    );
    expect(bothEffects).toMatch(/draft PR carries only its safe projection/u);
    expect(bothEffects).not.toMatch(/(?:become|mark(?:ed)?) fixed/u);

    const issueOnly = tableRow(
      migration,
      "Issue-comment publication is authorized but PR update is not",
    );
    expect(issueOnly).toMatch(/Publish the marked substantive handoff/u);
    expect(issueOnly).toMatch(
      /report the blocked PR projection and keep delivery incomplete/u,
    );
    expect(issueOnly).toMatch(/the two effects do not share authorization/u);
    expect(issueOnly).not.toMatch(/publish the PR projection/iu);

    const prOnly = tableRow(
      migration,
      "PR update is authorized but Issue-comment publication is not",
    );
    expect(prOnly).toMatch(/Publish the safe PR projection only/u);
    expect(prOnly).toMatch(/retain the full ledger in the internal handoff/u);
    expect(prOnly).toMatch(
      /report the unpublished substantive comment as the blocked effect and keep delivery incomplete/u,
    );
    expect(prOnly).toMatch(
      /where no valid substantive-record locator exists, disclose that limitation instead of inventing one/u,
    );
    expect(prOnly).not.toMatch(
      /publish(?:es|ing)? the (?:marked )?substantive/iu,
    );
    expect(prOnly).not.toMatch(/blocked PR (?:projection|update)/u);
    expect(prOnly).not.toMatch(
      /block(?:s|ing|ed)? (?:every|both|all) effect/iu,
    );
    expect(prOnly).not.toMatch(/delivery (?:is )?complete\b/u);
    expect(prOnly).not.toMatch(/https?:\/\//u);

    const neitherEffect = tableRow(
      migration,
      "Neither deferred-handoff publication effect is authorized",
    );
    expect(neitherEffect).toMatch(/Preserve the full internal handoff/u);
    expect(neitherEffect).toMatch(
      /report its substance and both blocked effects, and keep delivery incomplete/u,
    );
    expect(neitherEffect).toMatch(
      /an orb-local artifact is not a durable substitute/u,
    );
    expect(neitherEffect).not.toMatch(/delivery (?:is )?complete\b/u);
  });

  it("withholds unsafe projections and routes lost evidence to Loop recovery", async () => {
    const delivery = await readFile(
      repoPath("docs/operations/github-delivery.md"),
      "utf8",
    );
    const handoff = delivery.slice(
      delivery.indexOf("## Publish deferred pre-flight handoffs"),
      delivery.indexOf("For a status-only read"),
    );

    expect(handoff).toMatch(
      /Never quote, summarize or paraphrase Issue text or expected behavior/u,
    );
    expect(handoff).toMatch(/or a valid locator is unavailable/u);
    expect(handoff).toMatch(/publish only the available locators and limitation/u);
    expect(handoff).toMatch(/MUST NOT use the Codex Action result marker/u);
    expect(handoff).toMatch(/feed the tracking-Issue comment to a fresh advisory assignment/u);
    expect(handoff).toMatch(/treat the comment as replacement Action input/u);
    expect(handoff).toMatch(/Public readability does not imply reviewer invisibility/u);
    expect(handoff).toMatch(/an orb-local artifact is not a durable substitute/u);
    expect(handoff).toContain(
      "[Deferred Handoff](../../skills/loop-engineering/references/pre-flight-review.md#deferred-handoff)",
    );
    expect(handoff).not.toMatch(/reconstruct lost finding substance/u);
    expect(handoff).not.toMatch(/permission for a new review round/u);

    const migration = await readFile(
      repoPath("docs/operations/loop-migration.md"),
      "utf8",
    );
    const unsafeProjection = tableRow(
      migration,
      "Substantive canary `violet-otter`; PR projection repeats it or paraphrases it as `purple-mustelid`",
    );
    expect(unsafeProjection).toMatch(/Withhold both unsafe forms/u);
    expect(unsafeProjection).toMatch(
      /use only code\/process observations and valid locators/u,
    );
    expect(unsafeProjection).toMatch(
      /report the limitation when no valid locator is available/u,
    );
    expect(unsafeProjection.split("|")[2]).not.toMatch(
      /violet-otter|purple-mustelid/u,
    );
  });
});
