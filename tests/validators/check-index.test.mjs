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

describe("OKF bundle inventory", () => {
  const index = '---\nokf_version: "0.3"\n---\n\n';
  const page = "---\ntype: Service Registry\n---\n\n";

  it("walks index routes from the root, terminating cycles and skipping hidden paths", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": index + "[Services][s]\n\n[s]: /topics/\n",
      "topics/index.md":
        "[Back](/index.md) · [Registry](service%20registry.md)\n",
      "topics/service registry.md": page,
      ".scratch/notes.md": "Outside the bundle.",
    });
    expect(checkIndex(docs)).toPassCleanly();
  });

  it("keeps a disconnected index and its typed member visible as orphans", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": index,
      "lost/index.md": "[Registry](registry.md)",
      "lost/registry.md": page,
    });
    const result = checkIndex(docs);
    expect(result).toReportFailure(/unindexed: lost\/index.md/);
    expect(result.stdout).toMatch(/unindexed: lost\/registry.md/);
  });

  it("warns for the companion's exact evidence path and still fails an untyped living page", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": index + "[Authority](owner.md) · [Rules](rules.md)",
      "owner.md": page + "[Evidence](evidence/raw.md)",
      "evidence/raw.md": "approved bytes",
      "rules.md": "missing metadata",
    });
    const result = checkIndex("--evidence", "evidence/raw.md", docs);
    expect(result).toReportFailure(
      /type: rules.md needs a nonempty string type/,
    );
    expect(result.stdout).toMatch(/WARN +evidence\/raw.md/);
    expect(result.stdout).toMatch(/has 1 finding\./);
    expect(checkIndex("--evidence", "evidence", docs)).toReportFailure(
      /type: evidence\/raw.md/,
    );
  });

  it.each([
    "type: ' '",
    "type: [Service]",
    "type: null",
    "type: true",
    "type: 23",
    "type: A\ntype: B",
  ])("rejects invalid concept metadata %s", async (header) => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": index + "[A](a.md)",
      "a.md": `---\n${header}\n---\n`,
    });
    expect(checkIndex(docs)).toReportFailure(/(?:type|frontmatter): a.md/);
  });
});
