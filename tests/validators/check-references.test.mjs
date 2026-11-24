// exit-code and reporting contract for check-references.mjs.
//
// documented contract: 0 when every relative link resolves or the project has no
// docs/ tree, 1 on findings, 2 on a bad invocation.
//
// two exclusions are asserted rather than assumed. an external URL is out of
// scope because resolving one needs the network and fails for reasons that have
// nothing to do with docs/; a link inside a fenced block is an example, and
// a checker that followed those would make it impossible to document a link at
// all.

import { symlink } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { tempDir, writeDocs } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkReferences = validator(SCRIPTS.checkReferences);

describe("check-references.mjs", () => {
  it("exits 0 when every relative link resolves", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": "# Docs\n\n- [Jobs](./specs/jobs.md) — scheduling\n",
      "specs/jobs.md":
        "# Jobs\n\nSee [the rules](../conventions/testing.md).\n",
      "conventions/testing.md": "# Testing\n",
    });

    expect(checkReferences(docs)).toPassCleanly();
  });

  it("reports a link that resolves to nothing, with its line", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": "# Docs\n\n- [Jobs](./specs/jobs.md) — scheduling\n",
      "specs/jobs.md": "# Jobs\n\nSee [billing](./billing.md).\n",
    });

    expect(checkReferences(docs)).toReportFailure(
      /link: specs\/jobs\.md:3 → \.\/billing\.md does not resolve/,
    );
  });

  it("reports an index entry whose file is missing", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": "# Docs\n\n- [Notes](./notes.md) — the product\n",
    });

    expect(checkReferences(docs)).toReportFailure(
      /index\.md:3 → \.\/notes\.md/,
    );
  });

  it("ignores external URLs", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": "# Docs\n\nSee [the spec](https://example.invalid/nope).\n",
    });

    expect(checkReferences(docs)).toPassCleanly();
  });

  it("ignores a link inside a fenced block", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": "# Docs\n\n```markdown\n[Example](./not-real.md)\n```\n",
    });

    expect(checkReferences(docs)).toPassCleanly();
  });

  it("exits 0 on a directory that has no index.md", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": null,
      "specs/unrelated.md": "# Broken [link](./gone.md)\n",
    });

    expect(checkReferences(docs)).toPassCleanly();
  });

  it("exits 2 on a bad invocation", () => {
    expect(checkReferences("one", "two")).toExitWith(2);
  });
});

