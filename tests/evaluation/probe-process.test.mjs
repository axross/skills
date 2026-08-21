// buildProbeArgv / runProbeProcess: the CLI invocation this instrument
// builds, and the turn-cap runaway guard — verified against `claude --help`
// in this environment (no `--max-turns` flag exists), so the cap is
// enforced by watching the stream rather than assumed into a flag that
// would fail a real run.
//
// most cases here hand runProbeProcess a fake, in-process "child process"
// (an EventEmitter standing in for the real one) so the turn-cap kill logic
// can be driven deterministically. One case drives a real OS process
// through tests/evaluation/helpers/fake-cli.mjs, proving the same logic
// against Node's own child_process rather than only against a stand-in.

import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import { fakeClaudeEnv } from "./helpers/fake-cli.mjs";
import {
  ALLOWED_TOOLS,
  buildProbeArgv,
  DISALLOWED_TOOLS,
  runProbeProcess,
} from "../../tools/evaluation/src/probe-process.mjs";
import { MODEL, SETTING_SOURCES } from "../../tools/evaluation/src/spawn.mjs";

describe("buildProbeArgv", () => {
  it("passes the prompt, the pinned model, and the setting-sources isolation flag", () => {
    const argv = buildProbeArgv({ prompt: "do the thing" });
    expect(argv).toContain("do the thing");
    expect(argv).toEqual(expect.arrayContaining(["--model", MODEL]));
    expect(argv).toEqual(expect.arrayContaining(["--setting-sources", SETTING_SOURCES.join(",")]));
    expect(argv).toEqual(expect.arrayContaining(["--output-format", "stream-json"]));
    expect(argv).toContain("--verbose");
  });

  it("passes the tool allow/deny lists joined, not as separate arguments", () => {
    const argv = buildProbeArgv({ prompt: "x" });
    expect(argv).toEqual(expect.arrayContaining(["--allowed-tools", ALLOWED_TOOLS.join(",")]));
    expect(argv).toEqual(expect.arrayContaining(["--disallowed-tools", DISALLOWED_TOOLS.join(",")]));
  });

  it("bypasses the interactive permission prompt — a probe runs unattended", () => {
    const argv = buildProbeArgv({ prompt: "x" });
    expect(argv).toEqual(expect.arrayContaining(["--permission-mode", "bypassPermissions"]));
  });

  it("names no tool the CLI does not have — an allowance that allows nothing", () => {
    // `--allowed-tools` is additive: naming a tool the CLI lacks does
    // nothing at all, so a dead name here is silently inert rather than an
    // error. `TodoWrite` sat here for exactly that reason until the CLI's
    // own reported surface was read against it.
    expect(ALLOWED_TOOLS).not.toContain("TodoWrite");
  });

  it("denies every tool that would delegate a probe's own work to another agent", () => {
    // #392's reasoning — a probe's effect has to be attributable to the
    // skill under test — reaches the whole task family, not only the two
    // names it was originally written against.
    expect(DISALLOWED_TOOLS).toEqual(
      expect.arrayContaining([
        "Agent",
        "Task",
        "TaskCreate",
        "TaskGet",
        "TaskList",
        "TaskOutput",
        "TaskStop",
        "TaskUpdate",
        "Workflow",
      ]),
    );
  });

  it("denies every tool that would reach outside the probe workspace", () => {
    expect(DISALLOWED_TOOLS).toEqual(
      expect.arrayContaining([
        "Artifact",
        "CronCreate",
        "PushNotification",
        "RemoteTrigger",
        "ScheduleWakeup",
        "SendMessage",
        "SendUserFile",
        "WebFetch",
        "WebSearch",
      ]),
    );
  });

  it("leaves ToolSearch reachable, since everything worth denying behind it is denied by name", () => {
    expect(DISALLOWED_TOOLS).not.toContain("ToolSearch");
  });

  it("never emits a flag this environment's CLI does not recognize", () => {
    // `claude --help`, read before this module was written: no `--max-turns`
    // flag exists today. this asserts the negative so a future re-add of one
    // is a deliberate, visible edit rather than a silent regression back to
    // an option that does not work.
    expect(buildProbeArgv({ prompt: "x" })).not.toContain("--max-turns");
  });
});

/** a stand-in child_process.ChildProcess: an EventEmitter with a `.kill()` and piped-like stdout/stderr. */
function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stderr = new EventEmitter();
  child.stderr.setEncoding = () => {};
  child.killed = false;
  child.kill = (signal) => {
    child.killed = true;
    child.killSignal = signal;
  };
  return child;
}

