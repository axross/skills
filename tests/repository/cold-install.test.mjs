import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";

/** an offline project with a local tool dependency and isolated npm config/cache. */
async function fixture() {
  const root = await tempDir();
  const manifest = join(root, "package.json");
  const lockfile = join(root, "package-lock.json");
  mkdirSync(join(root, "tool"));
  writeFileSync(
    join(root, "tool", "package.json"),
    JSON.stringify({ name: "tool", version: "1.0.0" }),
  );
  writeFileSync(
    manifest,
    JSON.stringify({
      name: "fixture",
      version: "1.0.0",
      private: true,
      devDependencies: { tool: "file:./tool" },
    }),
  );
  writeFileSync(join(root, "user.npmrc"), "");
  writeFileSync(join(root, "global.npmrc"), "");

  const npm = (...args) =>
    spawnSync(
      "npm",
      [
        ...args,
        "--offline",
        "--no-audit",
        "--no-fund",
        `--cache=${join(root, "cache")}`,
        `--userconfig=${join(root, "user.npmrc")}`,
        `--globalconfig=${join(root, "global.npmrc")}`,
      ],
      { cwd: root, encoding: "utf8" },
    );
  const locked = npm("install", "--package-lock-only");
  expect(locked.status, locked.stderr).toBe(0);
  return { root, manifest, lockfile, npm };
}

describe("cold and warm dependency installs", () => {
  it("installs the locked tool without file changes and cleans an existing dependency tree", async () => {
    const project = await fixture();
    const manifest = readFileSync(project.manifest, "utf8");
    const lockfile = readFileSync(project.lockfile, "utf8");
    expect(existsSync(join(project.root, "node_modules"))).toBe(false);

    const cold = project.npm("ci");
    expect(cold.status, cold.stderr).toBe(0);
    expect(
      JSON.parse(
        readFileSync(
          join(project.root, "node_modules", "tool", "package.json"),
          "utf8",
        ),
      ).version,
    ).toBe("1.0.0");
    expect(readFileSync(project.manifest, "utf8")).toBe(manifest);
    expect(readFileSync(project.lockfile, "utf8")).toBe(lockfile);

    const cache = join(project.root, "node_modules", ".cache");
    mkdirSync(cache);
    const sentinel = join(cache, "warm-sentinel");
    writeFileSync(sentinel, "cached dependencies\n");
    const clean = project.npm("ci");
    expect(clean.status, clean.stderr).toBe(0);
    expect(existsSync(sentinel)).toBe(false);
    expect(readFileSync(project.manifest, "utf8")).toBe(manifest);
    expect(readFileSync(project.lockfile, "utf8")).toBe(lockfile);
  });

  it("rejects a missing lock entry instead of repairing it, while warm install can repair and reuse", async () => {
    const project = await fixture();
    const installed = project.npm("ci");
    expect(installed.status, installed.stderr).toBe(0);
    mkdirSync(join(project.root, "added-tool"));
    writeFileSync(
      join(project.root, "added-tool", "package.json"),
      JSON.stringify({ name: "added-tool", version: "2.0.0" }),
    );
    const manifest = JSON.parse(readFileSync(project.manifest, "utf8"));
    manifest.devDependencies["added-tool"] = "file:./added-tool";
    writeFileSync(project.manifest, JSON.stringify(manifest));
    const manifestBytes = readFileSync(project.manifest, "utf8");
    const lockfile = readFileSync(project.lockfile, "utf8");

    const rejected = project.npm("ci");
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toMatch(/package.json.*package-lock.json.*in sync/);
    expect(rejected.stderr).toMatch(
      /Missing: added-tool@2\.0\.0 from lock file/,
    );
    expect(readFileSync(project.manifest, "utf8")).toBe(manifestBytes);
    expect(readFileSync(project.lockfile, "utf8")).toBe(lockfile);

    const cache = join(project.root, "node_modules", ".cache");
    mkdirSync(cache, { recursive: true });
    const sentinel = join(cache, "warm-sentinel");
    writeFileSync(sentinel, "cached dependencies\n");
    const warm = project.npm("install");
    expect(warm.status, warm.stderr).toBe(0);
    expect(readFileSync(sentinel, "utf8")).toBe("cached dependencies\n");
    expect(
      JSON.parse(
        readFileSync(
          join(project.root, "node_modules", "added-tool", "package.json"),
          "utf8",
        ),
      ).version,
    ).toBe("2.0.0");
    expect(readFileSync(project.lockfile, "utf8")).not.toBe(lockfile);
    expect(readFileSync(project.manifest, "utf8")).toBe(manifestBytes);
    const reconciled = project.npm("ci");
    expect(reconciled.status, reconciled.stderr).toBe(0);
    expect(existsSync(sentinel)).toBe(false);
  });
});
