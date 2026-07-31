// Every wired command must resolve to a file that exists and is executable.
//
// Claude Code invokes these three files' commands directly — the hooks in the
// settings files, and the MCP server in .mcp.json. A mistyped path or a lost
// executable bit fails silently: nothing lints them, nothing builds them, and
// the only symptom is a hook that stops running. Formatting stops being applied,
// or session telemetry stops being collected, and the next person finds out from
// the absence of an effect rather than from an error.
//
// The commands are also required to be path-form rather than bare names, since a
// bare name is a PATH lookup this check could not follow — which would make the
// assertion vacuous for exactly the entry that skipped it.

import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";

/** Files whose `hooks` blocks Claude Code reads in this repository. */
const SETTINGS_FILES = [
  ".claude/settings.json",
  ".claude/settings.local-example.json",
];

const MCP_FILE = ".mcp.json";

const REPO_ROOT = repoPath(".");

/**
 * Every `type: "command"` hook command in a settings file, in document order.
 * @param {Record<string, unknown>} settings parsed settings file
 * @returns {string[]}
 */
function hookCommandsIn(settings) {
  const commands = [];
  const hooks = /** @type {Record<string, unknown[]>} */ (settings.hooks ?? {});

  for (const entries of Object.values(hooks)) {
    for (const entry of entries) {
      for (const hook of entry?.hooks ?? []) {
        if (hook?.type === "command" && typeof hook.command === "string") {
          commands.push(hook.command);
        }
      }
    }
  }

  return commands;
}

/**
 * The file a command string invokes: its first whitespace-separated token, with
 * the project-directory variable expanded. Settings files write it bare
 * (`$CLAUDE_PROJECT_DIR`); .mcp.json must write the defaulted form
 * (`${CLAUDE_PROJECT_DIR:-.}`), because Claude Code sets that variable in the
 * server's environment rather than its own.
 * @param {string} command
 * @returns {string} absolute path
 */
function executableOf(command) {
  const [token] = command.trim().split(/\s+/);
  const expanded = token
    .replaceAll("${CLAUDE_PROJECT_DIR:-.}", REPO_ROOT)
    .replaceAll("$CLAUDE_PROJECT_DIR", REPO_ROOT);

  return isAbsolute(expanded) ? expanded : resolve(REPO_ROOT, expanded);
}

/** Every command this repository wires, paired with the file that wires it. */
async function wiredCommands() {
  const wired = [];

  for (const file of SETTINGS_FILES) {
    const settings = JSON.parse(await readFile(repoPath(file), "utf8"));
    for (const command of hookCommandsIn(settings)) {
      wired.push({ file, command });
    }
  }

  const mcp = JSON.parse(await readFile(repoPath(MCP_FILE), "utf8"));
  for (const [name, server] of Object.entries(mcp.mcpServers ?? {})) {
    if (typeof server?.command === "string") {
      wired.push({ file: `${MCP_FILE} (${name})`, command: server.command });
    }
  }

  return wired;
}

describe("wired hook and MCP commands", () => {
  it("finds commands in every file that wires them", async () => {
    // Guards the traversal itself: a restructured settings shape that this
    // walker no longer understands would otherwise pass every case below by
    // having nothing to check.
    const wired = await wiredCommands();
    const files = new Set(wired.map(({ file }) => file.split(" ")[0]));

    expect(files).toEqual(new Set([...SETTINGS_FILES, MCP_FILE]));
  });

  it("resolves each command to an executable file", async () => {
    for (const { file, command } of await wiredCommands()) {
      expect(
        command,
        `${file} wires "${command}" as a bare name, which is a PATH lookup this check cannot follow`,
      ).toContain("/");

      const path = executableOf(command);

      const stats = await stat(path).catch(() => null);
      expect(stats, `${file} wires "${command}", but ${path} does not exist`)
        .not.toBeNull();
      expect(
        stats?.isFile(),
        `${file} wires "${command}", but ${path} is not a file`,
      ).toBe(true);

      const executable = await access(path, constants.X_OK).then(
        () => true,
        () => false,
      );
      expect(
        executable,
        `${file} wires "${command}", but ${path} is not executable — chmod +x it`,
      ).toBe(true);
    }
  });
});
