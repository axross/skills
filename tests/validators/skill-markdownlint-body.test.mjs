import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createContext } from "../../skills/agent-skill-authoring/scripts/markdownlint/context.mjs";
import { runValidation } from "../../skills/agent-skill-authoring/scripts/markdownlint/run.mjs";
import { tempDir, writeFileIn, writeSkill } from "../helpers/fixtures.mjs";
import { runScript } from "../helpers/run.mjs";

const CLI = "skills/agent-skill-authoring/scripts/markdownlint/cli.mjs";
const COMPACT = "The RFC 2119 keywords in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).";
const FULL = 'The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).';
const RULE_SECTION = "## Rules\n\nThis section demonstrates its purpose.\n\n**Guidelines:**\n\n- SHALL preserve output.\n";
const ROUTE = "## Topic\n\nSee [topic.md](./references/topic.md) for:\n\n";

/** exercise a selected public contract using actual captured Markdown and protected CLI2 execution. */
async function check(id, body, { eol = "\n", name = "fixture-skill", ruleConfig = {}, standardConfig = { default: false } } = {}) {
  const dir = await writeSkill(await tempDir(), name, {
    raw: `---\nname: ${name}\ndescription: A body contract fixture.\nwhen_to_use: In the validator tests.\n---\n\n${body}`.replaceAll("\n", eol),
    references: { "topic.md": "# Topic\n\nA substantive reference.\n".replaceAll("\n", eol) },
  });
  const result = await runValidation(await createContext({ skills: [dir] }), { rules: [id], ruleConfig, standardConfig });
  expect(result.failures).toEqual([]);
  expect(result.scope).toBe("partial");
  return result;
}

describe("AS002 title profile", () => {
  it.each([
    ["fixture-skill", "Fixture Skill", 0],
    ["fixture-skill", "Fixture Skill Rules", 1],
    ["end-to-end-testing", "End-to-End Testing", 0],
    ["high-fidelity-ui-design", "High-Fidelity UI Design", 0],
    ["next-app-development", "Next.js App Development", 0],
    ["tanstack-query-development", "TanStack Query Development", 0],
    ["working-with-api-v2", "Working with API V2", 0],
    ["working-with-api-v2", "Working With Api v2", 1],
    ["review-of", "Review Of", 0],
    ["weekend-to-end", "Weekend to End", 0],
    ["rfc-2119-json-yaml-cli", "RFC 2119 JSON YAML CLI", 0],
    ["fixture-skill", "[Fixture Skill](https://example.com)", 1],
    ["fixture-skill", "![Fixture Skill](https://example.com/image.png)", 1],
    ["fixture-skill", "<span>Fixture Skill</span>", 1],
    ["fixture-skill", "`Fixture Skill`", 1],
    ["fixture-skill", "**Fixture** _Skill_", 0],
  ])("renders %s as %s", async (name, title, code) => {
    const result = await check("AS002", `# ${title}\n`, { name });
    expect(result.code).toBe(code);
    if (code) expect(result.findings).toContainEqual(expect.objectContaining({ ruleNames: ["AS002"], lineNumber: 7 }));
  });

  it("does not mistake quoted/fenced headings for the missing parent title", async () => {
    expect((await check("AS002", "> # Fixture Skill\n\n```markdown\n# Fixture Skill\n```\n")).code).toBe(1);
    expect((await check("AS002", "# **Fixture** Skill\n")).code).toBe(0);
  });
});

