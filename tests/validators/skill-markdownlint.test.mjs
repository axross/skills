import { spawnSync } from "node:child_process";
import { chmod, cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { createContext } from "../../skills/agent-skill-authoring/scripts/markdownlint/context.mjs";
import { createConfiguration, createRules } from "../../skills/agent-skill-authoring/scripts/markdownlint/rules.mjs";
import { runValidation } from "../../skills/agent-skill-authoring/scripts/markdownlint/run.mjs";
import { tempDir, writeFileIn, writeSkill } from "../helpers/fixtures.mjs";
import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";

const CLI = "skills/agent-skill-authoring/scripts/markdownlint/cli.mjs";
const NO_STANDARD = { default: false };

/** run actual CLI2 custom checks with unrelated standard checks excluded from a rule fixture. */
async function check(options) {
  const dir = await writeSkill(await tempDir(), "probe-skill", options);
  const context = await createContext({ skills: [dir] });
  return runValidation(context, { standardConfig: NO_STANDARD });
}

/** a fixture process exposes genuine warnings/throws through the public extension API, not test hooks. */
function extensionProcess(dir, body) {
  const contextURL = pathToFileURL(repoPath("skills/agent-skill-authoring/scripts/markdownlint/context.mjs")).href;
  const runURL = pathToFileURL(repoPath("skills/agent-skill-authoring/scripts/markdownlint/run.mjs")).href;
  return spawnSync(process.execPath, ["--input-type=module", "-e", `
    import {createContext} from ${JSON.stringify(contextURL)};
    import {runValidation} from ${JSON.stringify(runURL)};
    const context=await createContext({skills:[process.argv[1]]});
    ${body}
    console.log(JSON.stringify(result));process.exitCode=result.code;
  `, dir], { encoding: "utf8" });
}

describe("AS001", () => {
  it.each([
    ["a".repeat(1024), 0],
    ["a".repeat(1025), 1],
    [JSON.stringify("日".repeat(341) + "a"), 0],
    [JSON.stringify("日".repeat(341) + "ab"), 1],
    ['"' + "\\u0061".repeat(1024) + '"', 0],
    ['"' + "\\u0061".repeat(1025) + '"', 1],
    [JSON.stringify("a".repeat(1003) + "<!-- raw comment -->"), 0],
    [JSON.stringify("a".repeat(1006) + "<!-- raw comment -->"), 1],
  ])("measures decoded UTF-8 bytes independently of quoting and comment preprocessing (%#)", async (description, code) => {
    const result = await check({ frontmatter: { description } });
    expect(result.code).toBe(code);
    expect(result.failures).toEqual([]);
    if (code) expect(result.findings).toContainEqual(expect.objectContaining({ ruleNames: ["AS001"], lineNumber: 3, errorDetail: expect.stringContaining("1,024 decoded UTF-8 bytes") }));
  });

  it.each([
    ["42", /nonempty string/], ["null", /nonempty string/], ['""', /nonempty string/],
    ["{ nested: value }", /nonempty string/], ["[value]", /nonempty string/],
    ["text # silently truncated", /inline comment/], ["text: structure", /Invalid YAML/],
    ['"bad\\d"', /Invalid YAML/], ['"never closed', /Invalid YAML/],
    ["'unpaired ' quote'", /Invalid YAML/],
    ["|\n  block text", /block and multiline/], [">\n  folded text", /block and multiline/],
    ['"first\n  second"', /block and multiline/], ["first\n  second", /block and multiline/],
    ["&anchor value", /anchors/], ["*unknown", /aliases/], ["!!str value", /explicit tags/],
  ])("distinguishes required scalar representations (%#)", async (description, detail) => {
    const result = await check({ frontmatter: { description } });
    expect(result.code).toBe(1);
    expect(result.failures).toEqual([]);
    expect(result.findings.some((finding) => detail.test(finding.errorDetail))).toBe(true);
  });

  it.each([
    ["# Missing YAML\n", /Missing or unclosed/],
    ["---\nname: probe-skill\ndescription: text\n---not-a-delimiter\n", /Missing or unclosed/],
    ["---\n- item\n---\n", /must be a mapping/],
    ["---\nname: probe-skill\ndescription: one\ndescription: two\n---\n", /DUPLICATE_KEY/],
    ["---\ndescription: text\n---\n", /Missing required name/],
    ["---\nname: probe-skill\n---\n", /Missing required description/],
    ["---\nname: Wrong_Name\ndescription: text\n---\n", /kebab-case/],
    ["---\nname: other-name\ndescription: text\n---\n", /does not match/],
  ])("validates the actual leading YAML block (%#)", async (raw, detail) => {
    const result = await check({ raw });
    expect(result.code).toBe(1);
    expect(result.failures).toEqual([]);
    expect(result.findings.some((finding) => detail.test(finding.errorDetail))).toBe(true);
  });

  it.each([64, 65])("checks the name character boundary (%i)", async (length) => {
    const dir = await writeSkill(await tempDir(), "a".repeat(length));
    const result = await runValidation(await createContext({ skills: [dir] }), { standardConfig: NO_STANDARD });
    expect(result.code).toBe(length === 64 ? 0 : 1);
    if (length === 65) expect(result.findings[0].errorDetail).toMatch(/64 characters/);
  });

  it("accepts legal escapes, quoting and supported optional metadata without expanding alias graphs", async () => {
    const result = await check({ raw: `---
name: "probe-skill"
description: "An escaped \\n and \\u65e5 plus quoted # and: text" # a comment outside a quoted scalar
license: MIT
compatibility: Local files
allowed-tools: Read Write
metadata:
  tag: custom
user-invocable: false
when_to_use: An optional extension
model: optional-host-model
notes: &cycle [*cycle]
---
# Probe
` });
    expect(result).toMatchObject({ code: 0, findings: [], failures: [] });
  });

  it.each(["\n", "\r\n"])("reports scalar and opener lines in the original source (%j)", async (newline) => {
    const result = await check({ raw: ["---", "name: probe-skill", "description: 42", "---", "", "# Probe", "", "~~~", "text"].join(newline) });
    expect(result.code).toBe(1);
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleNames: ["AS001"], lineNumber: 3 }),
      expect.objectContaining({ ruleNames: ["AS010"], lineNumber: 8 }),
    ]));
  });
});

