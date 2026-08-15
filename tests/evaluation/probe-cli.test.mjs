// probe.mjs, driven as a real subprocess — its own argument parsing,
// admission, --dry-run reporting, and (through a fake `claude` on PATH) a
// real non-dry-run run, all without ever spawning a real model.

import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { repoPath } from "../helpers/run.mjs";
import { fakeClaudeEnv } from "./helpers/fake-cli.mjs";

const PROBE_SCRIPT = repoPath("tools/evaluation/probe.mjs");

function runProbeCli(args, { env } = {}) {
  const result = spawnSync(process.execPath, [PROBE_SCRIPT, ...args], {
    encoding: "utf8",
    env: env ?? process.env,
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("probe.mjs --help", () => {
  it("prints usage and exits 0", () => {
    const result = runProbeCli(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^Usage: probe\.mjs/);
  });
});

describe("probe.mjs bad invocation", () => {
  it("exits 2 on an unknown option", () => {
    const result = runProbeCli(["--nonsense"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/Unknown option/);
  });

  it("exits 2 for a named scenario that does not exist", () => {
    const result = runProbeCli(["--dry-run", "--scenario", "no-such-scenario"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/No scenario\.json/);
  });
});

describe("probe.mjs --dry-run", () => {
  it("reports the exact probe matrix and never spawns a model", () => {
    const result = runProbeCli(["--dry-run"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Probe matrix: 6 probe\(s\)/);
    expect(result.stdout).toContain("quiet-the-stale-post-list-after-a-draft-save skill-present #1");
    expect(result.stdout).toContain("quiet-the-stale-post-list-after-a-draft-save skill-absent #3");
    expect(result.stdout).toMatch(/Dry run: no probe was spawned\./);
  });

  it("honors --repetitions and --conditions in the reported matrix", () => {
    const result = runProbeCli(["--dry-run", "--repetitions", "1", "--conditions", "skill-present"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Probe matrix: 1 probe\(s\)/);
  });

  // negative control 4/5: a run whose exact probe count exceeds its
  // declared limit is refused before any probe starts, and the message
  // names which count exceeded which limit.
  it("refuses a run over its declared limit, before anything would have started", () => {
    const result = runProbeCli(["--dry-run", "--limit", "3"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/Refusing to start/);
    expect(result.stderr).toContain("6");
    expect(result.stderr).toContain("3");
  });

  it("admits a run at or under its declared limit", () => {
    const result = runProbeCli(["--dry-run", "--limit", "6"]);
    expect(result.code).toBe(0);
  });
});

describe("probe.mjs a real (non-dry-run) run, against a fake claude", () => {
  it("writes the four measured files, in the declared stored shape, to --out", async () => {
    const out = join(await tempDir(), "measurements");
    const env = await fakeClaudeEnv({ FAKE_CLAUDE_INVOKE_SKILL: "tanstack-query-development" });

    const result = runProbeCli(
      ["--repetitions", "1", "--conditions", "skill-present", "--out", out],
      { env },
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Completed 1 probe\(s\)\./);

    const [measurementDirName] = await readdir(out);
    const probeDir = join(out, measurementDirName, "skill-present-1");
    const metadata = JSON.parse(await readFile(join(probeDir, "metadata.json"), "utf8"));

    expect(metadata).not.toHaveProperty("configuration");
    expect(metadata.runtime.model).toMatch(/^anthropic\//);
    expect(metadata.harness.skills).toHaveProperty("tanstack-query-development");

    const invocations = JSON.parse(await readFile(join(probeDir, "invocations.json"), "utf8"));
    expect(invocations.skillsInvoked).toEqual(["tanstack-query-development"]);

    await expect(readFile(join(probeDir, "transcript.jsonl"), "utf8")).resolves.toContain('"type":"result"');
    await expect(readFile(join(probeDir, "changes.patch"), "utf8")).resolves.toBeTypeOf("string");
  });
});
