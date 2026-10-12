import { describe, expect, it } from "vitest";

import { computeTreatmentReport } from "../../tools/evaluation/src/treatment-report.mjs";
import { declaredOpportunity, digest, treatmentFixture, withReasoningOutput } from "./helpers/treatment-fixture.mjs";

describe("computeTreatmentReport()", () => {
  it("qualifies exactly the declared old/new treatment without reinterpreting skill-present as the treatment", () => {
    const { declaration, observations } = treatmentFixture(2);
    const before = JSON.stringify({ declaration, observations });

    const report = computeTreatmentReport(declaration, observations);

    expect(report.qualification.status).toBe("qualified");
    expect(report.axes.conformity.effect).toBe(1);
    expect(report.axes.selection.effect).toBe(0);
    expect(report.counts).toEqual({ planned: 4, observedStarted: 4, observedCompleted: 4 });
    expect(report.cells[0]).toMatchObject({ treatment: "old", condition: "skill-present", observation: { id: "old-1", provenance: "synthetic", scope: "unqualified worker/resume/guard simulation" } });
    expect(JSON.stringify({ declaration, observations })).toBe(before);
    expect(report.claimLimits).toContain("synthetic observations test this report, not host behavior");
  });

  it.each(["guidance", "adapters"])("accepts an explicitly named %s revision and still checks its exact cell identities", (kind) => {
    const { declaration, observations } = treatmentFixture();
    const name = kind === "guidance" ? "policy" : "adapter";
    declaration.allowedDifferences.push({ kind, name });
    declaration.treatments[1].materials[kind][name] = { source: "revised", content: digest("revised") };
    observations.records[1].materials[kind][name] = structuredClone(declaration.treatments[1].materials[kind][name]);

    expect(computeTreatmentReport(declaration, observations).axes.conformity.effect).toBe(1);
  });

  it.each([
    ["peer", (record) => { record.materials.skills.peer.content = digest("late peer"); }],
    ["absent peer in an observed inventory", (record) => { delete record.materials.skills.peer; }],
    ["target beyond declared revision", (record) => { record.materials.skills.target.content = digest("third revision"); }],
    ["fixture", (record) => { record.fixed.fixture = digest("late fixture"); }],
    ["outcome", (record) => { record.fixed.outcome = digest("late outcome"); }],
    ["task material", (record) => { record.fixed.taskMaterial = digest("late task"); }],
    ["model", (record) => { record.fixed.model = "vendor/other-model"; }],
    ["profile", (record) => { record.fixed.profile = digest("late profile"); }],
    ["harness", (record) => { record.fixed.harness = digest("late harness"); }],
    ["adapter", (record) => { record.materials.adapters.adapter.source = "late adapter"; }],
  ])("blocks every primary effect for an undeclared %s change only in a later cell", (_, change) => {
    const { declaration, observations } = treatmentFixture(2);
    change(observations.records[3]);

    const report = computeTreatmentReport(declaration, observations);

    expect(report.qualification.status).toBe("confounded");
    expect(report.axes.conformity.effect).toBeNull();
    expect(report.axes.selection.effect).toBeNull();
    expect(report.qualification.deficits.some((entry) => entry.at.includes('"new",2'))).toBe(true);
  });

  it("does not exempt an undeclared material change just because both expectations and observations carry it", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.treatments[1].materials.skills.peer.content = digest("new peer");
    observations.records[1].materials.skills.peer.content = digest("new peer");

    const report = computeTreatmentReport(declaration, observations);

    expect(report.qualification.status).toBe("confounded");
    expect(report.axes.conformity.effect).toBeNull();
  });

  it.each([
    ["model", (fixture) => { delete fixture.observations.records[1].fixed.model; }],
    ["source", (fixture) => { delete fixture.observations.records[1].materials.skills.target.source; }],
    ["content", (fixture) => { delete fixture.observations.records[1].materials.skills.target.content; }],
    ["inventory", (fixture) => { delete fixture.observations.records[1].materials.skills; }],
    ["both expected and observed identity", (fixture) => { delete fixture.declaration.tasks[0].fixed.profile; delete fixture.observations.records[1].fixed.profile; }],
    ["condition", (fixture) => { delete fixture.observations.records[1].condition; }],
    ["provenance", (fixture) => { delete fixture.observations.records[1].provenance; }],
    ["scope", (fixture) => { delete fixture.observations.records[1].scope; }],
    ["locator", (fixture) => { delete fixture.observations.records[1].locator; }],
  ])("retains missing %s as an unknown deficit rather than assuming equality", (_, remove) => {
    const fixture = treatmentFixture();
    remove(fixture);

    const report = computeTreatmentReport(fixture.declaration, fixture.observations);

    expect(report.qualification.status).toBe("unknown");
    expect(report.axes.conformity.effect).toBeNull();
    expect(report.qualification.deficits).toContainEqual(expect.objectContaining({ kind: "unknown" }));
  });

  it("does not pool live and synthetic provenance even when fixed identities match", () => {
    const { declaration, observations } = treatmentFixture(2);
    observations.records[3].provenance = "live";

    const report = computeTreatmentReport(declaration, observations);

    expect(report.qualification.status).toBe("confounded");
    expect(report.cells[3].observation.provenance).toBe("live");
    expect(report.axes.conformity.effect).toBeNull();
  });

  it.each(["provenance", "scope"])("retains a known %s conflict even when the first observation lacks that identity", (field) => {
    const { declaration, observations } = treatmentFixture(2);
    delete observations.records[0][field];
    observations.records[3][field] = field === "provenance" ? "live" : "different observation scope";

    const report = computeTreatmentReport(declaration, observations);

    expect(report.qualification.status).toBe("confounded");
    expect(report.qualification.deficits).toContainEqual(expect.objectContaining({ kind: "unknown", at: expect.stringContaining(`.${field}`) }));
    expect(report.qualification.deficits).toContainEqual(expect.objectContaining({ kind: "confounded", at: expect.stringContaining(`.${field}`) }));
    expect(report.axes.conformity.effect).toBeNull();
  });

  it("accepts varying evidence in declared slots while retaining full prompts only in the immutable input", () => {
    const { declaration, observations } = withReasoningOutput(treatmentFixture());

    const report = computeTreatmentReport(declaration, observations);

    expect(report.axes.conformity.effect).toBe(1);
    expect(report.opportunities.find((entry) => entry.id === "output").qualification.status).toBe("qualified");
    expect(JSON.stringify(report)).not.toContain("private synthetic output");
    expect(JSON.stringify(report)).not.toContain("Fixed rubric");
    expect(observations.records[1].results[2].fullPrompt).toContain("private synthetic output new-1");
  });

  it.each(["rubric", "template", "script", "model", "route"])("blocks the affected effect for a changed scorer %s, not the independent selection axis", (field) => {
    const { declaration, observations } = withReasoningOutput(treatmentFixture());
    observations.records[1].results[2].scorer[field] = "changed scorer";

    const report = computeTreatmentReport(declaration, observations);

    expect(report.axes.conformity.effect).toBeNull();
    expect(report.axes.selection.effect).toBe(0);
    expect(report.opportunities.find((entry) => entry.id === "output").qualification.status).toBe("confounded");
  });

  it("also blocks a changed scorer declared for the candidate instead of hiding it as a treatment", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells[1].opportunities[2].scorer.rubric = digest("new rubric");
    observations.records[1].results[2].scorer.rubric = digest("new rubric");

    expect(computeTreatmentReport(declaration, observations).axes.conformity.effect).toBeNull();
  });

  it.each([
    { method: "script", makeFixture: treatmentFixture, repetition: 1 },
    { method: "script", makeFixture: treatmentFixture, repetition: 2 },
    { method: "reasoning", makeFixture: (repetitions) => withReasoningOutput(treatmentFixture(repetitions)), repetition: 1 },
    { method: "reasoning", makeFixture: (repetitions) => withReasoningOutput(treatmentFixture(repetitions)), repetition: 2 },
  ])("blocks a $method evidence-source change declared and observed in candidate repetition $repetition", ({ makeFixture, repetition }) => {
    const { declaration, observations } = makeFixture(2);
    const cell = declaration.cells.find((entry) => entry.treatment === "new" && entry.repetition === repetition);
    const record = observations.records.find((entry) => entry.id === cell.observationId);
    cell.opportunities.find((entry) => entry.id === "output").evidence.output.source = "different-evidence-producer";
    record.results.find((entry) => entry.id === "output").evidence.output.source = "different-evidence-producer";

    const report = computeTreatmentReport(declaration, observations);

    expect(report.opportunities.find((entry) => entry.id === "output").qualification.status).toBe("confounded");
    expect(report.axes.conformity.effect).toBeNull();
    expect(report.axes.conformity.populations.old.rate).toBeNull();
    expect(report.axes.conformity.populations.new.rate).toBeNull();
    expect(report.axes.selection.effect).toBe(0);
  });

  it("allows acquisition sources to track the declared treatment material rather than fixing them across treatments", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells[1].opportunities[1].evidence.output.source = "target-new";
    observations.records[1].results[1].evidence.output.source = "target-new";

    const report = computeTreatmentReport(declaration, observations);

    expect(report.opportunities.find((entry) => entry.id === "acquire").qualification.status).toBe("qualified");
    expect(report.axes.acquisition.effect).toBe(0);
    expect(report.axes.conformity.effect).toBe(1);
  });

  it("blocks a changed full prompt outside the declared evidence slot", () => {
    const { declaration, observations } = withReasoningOutput(treatmentFixture());
    observations.records[1].results[2].fullPrompt += "\nChanged instruction.";

    const report = computeTreatmentReport(declaration, observations);

    expect(report.axes.conformity.effect).toBeNull();
    expect(report.opportunities.find((entry) => entry.id === "output").qualification.status).toBe("confounded");
  });

  it("leaves legacy reasoning results with no separated scorer unqualified", () => {
    const { declaration, observations } = withReasoningOutput(treatmentFixture());
    delete observations.records[1].results[2].scorer;

    const report = computeTreatmentReport(declaration, observations);

    expect(report.axes.conformity.effect).toBeNull();
    expect(report.opportunities.find((entry) => entry.id === "output").qualification.status).toBe("unknown");
  });

  it("retains absent prompt evidence as unknown, not as a fabricated changed prompt", () => {
    const { declaration, observations } = withReasoningOutput(treatmentFixture());
    delete observations.records[1].results[2].evidence.output.payload;

    const report = computeTreatmentReport(declaration, observations);

    expect(report.opportunities.find((entry) => entry.id === "output").qualification.status).toBe("unknown");
    expect(report.axes.conformity.effect).toBeNull();
  });

  it("cannot qualify acquisition without the predeclared required content identity", () => {
    const { declaration, observations } = treatmentFixture();
    delete declaration.cells[1].opportunities[1].evidence.output.content;

    const report = computeTreatmentReport(declaration, observations);

    expect(report.opportunities.find((entry) => entry.id === "acquire").qualification.status).toBe("unknown");
    expect(report.axes.acquisition.effect).toBeNull();
    expect(report.cells[1].opportunities[2].status).toBe("pass");
  });

  it("leaves a verdict with no declared evidence unqualified without erasing independent axes", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells.forEach((cell) => {
      cell.opportunities[2].scorer.evidenceSlots = [];
      cell.opportunities[2].evidence = {};
    });
    observations.records.forEach((record) => {
      record.results[2].scorer.evidenceSlots = [];
      record.results[2].evidence = {};
    });

    const report = computeTreatmentReport(declaration, observations);

    expect(report.opportunities.find((entry) => entry.id === "output").qualification.status).toBe("unknown");
    expect(report.axes.conformity.effect).toBeNull();
    expect(report.axes.conformity.populations.new.rate).toBeNull();
    expect(report.axes.selection.effect).toBe(0);
  });

  it("conserves three planned cells with one completed pass, one started partial, and one missing", () => {
    const { declaration, observations } = treatmentFixture(2);
    declaration.cells.pop();
    observations.records = [observations.records[0], observations.records[2]];
    observations.records[1].lifecycle = "started";
    observations.records[1].status = "partial";
    observations.records[1].results[2].status = "partial";

    const report = computeTreatmentReport(declaration, observations);

    expect(report.counts).toEqual({ planned: 3, observedStarted: 2, observedCompleted: 1 });
    expect(report.cells).toHaveLength(3);
    expect(report.primaryComplete).toBe(false);
    expect(report.axes.conformity.effect).toBeNull();
    expect(report.cells.map((cell) => cell.status)).toEqual(["pass", "missing", "partial"]);
    expect(report.axes.conformity.populations.old.rate).toBeNull();
  });

  it("does not drop a missing opportunity from a completed cell's denominator", () => {
    const { declaration, observations } = treatmentFixture(2);
    observations.records[3].results.splice(2, 1);

    const report = computeTreatmentReport(declaration, observations);

    expect(report.primaryComplete).toBe(false);
    expect(report.axes.conformity.effect).toBeNull();
    expect(report.axes.selection.effect).toBe(0);
    expect(report.axes.conformity.populations.new).toMatchObject({ planned: 2, applicable: 2, observed: 1, states: { pass: 1, missing: 1 }, rate: null });
  });

  it("reports no rate for a zero applicable population", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells.forEach((cell) => { cell.opportunities[2].applicable = false; });

    const report = computeTreatmentReport(declaration, observations);

    expect(report.axes.conformity.populations.new).toMatchObject({ planned: 1, applicable: 0, inapplicable: 1, rate: null });
    expect(report.axes.conformity.effect).toBeNull();
  });

  it("keeps added and removed obligations outside the common-obligation effect", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells[0].opportunities.push(declaredOpportunity("removed", "conformity", { obligation: "old-only" }));
    declaration.cells[1].opportunities.push(declaredOpportunity("added", "conformity", { obligation: "new-only" }));

    const report = computeTreatmentReport(declaration, observations);

    expect(report.opportunities.find((entry) => entry.id === "removed")).toMatchObject({ membership: "removed", effect: null });
    expect(report.opportunities.find((entry) => entry.id === "added")).toMatchObject({ membership: "added", effect: null });
    expect(report.axes.conformity.populations.new.planned).toBe(1);
    expect(report.axes.conformity.effect).toBe(1);
  });

  it("keeps full acquisition and a violating output separate", () => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].results[2].status = "fail";

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[1].status).toBe("pass");
    expect(report.cells[1].opportunities[2].status).toBe("fail");
    expect(report.axes.acquisition.populations.new.rate).toBe(1);
    expect(report.axes.conformity.populations.new.rate).toBe(0);
  });

  it.each([
    ["parent-only", { route: "parent-only", coverage: "full" }, "unknown"],
    ["stale", { coverage: "mismatch", delivery: "stale" }, "fail"],
    ["truncated", { coverage: "partial", delivery: "truncated" }, "partial"],
    ["mixed", { coverage: "mismatch", delivery: "mixed" }, "fail"],
    ["unavailable", { availability: "unavailable", coverage: "unavailable" }, "unsupported"],
    ["unknown", { route: "unknown", coverage: "unknown" }, "unknown"],
  ])("retains %s acquisition separately from independently checked output", (_, details, status) => {
    const { declaration, observations } = treatmentFixture();
    Object.assign(observations.records[1].results[1].details, details);

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[1]).toMatchObject({ status, details });
    expect(report.cells[1].opportunities[2].status).toBe("pass");
    expect(report.axes.acquisition.populations.new.states[status]).toBe(1);
    expect(report.axes.conformity.effect).toBe(1);
    expect(report.guards[0].instrumentQualified).toBe(true);
  });

  it("does not pool different tasks' live and synthetic populations into an effect", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.tasks.push({ ...structuredClone(declaration.tasks[0]), id: "other" });
    declaration.cells.push(...declaration.cells.map((cell) => ({ ...structuredClone(cell), task: "other", observationId: `other-${cell.observationId}` })));
    observations.records.push(...observations.records.map((record) => ({ ...structuredClone(record), task: "other", id: `other-${record.id}`, provenance: "live" })));

    const report = computeTreatmentReport(declaration, observations);

    expect(report.qualification.status).toBe("confounded");
    expect(report.axes.conformity.effect).toBeNull();
  });

  it("does not treat an invocation after scope-dependent judgment as selection success", () => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].results[0].details.timing = "after-dependent-judgment";

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[0]).toMatchObject({ observedStatus: "pass", status: "fail" });
    expect(report.cells[1].opportunities[1].status).toBe("pass");
  });

  it("counts scope expansion independently of an earlier responsibility selection", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells.forEach((cell) => cell.opportunities.push(declaredOpportunity("expanded", "selection", { responsibility: "props", stage: "scope-expansion" })));
    observations.records.forEach((record) => record.results.push({ ...structuredClone(record.results[0]), id: "expanded", details: { invoked: true, timing: record.treatment === "old" ? "after-dependent-judgment" : "before-dependent-judgment" } }));

    const report = computeTreatmentReport(declaration, observations);

    expect(report.axes.selection.populations.old).toMatchObject({ applicable: 2, states: { pass: 1, fail: 1 }, rate: 0.5 });
    expect(report.axes.selection.effect).toBe(0.5);
  });

  it("retains unnecessary invocation controls outside applicable selection rates", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells.forEach((cell) => { cell.opportunities[0].applicable = false; });

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[0].status).toBe("fail");
    expect(report.axes.selection.populations.new).toMatchObject({ applicable: 0, inapplicable: 1, rate: null });
  });

  it.each(["failure", "partial", "unknown", "approval-wait", "unsupported", "not-reached"])("preserves %s and never reports an incomplete primary effect", (status) => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].status = status;
    observations.records[1].results[2].status = status;

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].status).toBe(status);
    expect(report.cells[1].opportunities[2].status).toBe(status);
    expect(report.cells[1].opportunities[0].status).toBe("pass");
    expect(report.axes.conformity.effect).toBeNull();
  });

  it("can qualify synthetic guard discrimination without qualifying live prevention", () => {
    const { declaration, observations } = treatmentFixture();

    expect(computeTreatmentReport(declaration, observations).guards[0]).toMatchObject({ instrumentQualified: true, liveQualified: false });
  });

  it("does not qualify guard discrimination under a scorer change declared only for the candidate", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells[1].opportunities[3].scorer.rubric = digest("changed guard rubric");
    observations.records[1].results[3].scorer.rubric = digest("changed guard rubric");

    expect(computeTreatmentReport(declaration, observations).guards[0].instrumentQualified).toBe(false);
  });

  it("does not qualify constant denial even when every recorded verdict claims pass", () => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].results[4].details = { decision: "refuse", writeReached: true, writePrevented: true, writeOccurred: false };

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[4].status).toBe("fail");
    expect(report.guards[0].instrumentQualified).toBe(false);
  });

  it("does not qualify an ignored refusal or refusal without observed prevention", () => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].results[3].details = { decision: "refuse", writeReached: true, writePrevented: false, writeOccurred: true };

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[3].status).toBe("fail");
    expect(report.guards[0].instrumentQualified).toBe(false);
  });

  it("retains edit-not-reached rather than converting refusal to prevention", () => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].results[3].details = { decision: "refuse", writeReached: false, writePrevented: null, writeOccurred: false };

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[3].status).toBe("not-reached");
    expect(report.guards[0].instrumentQualified).toBe(false);
  });

  it("requires a valid-edit contrast instead of qualifying refusal alone", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells.forEach((cell) => cell.opportunities.pop());
    observations.records.forEach((record) => record.results.pop());

    expect(computeTreatmentReport(declaration, observations).guards[0]).toMatchObject({ instrumentQualified: false, reason: expect.stringContaining("valid-edit") });
  });

  it.each([
    ["duplicate declaration", (fixture) => { fixture.declaration.cells.push(structuredClone(fixture.declaration.cells[0])); }, /duplicate/],
    ["duplicate observation", (fixture) => { fixture.observations.records.push(structuredClone(fixture.observations.records[0])); }, /duplicate/],
    ["unexpected observation", (fixture) => { fixture.observations.records[1].repetition = 9; }, /unexpected observed/],
    ["contradictory observation identity", (fixture) => { fixture.observations.records[1].condition = "skill-absent"; }, /contradictory/],
    ["contradictory lifecycle", (fixture) => { fixture.observations.records[1].lifecycle = "planned"; }, /planned/],
    ["contradictory guard", (fixture) => { fixture.observations.records[1].results[3].details.writeOccurred = true; }, /contradictory/],
    ["duplicate result", (fixture) => { fixture.observations.records[1].results.push(structuredClone(fixture.observations.records[1].results[0])); }, /duplicate/],
    ["unexpected result", (fixture) => { fixture.observations.records[1].results[0].id = "unplanned"; }, /unexpected opportunity/],
    ["signed locator", (fixture) => { fixture.observations.records[1].locator = "https://example.test/evidence?token=private"; }, /queries/],
  ])("rejects %s rather than silently choosing one record", (_, change, message) => {
    const fixture = treatmentFixture();
    change(fixture);

    expect(() => computeTreatmentReport(fixture.declaration, fixture.observations)).toThrow(message);
  });
});
