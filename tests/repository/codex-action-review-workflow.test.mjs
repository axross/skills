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
});