describe.each(["\n", "\r\n"])("body contracts under %j", (eol) => {
  it.each([
    [COMPACT, 0], [FULL, 0],
    [FULL.replace(/"([^"]+)"/g, '“$1”').replace(' in this', '\n in this'), 0],
    [FULL.replace('"MUST", "MUST NOT"', '"MUST NOT", "MUST"').replace('"SHALL",', '"SHALL", "NOT RECOMMENDED",').replace('https:', 'http:'), 0],
    [FULL.replace('"MUST"', '**"MUST"**'), 0],
    [COMPACT.replace('[RFC 2119]', '[RFC   2119]'), 0],
    [FULL.replace('[RFC 2119]', '[RFC\n  2119]'), 0],
    [COMPACT.replace('RFC 2119 keywords', 'RFC ![](pixel.png)2119 keywords'), 1],
    [FULL.replace('key words', 'key <span></span>words'), 1],
    [COMPACT.replace('[RFC 2119]', '[RFC <span></span>2119]'), 1],
    [COMPACT.replace('[RFC 2119]', '[RFC 2118]'), 1],
    [FULL.replaceAll(', ', ' '), 1],
    [COMPACT.replace('www.rfc-editor.org/rfc/rfc2119.html', 'datatracker.ietf.org/doc/html/rfc2119'), 0],
    [COMPACT.replace('RFC 2119 keywords', 'RFC keywords'), 1],
    [FULL.replace('"SHALL NOT", ', ''), 1],
    [COMPACT + "\n\n" + FULL, 1],
    ["> " + COMPACT, 1],
    ["```markdown\n" + COMPACT + "\n```", 1],
    [COMPACT + "\n\nAnother introductory paragraph.", 1],
  ])("recognizes declaration count, variants and position (%#)", async (declaration, code) => {
    const result = await check("AS003", `# Fixture Skill\n\n${declaration}\n\n${RULE_SECTION}`, { eol });
    expect(result.code).toBe(code);
    if (code) expect(result.findings.every(f => f.ruleNames[0] === "AS003")).toBe(true);
  });

  it("does not require declarations for illustrative/non-normative parents or references", async () => {
    const body = "# Fixture Skill\n\n> - MUST preserve output.\n\n```markdown\n**Guidelines:**\n- MUST preserve output.\n```\n";
    expect((await check("AS003", body, { eol })).code).toBe(0);
  });

  it.each([
    ["Guidelines:", 1], ["## Guidelines:", 1], ["**Guidelines:**", 0], ["__Guidelines:__", 0],
    ["**Guidelines:** An inline explanation.", 0],
    ["Good Examples:", 1], ["### Bad Example:", 1], ["**Good Examples:**", 0],
    ["GoodExample:", 0], ["SnippetExample:", 0], ["Example:", 1],
    ["**Snippet example:** A single snippet.", 0], ["`Guidelines:`", 0],
    ["[`Guidelines:`](https://example.com)", 0],
    ["**[`Guidelines:`](https://example.com)**", 0],
    ["*[`Guidelines:`](https://example.com)*", 0],
    ["[Guidelines:](https://example.com)", 1],
    ["> Guidelines:", 0], ["```markdown\nGuidelines:\n```", 0],
  ])("assigns recognized label formatting to AS004 (%#)", async (label, code) => {
    expect((await check("AS004", `# Fixture Skill\n\n${label}\n`, { eol })).code).toBe(code);
  });

  it("does not invent Guidelines anatomy from a bold linked code literal", async () => {
    const body = "# Fixture Skill\n\n**[`Guidelines:`](https://example.com)**\n\n- MUST preserve output.\n";
    expect((await check("AS006", body, { eol })).code).toBe(0);
  });

  it.each(["-", "*", "+", "1."])("checks main %s Guidelines, not nested explanatory items", async (marker) => {
    const prefix = "# Fixture Skill\n\nDemonstrate the rule.\n\n**Guidelines:**\n\n";
    const body = prefix + `${marker} SHALL, when necessary, preserve output.\n${marker} SHALL NOT discard output.\n    - explanatory detail without a keyword\n`;
    expect((await check("AS005", body, { eol })).code).toBe(0);
    const bad = await check("AS005", prefix + `${marker} must preserve output.\n`, { eol });
    expect(bad.code).toBe(1);
    expect(bad.findings).toContainEqual(expect.objectContaining({ ruleNames: ["AS005"], lineNumber: 13 }));
  });

  it("treats linked keyword text as authored, without accepting a linked code literal", async () => {
    const item = '- [MUST](https://www.rfc-editor.org/rfc/rfc2119.html) preserve output.\n';
    const rules = '# Fixture Skill\n\nRationale.\n\n**Guidelines:**\n\n' + item;
    expect((await check("AS005", rules, { eol })).code).toBe(0);
    expect((await check("AS008", ROUTE + item, { eol })).code).toBe(1);
    expect((await check("AS008", ROUTE + item.replace('[MUST]', '[`MUST`]'), { eol })).code).toBe(0);
    const bare = '# Fixture Skill\n\n## Rules\n\nRationale.\n\n' + item;
    expect((await check("AS003", bare, { eol })).code).toBe(1);
    expect((await check("AS006", bare, { eol, ruleConfig: { AS006: { auditMissingGuidelines: true } } })).code).toBe(1);
  });

  it.each(["-", "*", "+"])("classifies %s items after invisible leading comments without skipping rendered blocks", async (marker) => {
    const item = `${marker} <!-- invisible -->\n\n  MUST preserve output.\n`;
    const bare = "# Fixture Skill\n\nRationale.\n\n" + item;
    const rules = "# Fixture Skill\n\nRationale.\n\n**Guidelines:**\n\n" + item;
    expect((await check("AS005", rules, { eol })).code).toBe(0);
    expect((await check("AS003", bare, { eol })).code).toBe(1);
    expect((await check("AS006", bare, { eol, ruleConfig: { AS006: { auditMissingGuidelines: true } } })).code).toBe(1);
    expect((await check("AS005", rules.replace("<!-- invisible -->", "visible explanation"), { eol })).code).toBe(1);
  });

  it.each([1, 2, 3, 4, 5, 6])("requires a local demonstration at H%i", async (depth) => {
    const heading = "#".repeat(depth) + " Rules";
    const body = `${heading}\n\n<!-- invisible -->\n\n**Guidelines:**\n\n- MUST preserve output.\n`;
    expect((await check("AS006", body, { eol })).code).toBe(1);
    expect((await check("AS006", body.replace("<!-- invisible -->", "A real demonstration."), { eol })).code).toBe(0);
  });

  it.each([
    "| Input | Output |\n| --- | --- |\n| A | B |",
    "- a descriptive demonstration",
    "- > a contained demonstration",
    "- ```js\n  const result = 1;\n  ```",
    "> a demonstration",
    "```js\nconst result = 1;\n```",
    "    indented demonstration",
  ])("accepts rendered demonstration blocks (%#)", async (demo) => {
    expect((await check("AS006", `## Rules\n\n${demo}\n\n**Guidelines:**\n\n- MUST preserve output.\n`, { eol })).code).toBe(0);
  });

  it("does not borrow a parent's demonstration for a deeper section", async () => {
    const body = "## Parent\n\nParent rationale.\n\n### Child\n\n**Guidelines:**\n\n- MUST preserve output.\n";
    expect((await check("AS006", body, { eol })).code).toBe(1);
  });

  it.each(["-", "*", "+", "1."])("requires rendered content in a %s demonstration list", async (marker) => {
    for (const content of [marker, marker + " <!-- invisible -->", marker + "\n    - <!-- invisible -->"]) {
      const body = `## Rules\n\n${content}\n\n**Guidelines:**\n\n- MUST preserve output.\n`;
      expect((await check("AS006", body, { eol })).code).toBe(1);
      expect((await check("AS006", body.replace(content, marker + " a real demonstration"), { eol })).code).toBe(0);
    }
  });

  it("does not count comments alone inside demonstration quotes", async () => {
    const body = "## Rules\n\n> <!-- invisible -->\n\n**Guidelines:**\n\n- MUST preserve output.\n";
    expect((await check("AS006", body, { eol })).code).toBe(1);
    expect((await check("AS006", body.replace("<!-- invisible -->", "A real demonstration."), { eol })).code).toBe(0);
  });

  it("does not count a thematic break alone as a demonstration", async () => {
    const body = "## Rules\n\n---\n\n**Guidelines:**\n\n- MUST preserve output.\n";
    const result = await check("AS006", body, { eol });
    expect(result.code).toBe(1);
    expect(result.findings).toEqual([expect.objectContaining({ ruleNames: ["AS006"], lineNumber: 11 })]);
    expect((await check("AS006", body.replace("---", "A real demonstration.\n\n---"), { eol })).code).toBe(0);
  });

  it("audits only explicit authored rule lists, and only when enabled", async () => {
    const options = { eol, ruleConfig: { AS006: { auditMissingGuidelines: true } } };
    const rule = "# Fixture Skill\n\nExplanation.\n\n- MUST preserve output.\n";
    expect((await check("AS006", rule, { eol })).code).toBe(0);
    expect((await check("AS006", rule, options)).code).toBe(1);
    for (const literal of ["- `MUST` is a keyword.", '- MUST and MAY are keyword names.', '> - MUST preserve output.', '```markdown\n- MUST preserve output.\n```', '**Good Example:**\n\n- MUST preserve output.']) {
      expect((await check("AS006", `# Fixture Skill\n\n${literal}\n`, options)).code).toBe(0);
    }
    expect((await check("AS006", ROUTE + "- MUST preserve output.\n", options)).code).toBe(0);
  });

  it.each(["MUST", "SHALL NOT"])("rejects bare %s routing keywords without rejecting keyword-name illustrations", async (word) => {
    const result = await check("AS008", ROUTE + `- ${word}\n`, { eol });
    expect(result.code).toBe(1);
    expect(result.findings).toEqual([expect.objectContaining({ ruleNames: ["AS008"], lineNumber: 11 })]);
    expect((await check("AS008", ROUTE + `- \`${word}\` is a keyword.\n`, { eol })).code).toBe(0);
    expect((await check("AS008", ROUTE + `- ${word} is a keyword.\n`, { eol })).code).toBe(0);
  });

  it.each(["-", "*", "+"])("checks later authored paragraphs in loose %s routing items but not examples or independent prose", async (marker) => {
    const body = ROUTE + `${marker} condition\n\n  MUST preserve output.\n`;
    const result = await check("AS008", body, { eol });
    expect(result.code).toBe(1);
    expect(result.findings).toEqual([expect.objectContaining({ ruleNames: ["AS008"], lineNumber: 13 })]);
    for (const paragraph of ["> MUST preserve output.", "```markdown\n  MUST preserve output.\n  ```", "`MUST` is a keyword."]) {
      expect((await check("AS008", body.replace("MUST preserve output.", paragraph), { eol })).code).toBe(0);
    }
    expect((await check("AS008", body.replace("  MUST", "MUST"), { eol })).code).toBe(0);
  });

  it.each(["-", "*", "+"])("checks %s routing across invisible definitions and contained fences", async (marker) => {
    const body = ROUTE + `${marker} condition\n\n  \`\`\`\n  illustrative only\n  \`\`\`\n\n[label]:\n  https://example.com\n  "a title"\n\n${marker} MUST preserve output.\n`;
    const result = await check("AS008", body, { eol });
    expect(result.code).toBe(1);
    expect(result.findings).toEqual([expect.objectContaining({ ruleNames: ["AS008"], lineNumber: 21 })]);
    expect((await check("AS008", body.replace("MUST preserve output.", "`MUST` is a keyword."), { eol })).code).toBe(0);
  });

  it.each(["-", "*", "+"])("rejects attached %s routing labels at their actual line", async (marker) => {
    for (const label of ["**Guidelines:**", "  **Guidelines:**", "  ## Nested\n\n  **Guidelines:**"]) {
      const body = ROUTE + marker + " condition\n\n" + label + "\n";
      const result = await check("AS008", body, { eol });
      expect(result.code).toBe(1);
      expect(result.findings).toEqual([expect.objectContaining({ ruleNames: ["AS008"], lineNumber: 6 + body.split("\n").findIndex(line => line.includes("**Guidelines:**")) + 1 })]);
    }
  });

  it.each([
    "Independent rationale.", "## Independent\n\nA local demonstration.", "+ independent", "* independent",
    "```markdown\nillustrative only\n```", "> independent illustration",
  ])("preserves a real independent routing boundary (%#)", async (separator) => {
    const body = ROUTE + "- condition\n\n" + separator + "\n\n**Guidelines:**\n\n- MUST preserve output.\n";
    expect((await check("AS008", body, { eol })).code).toBe(0);
  });

  it.each([
    [ROUTE + "- condition\n", 0],
    [ROUTE.replace("for:", "when:") + "* condition\n", 0],
    [ROUTE.replace("for:", "when editing authentication") + "- condition\n", 1],
    [ROUTE.replace("for:", "when") + "- condition\n", 1],
    [ROUTE.replace("./references/topic.md", "./references/../topic.md") + "- condition\n", 1],
    [ROUTE.replace("./references/topic.md", "./references/nested/topic.md") + "- condition\n", 1],
    [ROUTE.replace("topic.md]", "details]") + "- condition\n", 1],
    [ROUTE.replace("./references/", "references/") + "- condition\n", 1],
    [ROUTE.replace("See", "Read") + "- condition\n", 1],
    [ROUTE.replace("See", "Read") + "<!-- invisible -->\n\n- condition\n", 1],
    [ROUTE + "1. condition\n", 1],
    [ROUTE, 1],
    [ROUTE + "-\n", 1],
    [ROUTE + "- <!-- invisible -->\n", 1],
    [ROUTE.replace("## Topic\n\n", "") + "- condition\n", 1],
    [ROUTE + "- condition\n\nFurther background: [topic](./references/topic.md).\n", 0],
    ["## Topic\n\nSee the discussion in [topic.md](./references/topic.md).\n", 0],
    ["## Topic\n\nSee the discussion in [topic.md](./references/topic.md).\n\n- supplementary detail\n", 0],
    ["> " + ROUTE.replaceAll("\n", "\n> ") + "- condition\n", 0],
  ])("limits AS007 to actual route candidates (%#)", async (body, code) => {
    expect((await check("AS007", body, { eol })).code).toBe(code);
  });

  it.each([
    ["**Good Example:**\n\n> One.\n\n> Two.", 1],
    ["**Good  Example:**\n\n> One.\n\n> Two.", 1],
    ["**Good\tExample:**\n\n> One.\n\n> Two.", 1],
    ["**Good Examples:**\n\n> One.\n\n> Two.", 0],
    ["**Good  Examples:**\n\n> One.\n\n> Two.", 0],
    ["**Bad Example:**\n\n> One.\n>\n> Two.", 0],
    ["**Good Example:**\n\n```js\nconst one = 1;\n```", 0],
    ["**Good Examples:**\n\n```js\nconst one = 1;\n```\n\n```js\nconst two = 2;\n```", 1],
    ["**Bad Examples:**\n\n> ```js\n> const one = 1;\n> ```\n\n> ```js\n> const two = 2;\n> ```", 0],
    ["**Good Example:**\n\nOne.\n\nTwo.", 1],
    ["**Good Example:**\n\n> One.\n\n**Good Example:**\n\n> Two.", 0],
  ])("groups independent Good/Bad examples, not paragraphs within a quote (%#)", async (body, code) => {
    expect((await check("AS009", body, { eol })).code).toBe(code);
  });
});

