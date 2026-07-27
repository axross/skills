// Exit-code contract for check-links.sh, plus the content-skipping rules its
// header documents: links inside fenced code blocks, inline code spans, and HTML
// comments are illustrative and must never be resolved.
//
// Documented contract: 0 when every relative link resolves, 1 when one or more
// are broken.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tempDir, writeFileIn } from "./helpers/fixtures.mjs";
import { SCRIPTS, runShellScript } from "./helpers/run.mjs";

const checkLinks = (...args) => runShellScript(SCRIPTS.checkLinks, args);

describe("check-links.sh", () => {
  it("exits 0 when every relative link resolves", async (t) => {
    const root = await tempDir(t);
    await writeFileIn(root, "target.md", "# Target\n");
    await writeFileIn(root, "source.md", "See [target](./target.md).\n");

    const result = checkLinks(root);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /links OK/);
  });

  it("exits 1 and names the broken link when a target is missing", async (t) => {
    const root = await tempDir(t);
    await writeFileIn(root, "source.md", "See [gone](./missing.md).\n");

    const result = checkLinks(root);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /BROKEN LINKS \(1\)/);
    assert.match(result.stdout, /source\.md -> \.\/missing\.md/);
  });

  it("resolves a link carrying an anchor fragment against the file alone", async (t) => {
    const root = await tempDir(t);
    await writeFileIn(root, "target.md", "# Target\n\n## Section\n");
    await writeFileIn(root, "source.md", "See [x](./target.md#section).\n");

    assert.equal(checkLinks(root).code, 0);
  });

  it("ignores a link inside a fenced code block", async (t) => {
    const root = await tempDir(t);
    await writeFileIn(
      root,
      "source.md",
      ["# Example", "", "```markdown", "[x](./missing.md)", "```", ""].join(
        "\n",
      ),
    );

    assert.equal(checkLinks(root).code, 0);
  });

  it("ignores a link inside an inline code span", async (t) => {
    const root = await tempDir(t);
    await writeFileIn(
      root,
      "source.md",
      "Write it as `[x](./missing.md)` in prose.\n",
    );

    assert.equal(checkLinks(root).code, 0);
  });

  it("ignores a link inside an HTML comment", async (t) => {
    const root = await tempDir(t);
    await writeFileIn(root, "source.md", "<!-- [x](./missing.md) -->\n");

    assert.equal(checkLinks(root).code, 0);
  });

  it("ignores absolute http(s) and mailto targets", async (t) => {
    const root = await tempDir(t);
    await writeFileIn(
      root,
      "source.md",
      "[a](https://example.com/x.md) [b](mailto:someone@example.com)\n",
    );

    assert.equal(checkLinks(root).code, 0);
  });

  it("passes over the repository's own corpus", () => {
    const result = checkLinks();

    assert.equal(result.code, 0, result.output);
    assert.match(result.stdout, /links OK/);
  });
});
