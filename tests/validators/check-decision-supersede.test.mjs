// Exit-code and reporting contract for check-decision-supersede.mjs.
//
// Documented contract: 0 when the chain is sound, or there is no corpus and no
// decisions/; 1 on findings; 2 on a bad invocation.
//
// The stale-reference case is what this command exists for, and its test asserts
// something no link checker can: the link RESOLVES. A fixture whose target was
// missing would pass this test for the wrong reason and would keep passing if
// the status lookup were deleted, so the clean-resolution half is the assertion
// that actually has teeth.

import { describe, expect, it } from "vitest";

import { tempDir, writeCorpus } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkSupersede = validator(SCRIPTS.checkDecisionSupersede);
const checkReferences = validator(SCRIPTS.checkReferences);

const SUPERSEDED = `---
status: superseded
superseded_by: 2026-07-02-use-a-queue.md
---

# Run scheduling in process
`;

const ACCEPTED = "---\nstatus: accepted\n---\n\n# Move scheduling to a queue\n";

describe("check-decision-supersede.mjs", () => {
  it("exits 0 on a sound chain nobody cites stale", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": "# Docs\n\n- [Jobs](./specs/jobs.md) — scheduling\n- [Decisions](./decisions/) — the log\n",
      "specs/jobs.md": "# Jobs\n\nPer [the decision](../decisions/2026-07-02-use-a-queue.md).\n",
      "decisions/2026-03-01-run-in-process.md": SUPERSEDED,
      "decisions/2026-07-02-use-a-queue.md": ACCEPTED,
    });

    expect(checkSupersede(docs)).toPassCleanly();
  });

  it("reports a document citing replaced rationale through a link that still resolves", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "specs/jobs.md": "# Jobs\n\nPer [the decision](../decisions/2026-03-01-run-in-process.md).\n",
      "decisions/2026-03-01-run-in-process.md": SUPERSEDED,
      "decisions/2026-07-02-use-a-queue.md": ACCEPTED,
    });

    // The link is intact — this is precisely the defect no link checker sees.
    expect(checkReferences(docs)).toPassCleanly();
    expect(checkSupersede(docs)).toReportFailure(
      /stale-reference: specs\/jobs\.md:3 → decisions\/2026-03-01-run-in-process\.md was superseded by 2026-07-02-use-a-queue\.md/,
    );
  });

  it("reports a record that declares no status", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "decisions/2026-07-02-use-a-queue.md": "# Move scheduling to a queue\n",
    });

    expect(checkSupersede(docs)).toReportFailure(/frontmatter: .* declares no status/);
  });

  it("reports a record whose status is not one of the two values", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "decisions/2026-07-02-use-a-queue.md": "---\nstatus: proposed\n---\n",
    });

    expect(checkSupersede(docs)).toReportFailure(/has status "proposed"/);
  });

  it("reports superseded_by set while the status still reads as current", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "decisions/2026-03-01-run-in-process.md":
        "---\nstatus: accepted\nsuperseded_by: 2026-07-02-use-a-queue.md\n---\n",
      "decisions/2026-07-02-use-a-queue.md": ACCEPTED,
    });

    expect(checkSupersede(docs)).toReportFailure(/every link to it reads as current/);
  });

  it("reports a superseded record that names no replacement", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "decisions/2026-03-01-run-in-process.md": "---\nstatus: superseded\n---\n",
    });

    expect(checkSupersede(docs)).toReportFailure(/is superseded but names no superseded_by/);
  });

  it("reports a superseded_by naming a record that does not exist", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "decisions/2026-03-01-run-in-process.md": SUPERSEDED,
    });

    expect(checkSupersede(docs)).toReportFailure(
      /supersede-target: .* names superseded_by 2026-07-02-use-a-queue\.md, which is not a decision record/,
    );
  });

  it("exits 0 when the corpus has no decisions/", async () => {
    const docs = await writeCorpus(await tempDir(), { "overview.md": "# Overview\n" });

    const result = checkSupersede(docs);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/No decisions\//);
  });

  it("exits 0 on a directory that has no index.md", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": null,
      "decisions/2026-03-01-run-in-process.md": "---\nstatus: superseded\n---\n",
    });

    expect(checkSupersede(docs)).toPassCleanly();
  });
});