describe("runProbeProcess", () => {
  it("resolves with stdout and the exit code on a normal completion", async () => {
    const child = fakeChild();
    const spawnFn = () => child;
    const promise = runProbeProcess({ argv: [], cwd: "/tmp", env: {}, spawnFn });

    child.stdout.emit("data", '{"type":"system"}\n{"type":"result","num_turns":2}\n');
    child.emit("close", 0);

    await expect(promise).resolves.toEqual({
      stdout: '{"type":"system"}\n{"type":"result","num_turns":2}\n',
      stderr: "",
      exitCode: 0,
      killedByTurnCap: false,
    });
  });

  it("captures stderr separately from stdout", async () => {
    const child = fakeChild();
    const spawnFn = () => child;
    const promise = runProbeProcess({ argv: [], cwd: "/tmp", env: {}, spawnFn });

    child.stderr.emit("data", "a warning\n");
    child.emit("close", 0);

    const result = await promise;
    expect(result.stderr).toBe("a warning\n");
  });

  it("rejects when the child process itself could not be spawned", async () => {
    const child = fakeChild();
    const spawnFn = () => child;
    const promise = runProbeProcess({ argv: [], cwd: "/tmp", env: {}, spawnFn });

    child.emit("error", new Error("ENOENT"));

    await expect(promise).rejects.toThrow("ENOENT");
  });

  // the runaway guard docs/glossary.md's "Turn cap" describes: killed once
  // the cap is reached, never waiting for the process to finish naturally.
  it("kills the process once it has produced `turnCap` assistant turns", async () => {
    const child = fakeChild();
    const spawnFn = () => child;
    const promise = runProbeProcess({ argv: [], cwd: "/tmp", env: {}, turnCap: 2, spawnFn });

    child.stdout.emit("data", '{"type":"system"}\n');
    child.stdout.emit("data", '{"type":"assistant"}\n{"type":"assistant"}\n{"type":"assistant"}\n');
    expect(child.killed).toBe(true);
    expect(child.killSignal).toBe("SIGTERM");

    // the process still has to actually exit before the promise resolves —
    // a real SIGTERM does not settle instantly either.
    child.emit("close", null);
    await expect(promise).resolves.toEqual(
      expect.objectContaining({ killedByTurnCap: true, exitCode: null }),
    );
  });

  it("does not kill the process for a line it cannot parse as JSON", async () => {
    const child = fakeChild();
    const spawnFn = () => child;
    const promise = runProbeProcess({ argv: [], cwd: "/tmp", env: {}, turnCap: 1, spawnFn });

    child.stdout.emit("data", "not json at all\n");
    expect(child.killed).toBe(false);

    child.emit("close", 0);
    await expect(promise).resolves.toEqual(expect.objectContaining({ killedByTurnCap: false }));
  });

  it("counts assistant turns split across chunk boundaries", async () => {
    const child = fakeChild();
    const spawnFn = () => child;
    const promise = runProbeProcess({ argv: [], cwd: "/tmp", env: {}, turnCap: 1, spawnFn });

    child.stdout.emit("data", '{"type":"assist');
    expect(child.killed).toBe(false);
    child.stdout.emit("data", 'ant"}\n');
    expect(child.killed).toBe(true);

    child.emit("close", null);
    await promise;
  });

  it("drives a real OS process end to end through a fake `claude` on PATH", async () => {
    const env = await fakeClaudeEnv({ FAKE_CLAUDE_ASSISTANT_TURNS: "3" });
    const result = await runProbeProcess({ argv: ["--print", "hi"], cwd: process.cwd(), env });

    expect(result.exitCode).toBe(0);
    expect(result.killedByTurnCap).toBe(false);
    expect(result.stdout).toContain('"type":"result"');
  });

  it("kills a real OS process once the turn cap is reached", async () => {
    const env = await fakeClaudeEnv({ FAKE_CLAUDE_ASSISTANT_TURNS: "50", FAKE_CLAUDE_TURN_DELAY_MS: "20" });
    const result = await runProbeProcess({ argv: ["--print", "hi"], cwd: process.cwd(), env, turnCap: 3 });

    expect(result.killedByTurnCap).toBe(true);
    // system + 3 assistant lines only — the rest of the 50 never got written.
    expect(result.stdout.trim().split("\n").length).toBeLessThanOrEqual(4);
  });
});
