// exit-code and reporting contract for check-references.mjs.
//
// documented contract: 0 when every relative link resolves or the project has no
// corpus, 1 on findings, 2 on a bad invocation.
//
// two exclusions are asserted rather than assumed. an external URL is out of
// scope because resolving one needs the network and fails for reasons that have
// nothing to do with the corpus; a link inside a fenced block is an example, and
// a checker that followed those would make it impossible to document a link at
// all.

import { describe, expect, it } from "vitest";

import { tempDir, writeCorpus } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkReferences = validator(SCRIPTS.checkReferences);

describe("check-references.mjs", () => {
  it("exits 0 when every relative link resolves", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": "# Docs\n\n- [Jobs](./specs/jobs.md) — scheduling\n",
      "specs/jobs.md": "# Jobs\n\nSee [the log](../decisions/).\n",
      "decisions/2026-07-02-use-a-queue.md": "---\nstatus: accepted\n---\n",
    });

    expect(checkReferences(docs)).toPassCleanly();
  });

  it("reports a link that resolves to nothing, with its line", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": "# Docs\n\n- [Jobs](./specs/jobs.md) — scheduling\n",
      "specs/jobs.md": "# Jobs\n\nSee [billing](./billing.md).\n",
    });

    expect(checkReferences(docs)).toReportFailure(
      /link: specs\/jobs\.md:3 → \.\/billing\.md does not resolve/,
    );
  });

  it("reports an index entry whose file is missing", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": "# Docs\n\n- [Overview](./overview.md) — the product\n",
    });

    expect(checkReferences(docs)).toReportFailure(/index\.md:3 → \.\/overview\.md/);
  });

  it("ignores external URLs", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": "# Docs\n\nSee [the spec](https://example.invalid/nope).\n",
    });

    expect(checkReferences(docs)).toPassCleanly();
  });

  it("ignores a link inside a fenced block", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": "# Docs\n\n```markdown\n[Example](./not-real.md)\n```\n",
    });

    expect(checkReferences(docs)).toPassCleanly();
  });

  it("exits 0 on a directory that has no index.md", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": null,
      "specs/unrelated.md": "# Broken [link](./gone.md)\n",
    });

    expect(checkReferences(docs)).toPassCleanly();
  });

  it("exits 2 on a bad invocation", () => {
    expect(checkReferences("one", "two")).toExitWith(2);
  });
});