describe("AS010", () => {
  it.each([
    ["```\ntext", false], ["```\ntext\n````", true], ["```\ntext\n~~\n", false],
    ["````\n```\n", false], ["~~~\ntext\n~~~~", true], ["```\n```", true], ["```", false],
    ["> ```\n>", false], ["> ```\n> ```", true],
    ["> > ~~~\n> >", false], ["> > ~~~\n> > ~~~~", true],
    ["- ```\n  ", false], ["- ```\n  ```", true], ["- ```\n      ```", false],
    ["- outer\n  - ~~~\n    text\n    ~~~", true],
    ["> ```\n> text\noutside", false], ["> ```\r\n>\r\n", false],
    ["    ```\n    ordinary indented code\n", true],
    ["``` invalid ` info\nordinary text\n", true],
    ["<!--\n```\ncomment\n-->\n", true],
    ["````markdown\n---\nname: Example_Name\n---\n```\n````\n", true],
  ])("distinguishes explicit closure from EOF/container auto-closing (%#)", async (body, closed) => {
    const result = await check({ body });
    expect(result.code).toBe(closed ? 0 : 1);
    expect(result.failures).toEqual([]);
    expect(result.findings.filter((finding) => finding.ruleNames[0] === "AS010")).toHaveLength(closed ? 0 : 1);
  });

  it("checks nested references without interpreting fenced frontmatter examples as document metadata", async () => {
    const dir = await writeSkill(await tempDir(), "probe-skill");
    const path = await writeFileIn(dir, "references/nested/detail.md", "# Detail\n\n> ~~~\n>");
    const result = await runValidation(await createContext({ skills: [dir] }), { standardConfig: NO_STANDARD });
    expect(result.code).toBe(1);
    expect(result.documents).toContain(path);
    expect(result.findings).toEqual([expect.objectContaining({ ruleNames: ["AS010"], lineNumber: 3 })]);
  });
});

