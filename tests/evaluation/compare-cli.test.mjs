import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { runScript } from "../helpers/run.mjs";
import { digest, treatmentFixture, withReasoningOutput } from "./helpers/treatment-fixture.mjs";

const CLI = "tools/evaluation/compare.mjs";

/** stores synthetic inputs separately, with no measured artifacts or live actors. */
async function storedInputs(fixture = treatmentFixture()) {
  const directory = await tempDir();
  const paths = [join(directory, "declaration.json"), join(directory, "observations.json")];
  const bytes = [JSON.stringify(fixture.declaration), JSON.stringify(fixture.observations)];
  await Promise.all(paths.map((path, index) => writeFile(path, bytes[index], "utf8")));
  return { paths, bytes };
}

describe("compare.mjs", () => {
  it("prints help without reading inputs", () => {
    const result = runScript(CLI, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^Usage: compare\.mjs/);
  });

  it.each([[], ["--unknown"], ["declaration.json"], ["a", "b", "--check"]])("rejects bad arguments %j with exit 2", (...args) => {
    const result = runScript(CLI, args);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
  });

  it("emits one offline JSON report and preserves both inputs byte-for-byte", async () => {
    const { paths, bytes } = await storedInputs(withReasoningOutput(treatmentFixture()));

    const result = runScript(CLI, paths);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    const report = JSON.parse(result.stdout);
    expect(report.axes.conformity.effect).toBe(1);
    expect(report.inputFiles).toEqual({ declaration: { content: digest(bytes[0]) }, observations: { content: digest(bytes[1]) } });
    expect(result.stdout).not.toContain("private synthetic output");
    expect(await Promise.all(paths.map((path) => readFile(path, "utf8")))).toEqual(bytes);
  });

  it("reports unknown as data with exit 0 instead of silently omitting a cell", async () => {
    const fixture = treatmentFixture();
    fixture.observations.records.pop();
    const { paths } = await storedInputs(fixture);

    const result = runScript(CLI, paths);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ qualification: { status: "unknown" }, counts: { planned: 2, observedStarted: 1 }, primaryComplete: false });
  });

  it("rejects duplicate cells with exit 1 and no partial report", async () => {
    const fixture = treatmentFixture();
    fixture.observations.records.push(structuredClone(fixture.observations.records[0]));
    const { paths } = await storedInputs(fixture);

    const result = runScript(CLI, paths);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("duplicate");
  });

  it("rejects a shared declaration/observation file", async () => {
    const { paths } = await storedInputs();
    const result = runScript(CLI, [paths[0], paths[0]]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("separate inputs");
  });

  it("does not expose malformed input payloads in parser diagnostics", async () => {
    const { paths } = await storedInputs();
    await writeFile(paths[1], 'private synthetic secret: {"records":', "utf8");
    const result = runScript(CLI, paths);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("not valid JSON");
    expect(result.stderr).not.toContain("private synthetic secret");
  });

  it("fails unreadable inputs without a report", () => {
    const result = runScript(CLI, ["/missing/declaration.json", "/missing/observations.json"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
  });
});
