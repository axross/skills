import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { runScript } from "../helpers/run.mjs";
import { digest, treatmentFixture, withReasoningOutput } from "./helpers/treatment-fixture.mjs";

const CLI = "tools/evaluation/compare.mjs";

/**
 * stores synthetic inputs separately, with no measured artifacts or live actors.
 * @throws {Error} when temporary-directory creation or input writes fail
 */
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

  it("reports a confounded comparison with exit 0 and preserves both inputs byte-for-byte", async () => {
    const fixture = treatmentFixture();
    fixture.observations.records.at(-1).fixed.model = "vendor/different-probe-model";
    const { paths, bytes } = await storedInputs(fixture);

    const result = runScript(CLI, paths);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    const report = JSON.parse(result.stdout);
    expect(report.qualification.status).toBe("confounded");
    expect(report.axes.conformity.effect).toBeNull();
    expect(await Promise.all(paths.map((path) => readFile(path)))).toEqual(bytes.map((value) => Buffer.from(value)));
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

  it.each([
    { surface: "observation", locator: "stored/evidence.json?synthetic-query-marker", inputLocator: (observations) => observations.records[0] },
    { surface: "evidence", locator: "//synthetic-userinfo-marker@example.test/evidence.json", inputLocator: (observations) => observations.records[0].results[2].evidence.output },
  ])("refuses an unsafe $surface locator without exposing it or changing input bytes", async ({ locator, inputLocator }) => {
    const fixture = treatmentFixture();
    inputLocator(fixture.observations).locator = locator;
    const { paths, bytes } = await storedInputs(fixture);

    const result = runScript(CLI, paths);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("locator must not carry URL credentials or queries");
    expect(result.output).not.toContain("synthetic-query-marker");
    expect(result.output).not.toContain("synthetic-userinfo-marker");
    expect(await Promise.all(paths.map((path) => readFile(path)))).toEqual(bytes.map((value) => Buffer.from(value)));
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

  it("rejects malformed UTF-8 inside an otherwise valid JSON string without exposing or changing inputs", async () => {
    const fixture = treatmentFixture();
    fixture.observations.records[0].locator = "private synthetic marker \uFFFD";
    const { paths, bytes } = await storedInputs(fixture);
    const malformed = Buffer.from(bytes[1]);
    malformed[malformed.indexOf(Buffer.from("\uFFFD"))] = 0xff;
    await writeFile(paths[1], malformed);

    const result = runScript(CLI, paths);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("not valid JSON encoded as UTF-8");
    expect(result.stderr).not.toContain("private synthetic marker");
    expect(await Promise.all(paths.map((path) => readFile(path)))).toEqual([Buffer.from(bytes[0]), malformed]);
  });

  it("accepts a valid UTF-8 replacement character without changing input bytes", async () => {
    const fixture = treatmentFixture();
    fixture.observations.records[0].locator = "private synthetic marker \uFFFD";
    const { paths, bytes } = await storedInputs(fixture);

    const result = runScript(CLI, paths);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    const report = JSON.parse(result.stdout);
    expect(report.cells[0].observation.locator).toBe("private synthetic marker \uFFFD");
    expect(report.qualification.status).toBe("qualified");
    expect(report.axes.conformity.effect).toBe(1);
    expect(await Promise.all(paths.map((path) => readFile(path)))).toEqual(bytes.map((value) => Buffer.from(value)));
  });

  it("fails unreadable inputs without a report", () => {
    const result = runScript(CLI, ["/missing/declaration.json", "/missing/observations.json"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
  });
});
