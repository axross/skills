import MarkdownIt from "markdown-it";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { runValidation } from "../../skills/agent-skill-authoring/scripts/markdownlint/run.mjs";

vi.mock(import("node:path"), async (importOriginal) => {
  const path = await importOriginal();
  return { ...path, ...path.win32 };
});

// CLI2 v0.23.3 normalizes its base directory but not nonFileContents keys,
// and formats findings with path.posix.relative. this boundary fake uses the
// real markdownlint engine/rules; it does not qualify a native Windows run.
vi.mock(import("markdownlint-cli2"), () => ({
  async main({ directory, nonFileContents, optionsOverride }) {
    const { lint } = await import("markdownlint-cli2/markdownlint/promise");
    const { posix } = await import("node:path");
    const baseDir = directory.split("\\").join("/");
    const errors = await lint({ ...optionsOverride, strings: nonFileContents, handleRuleFailures: false });
    const results = Object.entries(errors).flatMap(([path, findings]) => findings.map((finding) => ({ ...finding, fileName: posix.relative(baseDir, path) })));
    await optionsOverride.outputFormatters[0][0]({ results });
    return results.length ? 1 : 0;
  },
}));

describe("runValidation() Windows path-semantics simulation", () => {
  it.each([
    "C:\\workspace\\probe-skill",
    "C:\\outside\\probe-skill",
    "D:\\outside\\probe-skill",
  ])("retains native context keys, coverage and both-pass findings (%s)", async (skillDir) => {
    const cwd = vi.spyOn(process, "cwd").mockReturnValue("C:\\workspace");
    onTestFinished(() => cwd.mockRestore());
    const path = `${skillDir}\\SKILL.md`;
    const source = "name: probe-skill\ndescription: 42\n";
    const body = "# Probe \n\n~~~\n";
    const raw = `---\n${source}---\n${body}`;
    const context = { roots: [skillDir], documents: new Map([[path, {
      path, kind: "skill", skillDir, raw, bytes: Buffer.from(raw),
      frontmatter: { source, body, bodyOffset: 4 }, bodyOffset: 4,
      tokens: new MarkdownIt().parse(body, {}),
    }]]) };
    const result = await runValidation(context, { standardConfig: { default: false, MD009: true } });
    expect(result).toMatchObject({ code: 1, documents: [path], rules: ["AS001", "AS010"], failures: [] });
    expect(result.findings.map((finding) => finding.ruleNames[0]).sort()).toEqual(["AS001", "AS010", "MD009"]);
    expect(result.findings.map((finding) => finding.path)).toEqual([path, path, path]);
  });
});
