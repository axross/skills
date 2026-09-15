// exit-code and reporting contract for check-index.mjs.
//
// documented contract: 0 when every document is listed or the project has no
// docs/ tree, 1 on findings, 2 on a bad invocation.
//
// the no-docs case gets its own test rather than riding along with the others.
// it is the property that keeps installing this skill from turning red a `docs/`
// directory holding something else entirely, and it is the one a refactor of the
// docs loader would break without any other assertion noticing.

import { describe, expect, it } from "vitest";

import { tempDir, writeDocs } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkIndex = validator(SCRIPTS.checkIndex);

describe("check-index.mjs", () => {
  it("exits 0 when every document is listed", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": "# Docs\n\n- [Notes](./notes.md) — the product\n",
      "notes.md": "# Notes\n",
    });

    expect(checkIndex(docs)).toPassCleanly();
  });

  it("reports a document the index does not list", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": "# Docs\n\n- [Notes](./notes.md) — the product\n",
      "notes.md": "# Notes\n",
      "specs/billing.md": "# Billing\n",
    });

    expect(checkIndex(docs)).toReportFailure(
      /unindexed: specs\/billing\.md is not linked from index\.md/,
    );
  });

  it("reports a document under any body the index does not list", async () => {
    // every body is checked the same way: there is no exempt directory, which
    // is what the removal of the decision log left behind.
    const docs = await writeDocs(await tempDir(), {
      "index.md": "# Docs\n\n- [Notes](./notes.md) — the product\n",
      "notes.md": "# Notes\n",
      "conventions/testing.md": "# Testing\n",
      "operations/deployment.md": "# Deployment\n",
    });

    const result = checkIndex(docs);

    expect(result).toReportFailure(/unindexed: conventions\/testing\.md/);
    expect(result.stdout).toMatch(/unindexed: operations\/deployment\.md/);
  });

  it("exits 0 on a directory that has no index.md", async () => {
    const docs = await writeDocs(await tempDir(), {
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
    expect(result.stdout).toMatch(/check-glossary\.mjs/);
  });
});