describe("body rule integration", () => {
  it("returns infrastructure exit 2 rather than rejecting for null rule configuration", async () => {
    const dir = await writeSkill(await tempDir(), "fixture-skill", { body: "# Fixture Skill\n" });
    const result = await runValidation(await createContext({ skills: [dir] }), { standardConfig: { default: false }, ruleConfig: null });
    expect(result).toMatchObject({ code: 2, auditMissingGuidelines: false });
    expect(result.failures).toEqual(expect.arrayContaining([expect.stringMatching(/infrastructure failure/)]));
  });

  it("keeps literal keywords and labels inside routing examples out of AS008", async () => {
    const body = ROUTE + '- condition\n\n  > MUST and MAY are keyword names.\n  > **Guidelines:**\n\n  ```markdown\n  - SHALL preserve output.\n  ```\n\n- MUST and SHOULD are keyword names.\n';
    expect((await check("AS008", body)).code).toBe(0);
    expect((await check("AS008", body + '\n  **Guidelines:**\n')).code).toBe(1);
  });

  it("checks later Guidelines through invisible definitions/fences and stops at independent prose", async () => {
    const prefix = '# Fixture Skill\n\nRationale.\n\n**Guidelines:**\n\n- MUST preserve output.\n\n```markdown\nillustration\n```\n\n[link]: https://example.com\n\n';
    expect((await check("AS005", prefix + '- not a keyword\n')).code).toBe(1);
    expect((await check("AS005", prefix + 'Independent rationale.\n\n- not a keyword\n')).code).toBe(0);
    expect((await check("AS006", '**Guidelines:** A real inline rationale.\n\n- MUST preserve output.\n')).code).toBe(0);
  });

  it("does not cascade label formatting into anatomy or example-group errors", async () => {
    const dir = await writeSkill(await tempDir(), 'fixture-skill', { body: `# Fixture Skill\n\n${COMPACT}\n\n## Rules\n\nGuidelines:\n\n- MUST preserve output.\n\nGood Examples:\n\n> One.\n\n> Two.\n` });
    const result = await runValidation(await createContext({ skills: [dir] }), { standardConfig: { default: false } });
    expect(result.failures).toEqual([]);
    expect(result.findings.map(f => f.ruleNames[0])).toEqual(['AS004', 'AS004']);
  });

  it("keeps standard diagnostic ownership without custom duplicates", async () => {
    const body = `# Fixture Skill\n\n${COMPACT}\n\n${RULE_SECTION}\n# Another Title\n\n**Guidelines**\n\n__Example:__\n`;
    const result = await check("AS004", body, { standardConfig: { default: false, MD025: true, MD036: true, MD050: true } });
    expect(result.findings.some(f => f.ruleNames[0] === "AS004")).toBe(false);
    expect(new Set(result.findings.map(f => f.ruleNames[0]))).toEqual(new Set(["MD025", "MD036", "MD050"]));
  });

  it("protects built-in errors and reports the optional audit scope through the CLI", async () => {
    const root = await tempDir();
    const dir = await writeSkill(root, "fixture-skill", { body: `# Wrong Title\n\n${COMPACT}\n\n<!-- markdownlint-disable AS002 AS004 AS006 -->\n\nGuidelines:\n\n- MUST preserve output.\n` });
    const context = await createContext({ skills: [dir] });
    const result = await runValidation(context, { standardConfig: { default: false, AS002: false, AS004: false }, ruleConfig: { AS002: false, AS004: { severity: "warning" } } });
    expect(result.code).toBe(1);
    expect(result.failures).toEqual([]);
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleNames: ["AS002"], severity: "error" }),
      expect.objectContaining({ ruleNames: ["AS004"], severity: "error" }),
    ]));
    expect(result.rules).toEqual(Array.from({ length: 10 }, (_, i) => "AS" + String(i + 1).padStart(3, "0")));
    const config = await writeFileIn(root, "standard.json", '{"default":false}');
    const cli = runScript(CLI, ["--skill", dir, "--config", config, "--audit-missing-guidelines"]);
    expect(cli.code).toBe(1);
    expect(cli.stderr).toBe("");
    expect(cli.stdout).toMatch(/missing-Guidelines audit: enabled/);
    expect(cli.stdout).toMatch(/AS002/);
    expect(cli.stdout).toMatch(/AS004/);
    expect(join(dir, "SKILL.md")).toBe(context.documents.keys().next().value);
  });
});
