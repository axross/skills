import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { repoPath } from "../helpers/run.mjs";

const executable = (path, contents) => writeFileSync(path, contents, { mode: 0o755 });

const fixture = async ({ nodeEngine = "26", nodeVersion = "v26.1.0" } = {}) => {
  const root = await tempDir();
  const workspace = join(root, "workspace");
  const home = join(root, "home");
  const bin = join(root, "bin");
  mkdirSync(join(workspace, ".agents"), { recursive: true });
  mkdirSync(join(home, ".local", "bin"), { recursive: true });
  mkdirSync(bin, { recursive: true });
  cpSync(repoPath(".agents/setup"), join(workspace, ".agents", "setup"));
  writeFileSync(join(workspace, "package.json"), JSON.stringify({ engines: { node: nodeEngine } }));
  writeFileSync(join(workspace, "package-lock.json"), "lock\n");

  executable(
    join(home, ".local", "bin", "mise"),
    `#!/bin/bash
case "$1" in
  --version) echo '2026.9.1 linux-x64' ;;
  install) : ;;
  env) echo 'export PATH="${bin}:$PATH"' ;;
  activate) echo 'export SKILLS_MISE_ACTIVE=1' ;;
esac
`,
  );
  executable(join(bin, "node"), `#!/bin/bash\necho '${nodeVersion}'\n`);
  executable(
    join(bin, "npm"),
    `#!/bin/bash
if [[ "$1" == install ]]; then
  echo npm >> '${root}/npm-calls'
  mkdir -p node_modules
fi
echo '11.0.0'
`,
  );

  const run = () =>
    spawnSync("bash", [join(workspace, ".agents", "setup")], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` },
    });

  return { bin, home, root, run, workspace };
};

const npmCalls = (root) => {
  try {
    return readFileSync(join(root, "npm-calls"), "utf8").trim().split("\n").length;
  } catch {
    return 0;
  }
};

const sourceProfile = (setup, directory) =>
  execFileSync(
    "bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `cd '${directory}'; source '${setup.home}/.bash_profile'; printf %s "\${SKILLS_MISE_ACTIVE:-}"`,
    ],
    { encoding: "utf8", env: { ...process.env, HOME: setup.home, PATH: "/usr/bin:/bin" } },
  );

describe(".agents/setup", () => {
  it("restores cold dependencies and skips an unchanged warm restore", async () => {
    const setup = await fixture();
    const cold = setup.run();
    expect(cold.status, cold.stderr).toBe(0);
    expect(npmCalls(setup.root)).toBe(1);

    const warm = setup.run();
    expect(warm.status, warm.stderr).toBe(0);
    expect(warm.stdout).toMatch(/skipping npm install/);
    expect(npmCalls(setup.root)).toBe(1);
  });

  it("writes one repository-scoped profile block and migrates the legacy block", async () => {
    const setup = await fixture();
    const child = join(setup.workspace, "child");
    mkdirSync(child);
    writeFileSync(
      join(setup.home, ".bash_profile"),
      `# before\n# skills Amp orb toolchain\nexport MISE_GLOBAL_CONFIG_FILE="$HOME/.config/mise/skills.toml"\nexport PATH="$HOME/.local/bin:$PATH"\nif command -v mise >/dev/null 2>&1; then\n  eval "$(mise activate bash)"\nfi\n# after\n`,
    );

    expect(setup.run().status).toBe(0);
    expect(setup.run().status).toBe(0);
    const profile = readFileSync(join(setup.home, ".bash_profile"), "utf8");
    expect(profile.match(/# skills Amp orb toolchain/g)).toHaveLength(1);
    expect(profile).toContain(`"${setup.workspace}"|"${setup.workspace}"/*)`);
    expect(profile).toContain("# before\n# after");
    expect(sourceProfile(setup, child)).toBe("1");
    expect(sourceProfile(setup, setup.root)).toBe("");
  });

  it("rejects a malformed Node engine", async () => {
    const setup = await fixture({ nodeEngine: ">=26" });
    const result = setup.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/engines\.node must be an exact numeric major/);
    expect(npmCalls(setup.root)).toBe(0);
  });

  it("fails when the downloaded mise binary fails integrity verification", async () => {
    const setup = await fixture();
    writeFileSync(join(setup.home, ".local", "bin", "mise"), "wrong", { mode: 0o644 });
    executable(join(setup.bin, "curl"), "#!/bin/bash\nprintf bad > \"${@: -1}\"\n");
    executable(join(setup.bin, "sha256sum"), "#!/bin/bash\n[[ \"$1\" != --check ]]\n");
    const result = setup.run();
    expect(result.status).not.toBe(0);
    expect(npmCalls(setup.root)).toBe(0);
  });

  it("fails when the provisioned Node major does not match", async () => {
    const setup = await fixture({ nodeVersion: "v25.9.0" });
    const result = setup.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Node version mismatch: expected v26\.x, actual: v25\.9\.0/);
  });
});
