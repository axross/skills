// exit-code and reporting contract for check-decision-naming.mjs.
//
// documented contract: 0 when every filename conforms, or there is no corpus and
// no decisions/; 1 on findings; 2 on a bad invocation.
//
// the impossible-date case is the reason this check exists at all. a filename
// matching the shape but naming a day that never happened sorts into the log
// wherever the string puts it, and nothing else in the corpus contradicts it —
// which is exactly the failure mode of a date recalled rather than read from the
// environment.

import { describe, expect, it } from "vitest";

import { tempDir, writeCorpus } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkNaming = validator(SCRIPTS.checkDecisionNaming);

describe("check-decision-naming.mjs", () => {
  it("exits 0 when every filename conforms", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "decisions/2026-07-02-move-scheduling-to-a-queue.md": "---\nstatus: accepted\n---\n",
      "decisions/2026-08-01-shard-the-queue.md": "---\nstatus: accepted\n---\n",
    });

    expect(checkNaming(docs)).toPassCleanly();
  });

  it("reports a filename that is not the dated shape", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "decisions/database-choice.md": "---\nstatus: accepted\n---\n",
    });

    expect(checkNaming(docs)).toReportFailure(
      /filename: decisions\/database-choice\.md is not YYYY-MM-DD/,
    );
  });

  it("reports a date that never happened", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "decisions/2026-02-30-use-a-real-date.md": "---\nstatus: accepted\n---\n",
    });

    expect(checkNaming(docs)).toReportFailure(/carries no real date \(2026-02-30\)/);
  });

  it("reports a trailing segment that is not kebab-case", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "decisions/2026-07-02-Use_A_Queue.md": "---\nstatus: accepted\n---\n",
    });

    expect(checkNaming(docs)).toReportFailure(/filename: decisions\/2026-07-02-Use_A_Queue\.md/);
  });

  it("exits 0 when the corpus has no decisions/", async () => {
    const docs = await writeCorpus(await tempDir(), { "overview.md": "# Overview\n" });

    const result = checkNaming(docs);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/No decisions\//);
  });

  it("exits 0 on a directory that has no index.md", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": null,
      "decisions/whatever.md": "# Not a corpus\n",
    });

    expect(checkNaming(docs)).toPassCleanly();
  });

  it("exits 2 on a bad invocation", () => {
    expect(checkNaming("one", "two")).toExitWith(2);
    expect(checkNaming("--nope")).toExitWith(2);
  });
});
