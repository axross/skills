// a fake `spawnFn` for callReasoningJudge (tools/evaluation/src/judge.mjs),
// in the same EventEmitter shape probe-process.test.mjs's own fakeChild()
// drives real child_process-spawning code with — so a test can exercise
// judge.mjs's real branching logic (a well-formed envelope, a spawn
// failure, a non-zero exit, an is_error envelope, unreadable stdout)
// without ever spawning a real `claude`.
//
// every helper here schedules its child's events on the next microtask,
// after callReasoningJudge has already attached its listeners — mirroring
// the async gap a real child_process would have between spawnFn returning
// and its first "data"/"close" event.

import { EventEmitter } from "node:events";

/** a stand-in child_process.ChildProcess: an EventEmitter with piped-like stdout/stderr. */
export function fakeJudgeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stderr = new EventEmitter();
  child.stderr.setEncoding = () => {};
  child.kill = () => {};
  return child;
}

/**
 * a spawnFn whose child prints one `--output-format json` envelope and
 * exits 0 — the well-formed case most tests want without wiring up events
 * themselves.
 *
 * @param {{ result: string, isError?: boolean, subtype?: string }} envelope
 * @returns {(...args: unknown[]) => ReturnType<typeof fakeJudgeChild>}
 */
export function spawnFnEnvelope({ result, isError = false, subtype = "success" }) {
  return () => {
    const child = fakeJudgeChild();
    queueMicrotask(() => {
      child.stdout.emit(
        "data",
        `${JSON.stringify({
          type: "result",
          subtype,
          is_error: isError,
          permission_denials: [],
          total_cost_usd: 0.01,
          result,
        })}\n`,
      );
      child.emit("close", 0);
    });
    return child;
  };
}

/** a spawnFn whose child fires a spawn-time "error" event instead of ever producing output. */
export function spawnFnError(message) {
  return () => {
    const child = fakeJudgeChild();
    queueMicrotask(() => child.emit("error", new Error(message)));
    return child;
  };
}

/** a spawnFn whose child exits non-zero, optionally with stderr text. */
export function spawnFnExit(exitCode, stderr = "") {
  return () => {
    const child = fakeJudgeChild();
    queueMicrotask(() => {
      if (stderr) child.stderr.emit("data", stderr);
      child.emit("close", exitCode);
    });
    return child;
  };
}

/** a spawnFn whose child prints raw (non-envelope) stdout and exits 0. */
export function spawnFnStdout(stdout) {
  return () => {
    const child = fakeJudgeChild();
    queueMicrotask(() => {
      child.stdout.emit("data", stdout);
      child.emit("close", 0);
    });
    return child;
  };
}
