// Exit-code and reporting contract for check-index.mjs.
//
// Documented contract: 0 when every document is listed or the project has no
// corpus, 1 on findings, 2 on a bad invocation.
//
// The no-corpus case gets its own test rather than riding along with the others.
// It is the property that keeps installing this skill from turning red a `docs/`
// directory holding something else entirely, and it is the one a refactor of the
// corpus loader would break without any other assertion noticing.

import { describe, expect, it } from "vitest";

import { tempDir, writeCorpus } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkIndex = validator(SCRIPTS.checkIndex);

describe("check-index.mjs", () => {
  it("exits 0 when every document is listed", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": "# Docs\n\n- [Overview](./overview.md) — the product\n",
      "overview.md": "# Overview\n",
    });

    expect(checkIndex(docs)).toPassCleanly();
  });

  it("reports a document the index does not list", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": "# Docs\n\n- [Overview](./overview.md) — the product\n",
      "overview.md": "# Overview\n",
      "specs/billing.md": "# Billing\n",
    });

    expect(checkIndex(docs)).toReportFailure(
      /unindexed: specs\/billing\.md is not linked from index\.md/,
    );
  });

  it("reports a decision log the index never links", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "decisions/2026-07-02-use-a-queue.md": "---\nstatus: accepted\n---\n",
    });

    expect(checkIndex(docs)).toReportFailure(/decisions\/ is not linked from index\.md/);
  });

  it("does not require an individual decision record to be indexed", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": "# Docs\n\n- [Decisions](./decisions/) — the log\n",
      "decisions/2026-07-02-use-a-queue.md": "---\nstatus: accepted\n---\n",
      "decisions/2026-08-01-shard-the-queue.md": "---\nstatus: accepted\n---\n",
    });

    expect(checkIndex(docs)).toPassCleanly();
  });

  it("exits 0 on a directory that has no index.md", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": null,
      "specs/unrelated.md": "# Something else entirely\n",
    });

    const result = checkIndex(docs);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/Nothing to check/);
  });

  it("exits 2 on a bad invocation", () => {
    expect(checkIndex("one", "two")).toExitWith(2);
    expect(checkIndex("--nope")).toExitWith(2);
  });

  it("exits 0 on --help and names its siblings", () => {
    const result = checkIndex("--help");

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/check-decision-supersede\.mjs/);
  });
});
