// installs fake-claude.mjs as an executable literally named `claude` on
// PATH, ahead of any real one, so a test can drive real subprocess-spawning
// code (probe-process.mjs's runProbeProcess, or a CLI script that calls it)
// through a real OS process boundary without ever reaching the network.
//
// `spawn`/`spawnSync` resolve a bare command name by searching PATH for an
// executable file, not by asking Node's module resolution — so this has to
// be a real, `chmod +x`'d file, not an import.

import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { onTestFinished } from "vitest";

const FAKE_CLAUDE_SOURCE = join(dirname(fileURLToPath(import.meta.url)), "fake-claude.mjs");

/**
 * @returns {Promise<string>} a directory containing an executable `claude`,
 *   removed when the current test finishes
 */
export async function fakeClaudeBinDir() {
  const dir = await mkdtemp(join(tmpdir(), "fake-claude-bin-"));
  onTestFinished(() => rm(dir, { recursive: true, force: true }));

  // fake-claude.mjs already carries its own shebang, on its own first line —
  // stripped here and replaced rather than doubled, since a second `#!` line
  // is not a comment to Node, it is a syntax error.
  const source = await readFile(FAKE_CLAUDE_SOURCE, "utf8");
  const body = source.startsWith("#!") ? source.slice(source.indexOf("\n") + 1) : source;
  const target = join(dir, "claude");
  await writeFile(target, `#!/usr/bin/env node\n${body}`, "utf8");
  await chmod(target, 0o755);
  return dir;
}

/**
 * `process.env` with the fake `claude` bin directory prepended to `PATH`,
 * plus whatever `FAKE_CLAUDE_*` overrides fake-claude.mjs reads.
 *
 * @param {Record<string,string>} [overrides]
 * @returns {Promise<Record<string,string>>}
 */
export async function fakeClaudeEnv(overrides = {}) {
  const binDir = await fakeClaudeBinDir();
  return { ...process.env, PATH: `${binDir}:${process.env.PATH}`, ...overrides };
}
