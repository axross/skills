// Exit-code and reporting contract for check-glossary.mjs.
//
// Documented contract: 0 when every spec has a matching heading, or there is no
// corpus and no specs/; 1 on findings; 2 on a bad invocation.
//
// The one-way correspondence is asserted in both directions on purpose. A spec
// without a heading is a finding; a heading without a spec is not, because
// cross-cutting vocabulary belongs to no single domain and a domain may be named
// before its behaviour is written down. A future change that "tidied" this into
// a symmetric check would need an exception list for both cases, and the test
// that fails is the one saying why.

import { describe, expect, it } from "vitest";

import { tempDir, writeCorpus } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkGlossary = validator(SCRIPTS.checkGlossary);

describe("check-glossary.mjs", () => {
  it("pairs a spec with its heading on a slug", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "glossary.md": "# Glossary\n\n## Job Templates\n\n**Job Template** — a definition.\n",
      "specs/job-templates.md": "# Job Templates\n",
    });

    expect(checkGlossary(docs)).toPassCleanly();
  });

  it("reports a spec with no matching heading", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "glossary.md": "# Glossary\n\n## Jobs\n\n**Job** — one run.\n",
      "specs/jobs.md": "# Jobs\n",
      "specs/billing.md": "# Billing\n",
    });

    expect(checkGlossary(docs)).toReportFailure(
      /glossary: specs\/billing\.md has no matching heading/,
    );
  });

  it("allows a heading that no spec owns", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "glossary.md": "# Glossary\n\n## Jobs\n\n**Job** — one run.\n\n## Tenancy\n\n**Tenant** — an org.\n",
      "specs/jobs.md": "# Jobs\n",
    });

    expect(checkGlossary(docs)).toPassCleanly();
  });

  it("reports a missing glossary once, not once per spec", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "specs/jobs.md": "# Jobs\n",
      "specs/billing.md": "# Billing\n",
    });

    const result = checkGlossary(docs);

    expect(result).toReportFailure(/glossary\.md is missing/);
    expect(result.stdout).toMatch(/has 1 finding\./);
  });

  it("reports a nested spec, which has no single heading to pair with", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "glossary.md": "# Glossary\n\n## Billing\n\n**Invoice** — a statement.\n",
      "specs/billing/invoices.md": "# Invoices\n",
    });

    expect(checkGlossary(docs)).toReportFailure(/nested: specs\/billing\/invoices\.md is nested/);
  });

  it("exits 0 when the corpus has no specs/", async () => {
    const docs = await writeCorpus(await tempDir(), { "overview.md": "# Overview\n" });

    const result = checkGlossary(docs);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/No specs\//);
  });

  it("exits 0 on a directory that has no index.md", async () => {
    const docs = await writeCorpus(await tempDir(), {
      "index.md": null,
      "specs/unrelated.md": "# Something else entirely\n",
    });

    expect(checkGlossary(docs)).toPassCleanly();
  });
});