describe("OKF navigation", () => {
  const index = '---\nokf_version: "0.3"\n---\n\n';

  it("keeps an old Markdown heading as a route to the extracted owner", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": index + "[Result](old.md#result)",
      "old.md":
        "## Result\n\n[Moved][owner]\n\n[owner]: /topics/new.md#result-buffer",
      "topics/new.md":
        "## Result `buffer`\n\n[Here](#result-buffer)\n![Plot](../plot%20one.svg)",
      "plot one.svg": "<svg/>",
    });
    expect(checkReferences(docs)).toPassCleanly();
  });

  it("reports an unresolved fragment even when the Markdown file exists", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": index + "[Lost](old.md#result)",
      "old.md": "## Obsolete",
    });
    expect(checkReferences(docs)).toReportFailure(
      /index.md:5 → old.md#result has no matching fragment/,
    );
  });

  it("checks fragments on a directory route against its nested index", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": index + "[Live](topics/#live) · [Broken](topics/#gone)",
      "topics/index.md": "# Live",
    });
    const result = checkReferences(docs);
    expect(result).toReportFailure(/topics\/#gone has no matching fragment/);
    expect(result.stdout).toMatch(/has 1 finding\./);
  });

  it("locates broken table-cell links on their original Markdown lines", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md":
        index +
        "# Docs\n\n| Guide | Source |\n| --- | --- |\n| Setup | [Source](missing.md) |",
    });
    expect(checkReferences(docs)).toReportFailure(
      /index.md:9 → missing.md does not resolve/,
    );
  });

  it("checks local OKF path fields and identifies their original lines", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": index + "# Home",
      "topics/owner.md": [
        "---",
        "type: Attested Computation",
        "resource: ../index.md#home",
        "sources:",
        "  - resource: /index.md#absent",
        "  - resource: all queries in BigQuery project X",
        "  - resource: https://example.invalid/source",
        "computation: ./calc.sql",
        "executor: {resource: ../worker.sh}",
        "attester: {resource: /verify.sh}",
        "superseded_by: /moved.md",
        "---",
      ].join("\n"),
      "topics/calc.sql": "",
      "worker.sh": "",
      "verify.sh": "",
      "moved.md": "",
    });
    const result = checkReferences(docs);
    expect(result).toReportFailure(
      /sources.0.resource: topics\/owner.md:5 → \/index.md#absent has no matching fragment/,
    );
    expect(result.stdout).toContain("has 1 finding.");
  });

  it("reads links inside footnotes and checks singleton source mappings", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": index + "[Owner](owner.md)",
      "owner.md":
        "---\ntype: Definition\nsources: {resource: './index.md#absent'}\n---\nClaim.[^src]\n\n[^src]: [Owner](./owner.md) and [Missing](./missing.md)",
    });
    const result = checkReferences(docs);
    expect(result).toReportFailure(
      /sources.resource: owner.md:3 → .*#absent has no matching fragment/,
    );
    expect(result.stdout).toContain("./missing.md does not resolve");
    expect(result.stdout).toContain("has 2 findings.");
  });

  it("reports aliased path fields at the lines that use them", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": index + "[Owner](owner.md)",
      "owner.md": [
        "---",
        "type: Specification",
        "file: &file missing.md",
        "worker: &worker {resource: *file}",
        "entries: &entries [*worker]",
        "resource: *file",
        "executor: *worker",
        "sources: *entries",
        "---",
      ].join("\n"),
    });
    const result = checkReferences(docs);
    expect(result).toReportFailure(/resource: owner.md:6 → missing.md/);
    expect(result.stdout).toContain(
      "executor.resource: owner.md:7 → missing.md",
    );
    expect(result.stdout).toContain(
      "sources.0.resource: owner.md:8 → missing.md",
    );
  });

  it("rejects direct, encoded and symlinked hidden paths while permitting dot segments", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md":
        index +
        "[Live](topics/.././visible.md) ![hidden](.private.png) [hidden dir](%2Eprivate/page.md) ![alias](asset.png)",
      "topics/guide.md": "# Topic",
      "visible.md": "# Visible",
      ".private.png": "bytes",
      ".private/page.md": "# Private",
    });
    await symlink(".private.png", join(docs, "asset.png"));
    const result = checkReferences(docs);
    expect(result).toReportFailure(
      /.private.png addresses a hidden bundle entry/,
    );
    expect(result.stdout).toContain(
      "%2Eprivate/page.md addresses a hidden bundle entry",
    );
    expect(result.stdout).toContain(
      "asset.png addresses a hidden bundle entry",
    );
    expect(result.stdout).toContain("has 3 findings.");
  });

  it("accepts real HTML anchors and rejects markup inside comments, attributes and raw text", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md":
        index +
        "[Live](owner.md#live) [Named](owner.md#named) [Comment](owner.md#comment) [Data](owner.md#data) [Script](owner.md#script)",
      "owner.md": [
        `<div id=live data-example="<b id='data'>"></div>`,
        "<a name='named'></a>",
        "<!-- <div id='comment'></div> -->",
        `<script>const tag = "<a id='script'>";</script>`,
      ].join("\n\n"),
    });
    const result = checkReferences(docs);
    expect(result).toReportFailure(/#comment has no matching fragment/);
    expect(result.stdout).toContain("#data has no matching fragment");
    expect(result.stdout).toContain("#script has no matching fragment");
    expect(result.stdout).toContain("has 3 findings.");
  });

  it("requires an external source URL for paths leaving the bundle", async () => {
    const docs = await writeDocs(await tempDir(), {
      "index.md": index + "[Source](../README.md)",
    });
    expect(checkReferences(docs)).toReportFailure(/leaves the bundle/);
  });
});