describe("explicit context and protected execution", () => {
  it("retains raw CRLF bytes and uses captured content even after the disk file changes", async () => {
    const root = await tempDir();
    const raw = "---\r\nname: probe-skill\r\ndescription: 日本語 <!-- raw -->\r\n---\r\n# Probe\r\n";
    const dir = await writeSkill(root, "probe-skill", { raw });
    const path = join(dir, "SKILL.md");
    const context = await createContext({ skills: [dir] });
    expect(context.documents.get(path).raw).toBe(raw);
    expect(context.documents.get(path).bytes.equals(Buffer.from(raw))).toBe(true);
    await rm(path);
    const result = await runValidation(context, { standardConfig: NO_STANDARD });
    expect(result).toMatchObject({ code: 0, findings: [], failures: [] });
  });

  it("discovers symlinked collection directories and every nested reference", async () => {
    const root = await tempDir();
    const dir = await writeSkill(root, "probe-skill");
    await writeFileIn(dir, "references/nested/detail.md", "# Detail\n");
    const collection = join(root, "collection");
    await mkdir(collection);
    await symlink(dir, join(collection, "probe-skill"));
    const context = await createContext({ collections: [collection] });
    expect(context.documents.size).toBe(2);
    const result = await runValidation(context, { standardConfig: NO_STANDARD });
    expect(result).toMatchObject({ code: 0, scope: "W1-full", findings: [], failures: [] });
  });

  it("refuses a collection with a missing mandatory parent instead of validating its passing subset", async () => {
    const root = await tempDir();
    await writeSkill(root, "probe-skill");
    await mkdir(join(root, "missing-skill"));
    const result = runScript(CLI, ["--collection", root]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/SKILL\.md/);
    expect(result.stdout).not.toMatch(/W1-full|Checked:/);
  });

  it("rejects empty selection, unknown options and unavailable rule selection", async () => {
    expect(runScript(CLI).code).toBe(2);
    expect(runScript(CLI, ["--ignore", "*"]).code).toBe(2);
    const root = await tempDir();
    expect(runScript(CLI, ["--collection", root]).code).toBe(2);
    const dir = await writeSkill(root, "probe-skill");
    const config = await writeFileIn(root, "standard.json", JSON.stringify(NO_STANDARD));
    const result = runScript(CLI, ["--skill", dir, "--config", config, "--rule", "MISSING"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/unavailable custom rule/);
  });

  it("rejects invalid UTF-8, missing context and effective unreadability", async () => {
    const dir = await writeSkill(await tempDir(), "probe-skill");
    const path = join(dir, "SKILL.md");
    await writeFile(path, Buffer.from([0xff, 0xfe]));
    expect(runScript(CLI, ["--skill", dir]).code).toBe(2);
    await writeFile(path, "# Probe\n");
    await chmod(path, 0);
    const unreadable = runScript(CLI, ["--skill", dir]);
    expect(unreadable.code).toBe(2);
    expect(unreadable.stderr).toMatch(/EACCES/);
    await chmod(path, 0o600);
    expect((await runValidation(null)).code).toBe(2);
    expect((await runValidation({ documents: {} })).code).toBe(2);
    const rules = createRules(null);
    expect(() => rules[0].function({ name: path }, () => {})).toThrow(/Missing source context/);
  });

  it("blocks reference directory cycles rather than recursing forever", async () => {
    const dir = await writeSkill(await tempDir(), "probe-skill");
    await mkdir(join(dir, "references"));
    await symlink(join(dir, "references"), join(dir, "references", "cycle"));
    await expect(createContext({ skills: [dir] })).rejects.toThrow(/cycle/);
  });

  it("ignores hostile inherited/local CLI2 configurations and inline mandatory suppression", async () => {
    const root = await tempDir();
    const dir = await writeSkill(root, "probe-skill", { raw: "---\nname: other-name\ndescription: text\n---\n<!-- markdownlint-disable AS001 AS010 -->\n~~~\n" });
    await writeFileIn(root, ".markdownlint-cli2.jsonc", JSON.stringify({ config: { default: false, AS001: false, AS010: false }, ignores: ["**"], fix: true }));
    await writeFileIn(dir, ".markdownlint.json", JSON.stringify({ default: false, AS001: false, AS010: false }));
    await writeFileIn(dir, ".markdownlint-cli2.mjs", 'throw new Error("must not import local config")');
    const config = await writeFileIn(root, "standard.json", JSON.stringify({ default: false, AS001: false, AS010: false }));
    const before = await readFile(join(dir, "SKILL.md"), "utf8");
    const result = runScript(CLI, ["--skill", dir, "--config", config], { cwd: root });
    expect(result.code).toBe(1);
    expect(result.stdout).toMatch(/AS001/);
    expect(result.stdout).toMatch(/AS010/);
    expect(result.stdout).toMatch(/W1-full: 1 document/);
    expect(result.stderr).toBe("");
    expect(await readFile(join(dir, "SKILL.md"), "utf8")).toBe(before);
  });

  it("protects an ignored nested reference, while explicit focused documents cannot claim full scope", async () => {
    const root = await tempDir();
    const dir = await writeSkill(root, "probe-skill");
    const reference = await writeFileIn(dir, "references/nested/detail.md", "~~~\n");
    await writeFileIn(root, ".markdownlint-cli2.jsonc", JSON.stringify({ ignores: ["**/references/**"] }));
    const config = await writeFileIn(root, "standard.json", JSON.stringify(NO_STANDARD));
    const full = runScript(CLI, ["--skill", dir, "--config", config], { cwd: root });
    expect(full.code).toBe(1);
    expect(full.stdout).toMatch(/AS010/);
    expect(full.stdout).toContain(reference);
    const partial = runScript(CLI, ["--skill", dir, "--file", join(dir, "SKILL.md"), "--config", config], { cwd: root });
    expect(partial.code).toBe(0);
    expect(partial.stdout).toMatch(/partial: 1 document/);
    expect(partial.stdout).not.toMatch(/W1-full/);
  });

  it("runs actual standard checks and preserves their inline exceptions on unrelated Markdown", async () => {
    const root = await tempDir();
    const path = await writeFileIn(root, "ordinary.md", "# Ordinary  \n");
    const config = await writeFileIn(root, "standard.json", JSON.stringify({ default: false, MD009: { br_spaces: 0 } }));
    const failed = runScript(CLI, ["--file", path, "--config", config]);
    expect(failed.code).toBe(1);
    expect(failed.stdout).toMatch(/MD009/);
    expect(failed.stdout).not.toMatch(/error AS001|error AS010/);
    await writeFile(path, "<!-- markdownlint-disable-next-line MD009 -->\n# Ordinary  \n");
    const passed = runScript(CLI, ["--file", path, "--config", config]);
    expect(passed.code).toBe(0);
    expect(passed.stdout).toMatch(/partial: 1 document/);
  });

  it("labels a rule-only selection partial and enforces mandatory severity despite ruleConfig", async () => {
    const dir = await writeSkill(await tempDir(), "probe-skill", { frontmatter: { name: "other-name" } });
    const context = await createContext({ skills: [dir] });
    const partial = await runValidation(context, { standardConfig: NO_STANDARD, rules: ["AS010"] });
    expect(partial).toMatchObject({ code: 0, scope: "partial", rules: ["AS010"] });
    const full = await runValidation(context, { standardConfig: NO_STANDARD, ruleConfig: { AS001: false } });
    expect(full.code).toBe(1);
    expect(createConfiguration(context).config).toEqual({ default: false, AS001: true, AS010: true });
  });

  it("checks captured source instead of normalized rule lines and refuses lost token context", async () => {
    const dir = await writeSkill(await tempDir(), "probe-skill", { frontmatter: { description: JSON.stringify("a".repeat(1025)) } });
    const context = await createContext({ skills: [dir] });
    const path = join(dir, "SKILL.md");
    const findings = [];
    createRules(context)[0].function({ name: path, lines: ["normalized content without YAML"] }, (finding) => findings.push(finding));
    expect(findings).toEqual([expect.objectContaining({ lineNumber: 3, detail: expect.stringContaining("1,024 decoded UTF-8 bytes") })]);
    context.documents.get(path).tokens = null;
    const failed = await runValidation(context, { standardConfig: NO_STANDARD });
    expect(failed.code).toBe(2);
    expect(failed.failures.join("\n")).toMatch(/AS010 runtime failure/);
  });

  it("preserves standard warning-only success and handles non-Error rule throws", async () => {
    const dir = await writeSkill(await tempDir(), "probe-skill", { body: "# Probe  \n" });
    const context = await createContext({ skills: [dir] });
    const warning = await runValidation(context, { standardConfig: { default: false, MD009: { severity: "warning", br_spaces: 0 } } });
    expect(warning.code).toBe(0);
    expect(warning.findings).toContainEqual(expect.objectContaining({ ruleNames: expect.arrayContaining(["MD009"]), severity: "warning" }));
    const failed = await runValidation(context, { standardConfig: NO_STANDARD, additionalRules: [{ names: ["NULLFAIL"], tags: ["fixture"], description: "Non-Error failure", parser: "none", function() { throw null; } }] });
    expect(failed.code).toBe(2);
    expect(failed.failures.join("\n")).toMatch(/runtime failure.*null/);
  });

  it.each([
    [{}, 0],
    [{ frontmatter: { name: "other-name" } }, 1],
    [{ frontmatter: { description: "a".repeat(1025) } }, 1],
    [{ frontmatter: { description: '"bad\\d"' } }, 1],
    [{ raw: "# Missing YAML\n" }, 1],
  ])("agrees with covered legacy frontmatter fixtures without retiring their other responsibilities (%#)", async (options, code) => {
    const dir = await writeSkill(await tempDir(), "probe-skill", options);
    expect(runScript(SCRIPTS.checkSkillFrontmatter, [dir]).code).toBe(code);
    expect((await runValidation(await createContext({ skills: [dir] }), { standardConfig: NO_STANDARD })).code).toBe(code);
  });

  it.each([["# Probe\n\n~~~\ntext\n", 1], ["# Probe\n\n~~~\ntext\n~~~~\n", 0]])("agrees with covered legacy body fence fixtures (%#)", async (body, code) => {
    const dir = await writeSkill(await tempDir(), "probe-skill", { body });
    expect(runScript(SCRIPTS.checkSkillBody, [dir]).code).toBe(code);
    expect((await runValidation(await createContext({ skills: [dir] }), { standardConfig: NO_STANDARD })).code).toBe(code);
  });

  it("checks the source skill corpus without substituting for its existing repository gates", async () => {
    const context = await createContext({ collections: [repoPath("skills")] });
    const result = await runValidation(context, { standardConfig: NO_STANDARD });
    expect(result).toMatchObject({ code: 0, scope: "W1-full", findings: [], failures: [] });
    expect(result.documents.length).toBeGreaterThan(context.skillDirs.length);
    expect(result.rules).toEqual(["AS001", "AS010"]);
  });

  it("limits the CLI2-upgrade glossary exception without weakening MD025 for other documents", async () => {
    const binary = "node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs";
    for (const prefix of ["skills", ".agents/skills", ".claude/skills"]) {
      const glossary = repoPath(prefix, "living-project-documentation/assets/docs-example/glossary.md");
      const result = runScript(binary, [glossary]);
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/Summary: 0/);
    }
    const path = await writeFileIn(await tempDir(), "ordinary.md", "<!-- Initial comment -->\n\n# First\n\n# Second\n");
    const result = runScript(binary, [path]);
    expect(result.code).toBe(1);
    expect(result.output).toMatch(/MD025/);
  });

  it.each([false, true])("makes custom rule exceptions unsuccessful at error/warning severity (%j)", async (warning) => {
    const dir = await writeSkill(await tempDir(), "probe-skill");
    for (const asynchronous of [false, true]) {
      const result = extensionProcess(dir, `
        const rule={names:['TESTFAIL'],tags:['fixture'],description:'Failure fixture',parser:'none',asynchronous:${asynchronous},function(){${asynchronous ? "return Promise.reject(new Error('injected-failure'))" : "throw new Error('injected-failure')"}}};
        const result=await runValidation(context,{standardConfig:{default:false},additionalRules:[rule],ruleConfig:{TESTFAIL:{severity:${JSON.stringify(warning ? "warning" : "error")}}}});
      `);
      expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 2, stderr: "" });
      expect(result.stdout).toMatch(/injected-failure/);
      expect(result.stdout).toMatch(/coverage gap/);
    }
  });

  it("keeps genuine custom advisories successful and detects disabled-rule coverage gaps", async () => {
    const dir = await writeSkill(await tempDir(), "probe-skill");
    const rule = { names: ["TESTWARN"], tags: ["fixture"], description: "Warning fixture", parser: "none", function(params, onError) { onError({ lineNumber: 1, detail: "genuine advisory" }); } };
    const context = await createContext({ skills: [dir] });
    const warning = await runValidation(context, { standardConfig: NO_STANDARD, additionalRules: [rule], ruleConfig: { TESTWARN: { severity: "warning" } } });
    expect(warning.code).toBe(0);
    expect(warning.findings).toContainEqual(expect.objectContaining({ severity: "warning", errorDetail: "genuine advisory" }));
    const missing = await runValidation(context, { standardConfig: NO_STANDARD, additionalRules: [rule], ruleConfig: { TESTWARN: false } });
    expect(missing.code).toBe(2);
    expect(missing.failures.join("\n")).toMatch(/coverage gap/);
  });

  it("makes an executed built-in warning-rule failure unsuccessful despite suppression of its diagnostic", async () => {
    const dir = await writeSkill(await tempDir(), "probe-skill", { body: "<!-- markdownlint-disable-line MD013 -->\n# Probe\n" });
    const result = extensionProcess(dir, `
      let calls=0;
      const lineLength={valueOf(){calls++;throw new Error('built-in-failure')}};
      const result=await runValidation(context,{standardConfig:{default:false,MD013:{severity:'warning',line_length:lineLength}}});
      if(calls!==1)throw new Error('built-in rule did not execute');
    `);
    expect(result.status).toBe(2);
    expect(result.stdout).toMatch(/built-in-failure/);
  });

  it("rejects bad configuration and startup plugin shapes without a successful summary", async () => {
    const root = await tempDir();
    const dir = await writeSkill(root, "probe-skill");
    const config = await writeFileIn(root, "invalid.json", "[]");
    const bad = runScript(CLI, ["--skill", dir, "--config", config]);
    expect(bad.code).toBe(2);
    expect(bad.stdout).not.toMatch(/W1-full/);
    const result = await runValidation(await createContext({ skills: [dir] }), { standardConfig: NO_STANDARD, additionalRules: [{ names: ["BROKEN"] }] });
    expect(result.code).toBe(2);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it("runs the copied and packed distribution in a clean consumer with network access denied", async () => {
    const root = await tempDir();
    const copied = join(root, "copied-skill");
    await cp(repoPath("skills/agent-skill-authoring"), copied, { recursive: true });
    const packageDir = join(copied, "scripts/markdownlint");
    const dir = await writeSkill(root, "probe-skill");
    const config = await writeFileIn(root, "standard.json", JSON.stringify(NO_STANDARD));
    const startup = spawnSync(process.execPath, [join(packageDir, "cli.mjs"), "--skill", dir], { cwd: root, encoding: "utf8" });
    expect(startup.status).toBe(2);
    expect(startup.stderr).toMatch(/Cannot find package/);
    expect(startup.stdout).toBe("");

    const packed = spawnSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", root], { cwd: packageDir, encoding: "utf8" });
    expect({ status: packed.status, stderr: packed.stderr }).toEqual({ status: 0, stderr: "" });
    const archive = JSON.parse(packed.stdout)[0];
    expect(archive.files.map((file) => file.path).sort()).toEqual(["cli.mjs", "context.mjs", "package.json", "rules.mjs", "run.mjs"]);
    const consumer = join(root, "consumer");
    await mkdir(consumer);
    await writeFileIn(consumer, "package.json", JSON.stringify({ private: true, type: "module" }));
    const installed = spawnSync("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", join(root, archive.filename)], { cwd: consumer, encoding: "utf8" });
    expect({ status: installed.status, stderr: installed.stderr }).toEqual({ status: 0, stderr: "" });
    const lock = JSON.parse(await readFile(join(consumer, "package-lock.json"), "utf8"));
    expect(lock.packages["node_modules/markdownlint-cli2"].version).toBe("0.23.3");
    expect(lock.packages["node_modules/markdownlint"].version).toBe("0.41.1");
    expect(lock.packages["node_modules/markdown-it"].version).toBe("15.0.1");
    expect(lock.packages["node_modules/yaml"].version).toBe("2.8.2");

    const permissions = ["--permission", "--allow-fs-read=*"];
    const denied = spawnSync(process.execPath, [...permissions, "--input-type=module", "-e", `
      import http from 'node:http';
      process.exitCode=1;
      http.get('http://127.0.0.1:9').on('error',error=>{
        console.log(error.code); process.exitCode=error.code==='ERR_ACCESS_DENIED'?0:1;
      });
    `], { cwd: consumer, encoding: "utf8" });
    expect(denied.status).toBe(0);
    expect(denied.stdout).toMatch(/ERR_ACCESS_DENIED/);
    const cli = join(consumer, "node_modules/agent-skill-markdownlint/cli.mjs");
    const passing = spawnSync(process.execPath, [...permissions, cli, "--skill", dir, "--config", config], { cwd: consumer, encoding: "utf8" });
    expect({ status: passing.status, stderr: passing.stderr }).toEqual({ status: 0, stderr: "" });
    expect(passing.stdout).toMatch(/W1-full: 1 document/);
    await writeFile(join(dir, "SKILL.md"), "---\nname: other-name\ndescription: text\n---\n> ```\n>");
    const failed = spawnSync(process.execPath, [...permissions, cli, "--skill", dir, "--config", config], { cwd: consumer, encoding: "utf8" });
    expect(failed.status).toBe(1);
    expect(failed.stdout).toMatch(/AS001/);
    expect(failed.stdout).toMatch(/AS010/);
    const exports = spawnSync(process.execPath, [...permissions, "--input-type=module", "-e", `
      import {createRules,createConfiguration} from 'agent-skill-markdownlint';
      import {createContext} from 'agent-skill-markdownlint/context';
      import {runValidation} from 'agent-skill-markdownlint/run';
      const context=await createContext({skills:[process.argv[1]]});
      const rule={names:['OFFLINEWARN'],tags:['fixture'],description:'Offline advisory',parser:'none',function(p,e){e({lineNumber:1,detail:'advisory'})}};
      const advisory=await runValidation(context,{standardConfig:{default:false},rules:['OFFLINEWARN'],additionalRules:[rule],ruleConfig:{OFFLINEWARN:{severity:'warning'}}});
      if(advisory.code!==0||advisory.findings[0].severity!=='warning')throw new Error('advisory outcome');
      rule.function=()=>{throw new Error('offline-failure')};
      const failed=await runValidation(context,{standardConfig:{default:false},rules:['OFFLINEWARN'],additionalRules:[rule],ruleConfig:{OFFLINEWARN:{severity:'warning'}}});
      if(failed.code!==2||!failed.failures.some(f=>f.includes('offline-failure')))throw new Error('failure outcome');
      console.log(createRules(context).map(r=>r.names[0]),createConfiguration(context).noInlineConfig,advisory.code,failed.code);
    `, dir], { cwd: consumer, encoding: "utf8" });
    expect({ status: exports.status, stderr: exports.stderr }).toEqual({ status: 0, stderr: "" });
    expect(exports.stdout).toMatch(/AS001.*AS010.*true 0 2/);
  }, 30000);
});
