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
const SCENARIO = "quiet-the-stale-post-list-after-a-draft-save";

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

  // a github actions matrix cell always names --condition and --repetition
  // (not --conditions/--repetitions), so this is the shape a real cell
  // actually invokes.
  it("--condition and --repetition run exactly one probe, recorded under the given index", async () => {
    const out = join(await tempDir(), "measurements");
    const env = await fakeClaudeEnv();

    const result = runProbeCli(
      ["--scenario", SCENARIO, "--condition", "skill-present", "--repetition", "5", "--out", out],
      { env },
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Completed 1 probe\(s\)\./);

    const [measurementDirName] = await readdir(out);
    expect(await readdir(join(out, measurementDirName))).toEqual(["skill-present-5"]);
  });

  // negative control: two single-probe runs sharing one --measurement-id
  // write into ONE measurement directory; the same two runs with no fixed
  // id write into two separate ones. this is what makes a GitHub Actions
  // matrix cell's own process able to agree with its siblings on where a
  // scenario's measurement lives.
  it("--measurement-id fixes the measurement directory across separate invocations", async () => {
    const out = join(await tempDir(), "measurements");
    const env = await fakeClaudeEnv();
    const args = (condition) => [
      "--scenario",
      SCENARIO,
      "--measurement-id",
      "deadbeef",
      "--condition",
      condition,
      "--repetition",
      "1",
      "--out",
      out,
    ];

    expect(runProbeCli(args("skill-present"), { env }).code).toBe(0);
    expect(runProbeCli(args("skill-absent"), { env }).code).toBe(0);

    const measurementDirs = await readdir(out);
    expect(measurementDirs).toEqual([`${SCENARIO}-deadbeef`]);
    expect((await readdir(join(out, measurementDirs[0]))).sort()).toEqual(["skill-absent-1", "skill-present-1"]);
  });

  it("without --measurement-id, two separate invocations land in two separate measurement directories", async () => {
    const out = join(await tempDir(), "measurements");
    const env = await fakeClaudeEnv();
    const args = (condition) => ["--scenario", SCENARIO, "--condition", condition, "--repetition", "1", "--out", out];

    expect(runProbeCli(args("skill-present"), { env }).code).toBe(0);
    expect(runProbeCli(args("skill-absent"), { env }).code).toBe(0);

    expect(await readdir(out)).toHaveLength(2);
  });
});

describe("probe.mjs --condition/--repetition, bad invocations", () => {
  it("exits 2 when --condition is given without --repetition", () => {
    const result = runProbeCli(["--dry-run", "--condition", "skill-present"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/must be given together/);
  });

  it("exits 2 when --repetition is given without --condition", () => {
    const result = runProbeCli(["--dry-run", "--repetition", "1"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/must be given together/);
  });

  it("exits 2 when combined with --conditions", () => {
    const result = runProbeCli(["--dry-run", "--conditions", "skill-present", "--condition", "skill-present", "--repetition", "1"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/combine with --conditions or --repetitions is not allowed/);
  });

  it("exits 2 when combined with --repetitions", () => {
    const result = runProbeCli(["--dry-run", "--repetitions", "1", "--condition", "skill-present", "--repetition", "1"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/combine with --conditions or --repetitions is not allowed/);
  });

  it("exits 2 on an unknown condition", () => {
    const result = runProbeCli(["--dry-run", "--condition", "sideways", "--repetition", "1"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/Unknown condition/);
  });

  it("exits 2 on a non-positive-integer repetition", () => {
    const result = runProbeCli(["--dry-run", "--condition", "skill-present", "--repetition", "0"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/--repetition must be a positive integer/);
  });

  it("selects and records exactly one probe under --dry-run", () => {
    const result = runProbeCli([
      "--dry-run",
      "--scenario",
      SCENARIO,
      "--condition",
      "skill-present",
      "--repetition",
      "7",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Probe matrix: 1 probe\(s\)/);
    expect(result.stdout).toContain(`${SCENARIO} skill-present #7`);
  });
});

describe("probe.mjs --measurement-id, bad invocation", () => {
  it("exits 2 on a value containing a path separator", () => {
    const result = runProbeCli(["--dry-run", "--measurement-id", "a/b"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/no path separators/);
  });

  it("exits 2 on an empty value", () => {
    const result = runProbeCli(["--dry-run", "--measurement-id", ""]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/non-empty id/);
  });
});

describe("probe.mjs --emit-matrix", () => {
  it("prints the probe and judgment matrices as one JSON document, and spawns nothing", () => {
    const result = runProbeCli(["--emit-matrix", "--repetitions", "1"]);
    expect(result.code).toBe(0);

    const payload = JSON.parse(result.stdout);
    expect(payload.admission).toMatchObject({ admitted: true, probeCount: 2, limit: null });
    expect(payload.probes).toHaveLength(2);
    expect(payload.judgments).toHaveLength(1);

    // every probe of the one selected scenario carries the same
    // measurementId and measurementDirName as its judgment entry — one
    // expansion of one fact, not two that could disagree.
    const [judgment] = payload.judgments;
    for (const probe of payload.probes) {
      expect(probe.scenarioId).toBe(judgment.scenarioId);
      expect(probe.measurementId).toBe(judgment.measurementId);
      expect(probe.measurementDirName).toBe(judgment.measurementDirName);
    }
    expect(judgment.measurementDirName).toBe(`${judgment.scenarioId}-${judgment.measurementId}`);
  });

  it("honors a fixed --measurement-id in its emitted matrix", () => {
    const result = runProbeCli(["--emit-matrix", "--measurement-id", "cafef00d"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    for (const entry of [...payload.probes, ...payload.judgments]) {
      expect(entry.measurementId).toBe("cafef00d");
    }
  });

  it("still names the count and the limit, and exits 1, on a refused dispatch", () => {
    const result = runProbeCli(["--emit-matrix", "--limit", "3"]);
    expect(result.code).toBe(1);

    // machine-readable channel: the admission outcome is in the JSON too.
    const payload = JSON.parse(result.stdout);
    expect(payload.admission.admitted).toBe(false);
    expect(payload.admission.probeCount).toBe(6);
    expect(payload.admission.limit).toBe(3);

    // human-readable channel: the same count and limit, in the log.
    expect(result.stderr).toContain("6");
    expect(result.stderr).toContain("3");
  });

  it("writes nothing to disk", async () => {
    const out = join(await tempDir(), "measurements");
    const result = runProbeCli(["--emit-matrix", "--out", out]);
    expect(result.code).toBe(0);
    await expect(readdir(out)).rejects.toThrow();
  });
});
