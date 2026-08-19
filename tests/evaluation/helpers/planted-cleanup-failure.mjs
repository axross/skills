// plants exactly one cleanup failure — a throwing `rm(path, { recursive:
// true, force: true })` — the shape of the temporary-directory removal at
// each of three sites this covers (probe-runner.mjs, evaluate-runner.mjs,
// factor-judgment.mjs). Every other node:fs/promises call, including any
// other shape of `rm` call (mock-workspace.mjs's own single-file
// `rm(historyPath)`, for instance), passes through to the real
// implementation untouched — so a scenario's whole materialize() still
// completes normally around the one planted failure.
//
// `pathIncludes` is required, not optional, because more than one of these
// three sites can be live inside a single call under test —
// evaluate-runner.mjs's own workspace cleanup and factor-judgment.mjs's
// per-factor scratch-directory cleanup both fire inside one
// evaluateMeasurement() call, both shaped identically. Without narrowing by
// path, "the first matching call" would silently plant the failure at
// whichever site happens to run first rather than the one a test names.
// mock-workspace.mjs's materialize() mints the workspace under a
// "skill-evaluation-" prefix; factor-judgment.mjs's scratch directory is
// prefixed "evaluate-context-" — see each site's own mkdtemp call.
//
// the caller MUST write `vi.mock(import("node:fs/promises"), { spy: true
// });` at its own file's top level before using this helper. `vi.mock` is
// hoisted above every import in the file that calls it, which is what lets
// the spy be in place before the source module under test ever imports
// `rm` — a helper module cannot do that hoisting on a caller's behalf, only
// a call written in the test file itself can.

import { vi } from "vitest";

/**
 * @param {{ pathIncludes: string, message?: string }} options `pathIncludes`
 *   narrows which `rm` call is made to fail — see this file's header.
 *   `message` is the planted error's text, ENOTEMPTY-shaped by default to
 *   match the real workspace-removal failure this coverage guards against.
 * @returns {Promise<{ triggered: boolean, restore: () => void }>}
 *   `triggered` is read after the call under test completes, and is `true`
 *   once the planted failure has fired; `restore` must be called (from a
 *   `finally`) to hand the real `rm` back for the rest of the test file.
 */
export async function plantCleanupFailure({ pathIncludes, message = "ENOTEMPTY: planted cleanup failure" }) {
  const fsPromises = await import("node:fs/promises");
  // vi.importActual, not `fsPromises.rm` read before spyOn: under spy-mode
  // vi.mock, that property is a live binding back to whatever `rm` currently
  // is, so capturing it and then reassigning it with vi.spyOn makes the
  // "real" implementation call back into itself — an infinite recursion this
  // sidesteps by reaching past the mock registry entirely.
  const { rm: realRm } = await vi.importActual("node:fs/promises");
  const state = { triggered: false };

  const spy = vi.spyOn(fsPromises, "rm").mockImplementation(async (path, options) => {
    const isTargetShape = options?.recursive && options?.force;
    const isTargetPath = String(path).includes(pathIncludes);
    if (!state.triggered && isTargetShape && isTargetPath) {
      state.triggered = true;
      throw new Error(message);
    }
    return realRm(path, options);
  });

  return {
    get triggered() {
      return state.triggered;
    },
    restore: () => spy.mockRestore(),
  };
}
