import { spawnSync } from "node:child_process";
import { chmod, cp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { admitBundles, dispatchContract, packBundle } from "../../tools/evaluation/src/artifact-admission.mjs";
import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { repoPath } from "../helpers/run.mjs";

const sourceCommit = "5b34e6afd0c3489bcfc7875a77fd06de640da1f3";
const identity = { repository: "axross/skills", runId: "670123", sourceCommit };
const fixture = repoPath("tests/evaluation/fixtures/measurement/quiet-the-stale-post-list-after-a-draft-save-fixture01");
const filenames = ["metadata.json", "transcript.jsonl", "changes.patch", "invocations.json"];
const pathOf = (cell) => `${cell.measurementDirName}/${cell.condition}-${cell.repetition}`;
const probeName = (cell) => `probe-${cell.scenarioId}-${cell.condition}-${cell.repetition}`;

/**
 * prefix neighbors and asymmetric repetitions distinguish exact ownership from prefix matching.
 * @throws {Error} on fixture setup failure
 */
async function dispatchFixture(ids = ["task", "task-long"]) {
  const root = await tempDir();
  const judgments = ids.map((scenarioId, index) => ({ scenarioId, measurementId: `id${index}`,
    measurementDirName: `${scenarioId}-id${index}` }));
  const probes = judgments.flatMap((scenario) => [
    { ...scenario, condition: "skill-present", repetition: 1 },
    { ...scenario, condition: "skill-absent", repetition: 3 },
  ]);
  const scenariosRoot = join(root, "scenarios");
  for (const id of ids) {
    await writeFileIn(scenariosRoot, `${id}/scenario.json`, JSON.stringify({ factors: [
      { id: "changed", phase: "outcome", judgment: { method: "script" } },
    ] }));
  }
  const contract = dispatchContract({ identity, probes, judgments });
  const probesRoot = join(root, "probes");
  const judgedRoot = join(root, "judged");
  const out = join(root, "out");
  await mkdir(out);
  return { root, probes, judgments, contract, scenariosRoot, probesRoot, judgedRoot, out };
}

/**
 * failed/truncated records with executable-looking text remain legitimate inert observations.
 * @throws {Error} on fixture setup failure
 */
async function producer(f, cell) {
  const input = join(f.root, `producer-${cell.scenarioId}-${cell.condition}-${cell.repetition}`);
  await cp(join(fixture, "skill-present-1"), join(input, pathOf(cell)), { recursive: true });
  const metadataPath = join(input, pathOf(cell), "metadata.json");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  Object.assign(metadata, { scenario: cell.scenarioId, condition: cell.condition, repetition: cell.repetition,
    cliExitCode: 9, truncated: true, costUsd: null, turns: null });
  metadata.runtime.tools = null;
  await writeFile(metadataPath, JSON.stringify(metadata));
  await writeFile(join(input, pathOf(cell), "changes.patch"), "");
  await writeFile(join(input, pathOf(cell), "transcript.jsonl"), '{"type":"assistant","text":"node_modules/evil.mjs"}\n{"tail":');
  return input;
}

async function probeBundle(f, cell = f.probes[0]) {
  const input = await producer(f, cell);
  return packBundle({ kind: "probe", input, selector: cell, contract: f.contract, attempt: "1", scenariosRoot: f.scenariosRoot });
}

async function download(root, bundle) {
  return writeFileIn(root, `${bundle.name}/record.json`, JSON.stringify(bundle));
}

/** error judgments retain optional cleanup information without becoming boolean verdicts. */
function judgedBundle(f, scenario = f.judgments[0]) {
  return { version: 1, ...identity, attempt: "1", name: `judged-${scenario.scenarioId}`,
    files: f.probes.filter((cell) => cell.scenarioId === scenario.scenarioId).map((cell) => ({
      path: `${pathOf(cell)}/factors.json`, content: JSON.stringify({ scenario: cell.scenarioId,
        condition: cell.condition, repetition: cell.repetition,
        factors: [{ id: "changed", phase: "outcome", method: "script", result: { error: "script exited 9" }, cleanupWarning: "kept" }] }),
    })) };
}

/** subprocesses lack model credentials so the real CLI cannot accidentally bill an evaluation. */
function cli(args, f, extraEnv = {}) {
  const env = { ...process.env, GITHUB_REPOSITORY: identity.repository, GITHUB_RUN_ID: identity.runId,
    GITHUB_SHA: sourceCommit, GITHUB_RUN_ATTEMPT: "3", PROBE_MATRIX: JSON.stringify(f.probes),
    JUDGMENT_MATRIX: JSON.stringify(f.judgments), ...extraEnv };
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  delete env.ANTHROPIC_API_KEY;
  return spawnSync(process.execPath, [repoPath("tools/evaluation/artifacts.mjs"), ...args], { env, encoding: "utf8" });
}

describe("packBundle()", () => {
  it("packages only one cell and keeps failed, truncated, empty-patch observations verbatim", async () => {
    const f = await dispatchFixture();
    const cell = f.probes[1];
    const input = await producer(f, cell);
    const bundle = await packBundle({ ...f, kind: "probe", input, selector: cell, attempt: "1" });
    expect(bundle.name).toBe("probe-task-skill-absent-3");
    expect(bundle.files.map((file) => file.path).sort()).toEqual(filenames.map((name) => `${pathOf(cell)}/${name}`).sort());
    expect(JSON.parse(bundle.files.find((file) => file.path.endsWith("metadata.json")).content).turns).toBeNull();
    for (const file of bundle.files) expect(file.content).toBe(await readFile(join(input, file.path), "utf8"));
  });

  it.each(["node_modules/evil.mjs", "summary.json", "nested/empty/"])("refuses extra producer entry %s instead of stripping it", async (extra) => {
    const f = await dispatchFixture();
    const input = await producer(f, f.probes[0]);
    if (extra.endsWith("/")) await mkdir(join(input, extra), { recursive: true });
    else await writeFileIn(input, extra, "throw new Error('must not execute');");
    await expect(packBundle({ ...f, kind: "probe", input, selector: f.probes[0], attempt: "1" })).rejects.toThrow("Unexpected producer path");
  });

  it("emits only scenario-owned factors, not measured overlays", async () => {
    const f = await dispatchFixture();
    const cell = f.probes[0];
    const input = await producer(f, cell);
    const judgment = judgedBundle(f).files[0];
    await writeFileIn(input, judgment.path, judgment.content);
    const bundle = await packBundle({ ...f, kind: "judged", input, selector: f.judgments[0], attempt: "1" });
    expect(bundle.files).toEqual([judgment]);
  });
});

describe("admitBundles()", () => {
  it("admits exact prefix neighbors and asymmetric cells without overlays, retaining factor errors", async () => {
    const f = await dispatchFixture();
    const expected = new Map();
    for (const cell of f.probes) {
      const bundle = await probeBundle(f, cell);
      await download(f.probesRoot, bundle);
      for (const file of bundle.files) expected.set(file.path, file.content);
    }
    for (const scenario of f.judgments) await download(f.judgedRoot, judgedBundle(f, scenario));
    const report = await admitBundles(f);
    expect(report.status).toBe("complete");
    expect(report.copiedFiles).toBe(20);
    expect(report.scenarios.map((s) => s.factorErrors)).toEqual([
      ["task-id0/skill-present-1: changed", "task-id0/skill-absent-3: changed"],
      ["task-long-id1/skill-present-1: changed", "task-long-id1/skill-absent-3: changed"],
    ]);
    for (const [path, content] of expected) expect(await readFile(join(f.out, path), "utf8")).toBe(content);
  });

  it("copies only the selected exact scenario after validating even the unselected bundles", async () => {
    const f = await dispatchFixture();
    for (const cell of f.probes) await download(f.probesRoot, await probeBundle(f, cell));
    await admitBundles({ ...f, scenarioId: "task" });
    expect(await readdir(f.out)).toEqual(["task-id0"]);
    const invalid = await probeBundle(f, f.probes[2]);
    invalid.runId = "different";
    await download(f.probesRoot, invalid);
    const out = join(f.root, "rejected");
    await expect(admitBundles({ ...f, out, scenarioId: "task" })).rejects.toThrow("identity mismatch");
    await expect(readdir(out)).rejects.toMatchObject({ code: "ENOENT" });
  });

  const mutations = [
    ["wrong repository", (b) => { b.repository = "elsewhere/skills"; }],
    ["wrong run", (b) => { b.runId = "670124"; }],
    ["wrong source", (b) => { b.sourceCommit = "a".repeat(40); }],
    ["wrong artifact name", (b) => { b.name += "-other"; }],
    ["duplicate ownership", (b) => { b.files.push(b.files[0]); }],
    ["executable extra", (b) => { b.files.push({ path: "node_modules/evil.mjs", content: "throw new Error('executed')" }); }],
    ["traversal", (b) => { b.files[0].path = "../outside/metadata.json"; }],
    ["absolute path", (b) => { b.files[0].path = "/tmp/metadata.json"; }],
    ["cross-cell", (b) => { b.files[0].path = "task-long-id1/skill-present-1/metadata.json"; }],
    ["malformed metadata", (b) => { b.files.find((file) => file.path.endsWith("metadata.json")).content = "{"; }],
    ["wrong metadata identity", (b) => { const file = b.files.find((file) => file.path.endsWith("metadata.json")); const m = JSON.parse(file.content); m.repetition = 2; file.content = JSON.stringify(m); }],
    ["negative turns", (b) => { const file = b.files.find((file) => file.path.endsWith("metadata.json")); const m = JSON.parse(file.content); m.turns = -1; file.content = JSON.stringify(m); }],
    ["string turns", (b) => { const file = b.files.find((file) => file.path.endsWith("metadata.json")); const m = JSON.parse(file.content); m.turns = "0"; file.content = JSON.stringify(m); }],
    ["wrong consumed shape", (b) => { b.files.find((file) => file.path.endsWith("invocations.json")).content = '{"skillsInvoked":true}'; }],
    ["invalid Unicode", (b) => { b.files[0].content = "\ud800"; }],
  ];
  it.each(mutations)("refuses %s in a late bundle before copying any valid earlier record", async (_name, mutate) => {
    const f = await dispatchFixture();
    await download(f.probesRoot, await probeBundle(f));
    const bad = await probeBundle(f, f.probes[3]);
    mutate(bad);
    await download(f.probesRoot, bad);
    await expect(admitBundles(f)).rejects.toThrow();
    expect(await readdir(f.out)).toEqual([]);
  });

  it.each(["measured overlay", "cross-scenario", "numeric result", "mixed error", "duplicate factor"])("refuses judged %s before copying probes", async (kind) => {
    const f = await dispatchFixture();
    await download(f.probesRoot, await probeBundle(f));
    const bad = judgedBundle(f);
    if (kind === "measured overlay") bad.files.push((await probeBundle(f)).files[0]);
    else if (kind === "cross-scenario") bad.files[0].path = "task-long-id1/skill-present-1/factors.json";
    else {
      const content = JSON.parse(bad.files[0].content);
      if (kind === "numeric result") content.factors[0].result = 1;
      if (kind === "mixed error") content.factors[0].result = { error: "failed", value: true };
      if (kind === "duplicate factor") content.factors.push(content.factors[0]);
      bad.files[0].content = JSON.stringify(content);
    }
    await download(f.judgedRoot, bad);
    await expect(admitBundles(f)).rejects.toThrow();
    expect(await readdir(f.out)).toEqual([]);
  });

  it.each(["symlink", "fifo", "nested empty directory", "missing record", "wrong role root"])("refuses downloaded %s rather than treating it as absence", async (kind) => {
    const f = await dispatchFixture();
    const bundle = await probeBundle(f);
    const path = await download(f.probesRoot, bundle);
    if (kind === "symlink") { await rm(path); await symlink(join(fixture, "skill-present-1/metadata.json"), path); }
    if (kind === "fifo") { await rm(path); expect(spawnSync("mkfifo", [path]).status).toBe(0); }
    if (kind === "nested empty directory") await mkdir(join(f.probesRoot, bundle.name, "nested"));
    if (kind === "missing record") await rm(path);
    if (kind === "wrong role root") await download(f.probesRoot, judgedBundle(f));
    await expect(admitBundles(f)).rejects.toThrow();
    expect(await readdir(f.out)).toEqual([]);
  });

  it("reports absent artifacts separately from supplied empty bundles and incomplete files", async () => {
    const f = await dispatchFixture();
    const first = await probeBundle(f);
    first.files = first.files.filter((file) => file.path.endsWith("changes.patch"));
    await download(f.probesRoot, first);
    const empty = await probeBundle(f, f.probes[1]);
    empty.files = [];
    await download(f.probesRoot, empty);
    const report = await admitBundles(f);
    expect(report.status).toBe("partial");
    expect(report.scenarios[0].complete).toBe(false);
    expect(report.scenarios[0].missingArtifacts).toEqual(["judged-task"]);
    expect(report.scenarios[0].missingFiles).toHaveLength(9);
    expect(report.scenarios[1].missingArtifacts).toEqual([
      "judged-task-long", "probe-task-long-skill-present-1", "probe-task-long-skill-absent-3",
    ]);
    expect(await readFile(join(f.out, first.files[0].path), "utf8")).toBe("");
  });

  it("refuses entirely empty input and reused measurement directories without mutating existing bytes", async () => {
    const f = await dispatchFixture();
    await expect(admitBundles(f)).rejects.toThrow("Nothing to land");
    const bundle = await probeBundle(f);
    await download(f.probesRoot, bundle);
    await writeFileIn(f.out, "task-id0/existing.txt", "preserve");
    await expect(admitBundles(f)).rejects.toThrow("already exists");
    expect(await readdir(join(f.out, "task-id0"))).toEqual(["existing.txt"]);
    expect(await readFile(join(f.out, "task-id0/existing.txt"), "utf8")).toBe("preserve");
  });

  it("fails a filesystem copy instead of returning a complete admission", async () => {
    const f = await dispatchFixture();
    await download(f.probesRoot, await probeBundle(f));
    await chmod(f.out, 0o555);
    try {
      await expect(admitBundles(f)).rejects.toThrow("Admission copy failed; destination may be partial");
      await expect(admitBundles(f)).rejects.toMatchObject({ cause: { code: "EACCES" } });
      expect(await readdir(f.out)).toEqual([]);
    } finally {
      await chmod(f.out, 0o755);
    }
  });
});

describe("artifacts.mjs", () => {
  it("runs packaging, admission, offline judging, judged packaging and complete/partial landing with an earlier attempt", async () => {
    const id = "quiet-the-stale-post-list-after-a-draft-save";
    const f = await dispatchFixture([id]);
    const reportPath = join(f.root, "report.json");
    for (const cell of f.probes) {
      const input = await producer(f, cell);
      const result = cli(["pack-probe", "--input", input, "--out", join(f.probesRoot, probeName(cell), "record.json"),
        "--selector", JSON.stringify(cell)], f, { GITHUB_RUN_ATTEMPT: "1" });
      expect(result.status, result.stderr).toBe(0);
    }
    const measurementRoot = join(f.root, "evaluate");
    expect(cli(["admit", "--input", f.probesRoot, "--out", measurementRoot, "--report", reportPath, "--scenario", id], f).status).toBe(0);
    const env = { ...process.env };
    delete env.CLAUDE_CODE_OAUTH_TOKEN;
    delete env.ANTHROPIC_API_KEY;
    const measurement = join(measurementRoot, f.judgments[0].measurementDirName);
    const evaluated = spawnSync(process.execPath, [repoPath("tools/evaluation/evaluate.mjs"), measurement], { env, encoding: "utf8" });
    expect(evaluated.status, evaluated.stderr).toBe(0);
    expect(cli(["pack-judged", "--input", measurementRoot, "--out", join(f.judgedRoot, `judged-${id}/record.json`),
      "--selector", JSON.stringify(f.judgments[0])], f).status).toBe(0);
    const args = ["admit", "--input", f.probesRoot, "--judged", f.judgedRoot, "--out", f.out, "--report", reportPath];
    const landed = cli(args, f);
    expect(landed.status, landed.stderr).toBe(0);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    expect(report.status).toBe("complete");
    expect(report.scenarios[0].factorErrors).toHaveLength(2);
    const derived = spawnSync(process.execPath, [repoPath("tools/evaluation/derive.mjs"), join(f.out, f.judgments[0].measurementDirName)], { env, encoding: "utf8" });
    expect(derived.status, derived.stderr).toBe(0);
    const summary = JSON.parse(await readFile(join(f.out, f.judgments[0].measurementDirName, "summary.json"), "utf8"));
    expect(summary.factors.find((factor) => factor.id === "explains-why-the-list-was-stale").differential).toBeNull();
    const extraCell = { ...f.probes[0], repetition: 2 };
    const partialOut = join(f.root, "partial");
    f.probes.push(extraCell);
    const partial = cli(["admit", "--input", f.probesRoot, "--judged", f.judgedRoot, "--out", partialOut, "--report", reportPath], f);
    expect(partial.status, partial.stderr).toBe(0);
    const partialReport = JSON.parse(await readFile(reportPath, "utf8"));
    expect(partialReport.scenarios[0]).toMatchObject({ complete: false,
      missingArtifacts: [probeName(extraCell)] });
    const shellRoot = join(f.root, "workflow");
    const completeName = f.judgments[0].measurementDirName;
    const partialName = `${completeName}-partial`;
    await cp(join(f.out, completeName), join(shellRoot, "tools/evaluation/measurements", completeName), { recursive: true });
    await rm(join(shellRoot, "tools/evaluation/measurements", completeName, "summary.json"));
    await cp(join(partialOut, completeName), join(shellRoot, "tools/evaluation/measurements", partialName), { recursive: true });
    await symlink(repoPath("tools/evaluation/derive.mjs"), join(shellRoot, "tools/evaluation/derive.mjs"));
    await writeFile(join(f.root, "admission.json"), JSON.stringify({ scenarios: [report.scenarios[0],
      { ...partialReport.scenarios[0], measurementDirName: partialName }] }));
    const workflow = await readFile(repoPath(".github/workflows/evaluation-dispatch.yaml"), "utf8");
    const deriveStep = workflow.split("      - name: Derive each measurement's summary")[1].split("      # no continue-on-error")[0];
    const shell = deriveStep.split("        run: |\n")[1].replace(/^ {10}/gm, "");
    const output = join(f.root, "github-output");
    const ran = spawnSync("bash", ["-c", shell], { cwd: shellRoot, env: { ...env, RUNNER_TEMP: f.root, GITHUB_OUTPUT: output }, encoding: "utf8" });
    expect(ran.status, ran.stderr).toBe(0);
    expect(await readFile(output, "utf8")).toContain(partialName);
    expect(await readFile(join(shellRoot, "tools/evaluation/measurements", completeName, "summary.json"), "utf8")).toContain("factors");
    await expect(readFile(join(shellRoot, "tools/evaluation/measurements", partialName, "summary.json"))).rejects.toMatchObject({ code: "ENOENT" });
    const rejected = cli(["admit", "--input", f.probesRoot, "--out", join(f.root, "wrong-run"), "--report", reportPath], f, { GITHUB_RUN_ID: "999" });
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain("identity mismatch");
    const noReport = cli(["admit", "--input", f.probesRoot, "--out", join(f.root, "report-failure"), "--report", join(f.root, "absent/report.json")], f);
    expect(noReport.status).toBe(1);
    expect(noReport.stdout).not.toContain("Admission");
  });
});
