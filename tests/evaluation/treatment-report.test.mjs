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

  describe.each(["script", "reasoning"])("when a %s scorer uses two asymmetric evidence slots", (method) => {
    /** supplies distinct output and context evidence across two repetitions. */
    function twoSlotFixture() {
      const fixture = treatmentFixture(2);
      const { declaration, observations } = method === "reasoning" ? withReasoningOutput(fixture) : fixture;
      const promptTemplate = "Fixed rubric. Output: {{output}}\nContext: {{context}}";
      declaration.cells.forEach((cell) => {
        const output = cell.opportunities[2];
        output.scorer.evidenceSlots = ["output", "context"];
        output.evidence.context = { source: "context-producer" };
        if (method === "reasoning") Object.assign(output.scorer, { promptTemplate, template: digest(promptTemplate) });
      });
      observations.records.forEach((record, index) => {
        const output = record.results[2];
        const payload = `separate context ${record.id}`;
        output.scorer = structuredClone(declaration.cells[index].opportunities[2].scorer);
        output.evidence.context = { source: "context-producer", content: digest(payload), locator: `stored/${record.id}.json#context`, payload };
        if (method === "reasoning") output.fullPrompt = promptTemplate.replace("{{output}}", output.evidence.output.payload).replace("{{context}}", payload);
      });
      return { declaration, observations };
    }

    it.each([false, true])("qualifies a later observation's slot permutation with declaration permutation %s without mutating inputs", (permuteDeclaration) => {
      const { declaration, observations } = twoSlotFixture();
      observations.records[3].results[2].scorer.evidenceSlots = ["context", "output"];
      if (permuteDeclaration) declaration.cells[3].opportunities[2].scorer.evidenceSlots = ["context", "output"];
      const before = JSON.stringify({ declaration, observations });

      const report = computeTreatmentReport(declaration, observations);

      expect(report.opportunities.find((entry) => entry.id === "output")).toMatchObject({ qualification: { status: "qualified", deficits: [] }, effect: 1 });
      expect(report.axes.conformity.effect).toBe(1);
      expect(JSON.stringify({ declaration, observations })).toBe(before);
    });

    it.each([false, true])("confounds changed slot membership in a later observation with declaration change %s", (changeDeclaration) => {
      const { declaration, observations } = twoSlotFixture();
      const output = observations.records[3].results[2];
      output.scorer.evidenceSlots = ["output", "replacement"];
      output.evidence.replacement = output.evidence.context;
      delete output.evidence.context;
      if (changeDeclaration) {
        const declared = declaration.cells[3].opportunities[2];
        declared.scorer.evidenceSlots = ["output", "replacement"];
        declared.evidence.replacement = declared.evidence.context;
        delete declared.evidence.context;
      }

      const report = computeTreatmentReport(declaration, observations);
      const qualification = report.opportunities.find((entry) => entry.id === "output").qualification;

      expect(qualification.status).toBe("confounded");
      expect(qualification.deficits).toContainEqual(expect.objectContaining({ kind: "confounded", at: expect.stringContaining(changeDeclaration ? ".declaredScorer.evidenceSlots" : ".scorer.evidenceSlots") }));
      expect(report.axes.conformity.effect).toBeNull();
    });

    it.each([undefined, null])("keeps missing slot identity %s unknown in a later observation", (slots) => {
      const { declaration, observations } = twoSlotFixture();
      observations.records[3].results[2].scorer.evidenceSlots = slots;
      const before = JSON.stringify({ declaration, observations });

      const report = computeTreatmentReport(declaration, observations);
      const qualification = report.opportunities.find((entry) => entry.id === "output").qualification;

      expect(qualification.status).toBe("unknown");
      expect(qualification.deficits).toContainEqual(expect.objectContaining({ kind: "unknown", at: expect.stringContaining(".scorer.evidenceSlots") }));
      expect(report.axes.conformity.effect).toBeNull();
      expect(JSON.stringify({ declaration, observations })).toBe(before);
    });
  });

  it.each(["rubric", "template", "script", "model", "route"].flatMap((field) => [true, false].map((applicable) => ({ field, applicable }))))("blocks a changed scorer $field on applicability $applicable, not the independent selection axis", ({ field, applicable }) => {
    const { declaration, observations } = withReasoningOutput(treatmentFixture(2));
    declaration.cells.filter((cell) => cell.repetition === 2).forEach((cell) => { cell.opportunities[2].applicable = applicable; });
    observations.records[3].results[2].scorer[field] = "changed scorer";

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
    { missing: "scorer", remove: (entry) => { delete entry.scorer; } },
    { missing: "rubric", remove: (entry) => { delete entry.scorer.rubric; } },
  ].flatMap((scenario) => [
    { ...scenario, order: "missing first", indices: [0, 1, 2, 3] },
    { ...scenario, order: "changed first", indices: [3, 2, 1, 0] },
  ]))("retains a known declared scorer conflict with a missing $missing and $order", ({ remove, indices }) => {
    const { declaration, observations } = treatmentFixture(2);
    remove(declaration.cells[0].opportunities[2]);
    remove(observations.records[0].results[2]);
    declaration.cells[3].opportunities[2].scorer.rubric = digest("different rubric");
    observations.records[3].results[2].scorer.rubric = digest("different rubric");
    declaration.cells = indices.map((index) => declaration.cells[index]);
    observations.records = indices.map((index) => observations.records[index]);
    const before = JSON.stringify({ declaration, observations });

    const report = computeTreatmentReport(declaration, observations);
    const output = report.opportunities.find((entry) => entry.id === "output");

    expect(output.qualification.status).toBe("confounded");
    expect(output.qualification.deficits).toContainEqual(expect.objectContaining({ kind: "unknown", at: expect.stringContaining(".scorer.rubric") }));
    expect(output.qualification.deficits).toContainEqual(expect.objectContaining({ kind: "confounded", at: expect.stringContaining(".declaredScorer") }));
    expect(output.effect).toBeNull();
    expect(report.axes.conformity.populations.old.rate).toBeNull();
    expect(report.axes.conformity.populations.new.rate).toBeNull();
    expect(report.axes.conformity.effect).toBeNull();
    expect(report.axes.selection.effect).toBe(0);
    expect(report.axes.acquisition.effect).toBe(0);
    expect(report.counts).toEqual({ planned: 4, observedStarted: 4, observedCompleted: 4 });
    expect(JSON.stringify({ declaration, observations })).toBe(before);
  });

  it.each(["rubric", "evidenceSlots"])("keeps a missing declared %s unknown when every known scorer identity agrees", (field) => {
    const { declaration, observations } = treatmentFixture(2);
    delete declaration.cells[0].opportunities[2].scorer[field];
    delete observations.records[0].results[2].scorer[field];

    const report = computeTreatmentReport(declaration, observations);
    const output = report.opportunities.find((entry) => entry.id === "output");

    expect(output.qualification.status).toBe("unknown");
    expect(output.qualification.deficits).toContainEqual(expect.objectContaining({ kind: "unknown", at: expect.stringContaining(`.declaredScorer.${field}`) }));
    expect(output.qualification.deficits.some((entry) => entry.kind === "confounded")).toBe(false);
    expect(output.effect).toBeNull();
    expect(report.axes.conformity.effect).toBeNull();
    expect(report.axes.selection.effect).toBe(0);
    expect(report.axes.acquisition.effect).toBe(0);
  });

  it.each([
    ["scorer", (opportunity) => { opportunity.scorer.rubric = digest("new rubric"); }],
    ["dimension", (opportunity) => { opportunity.dimensions.obligation = "different-output"; }],
  ])("blocks a declared %s mismatch on a missing inapplicable opportunity", (_, change) => {
    const { declaration, observations } = treatmentFixture(2);
    declaration.cells.filter((cell) => cell.repetition === 2).forEach((cell) => { cell.opportunities[2].applicable = false; });
    observations.records.filter((record) => record.repetition === 2).forEach((record) => { record.results = record.results.filter((result) => result.id !== "output"); });
    change(declaration.cells[3].opportunities[2]);

    const report = computeTreatmentReport(declaration, observations);

    expect(report.primaryComplete).toBe(true);
    expect(report.opportunities.find((entry) => entry.id === "output").qualification.status).toBe("confounded");
    expect(report.axes.conformity.effect).toBeNull();
    expect(report.axes.selection.effect).toBe(0);
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

  it.each([
    { missing: "source", remove: (entry) => { delete entry.evidence.output.source; } },
    { missing: "scorer", remove: (entry) => { delete entry.scorer; } },
    { missing: "evidence slots", remove: (entry) => { delete entry.scorer.evidenceSlots; } },
  ].flatMap((scenario) => [
    { ...scenario, order: "missing first", indices: [0, 1, 2, 3] },
    { ...scenario, order: "changed first", indices: [3, 2, 1, 0] },
  ]))("retains a known declared evidence-source conflict with a missing $missing and $order", ({ remove, indices }) => {
    const { declaration, observations } = treatmentFixture(2);
    remove(declaration.cells[0].opportunities[2]);
    remove(observations.records[0].results[2]);
    declaration.cells[3].opportunities[2].evidence.output.source = "different-evidence-producer";
    observations.records[3].results[2].evidence.output.source = "different-evidence-producer";
    declaration.cells = indices.map((index) => declaration.cells[index]);
    observations.records = indices.map((index) => observations.records[index]);
    const before = JSON.stringify({ declaration, observations });

    const report = computeTreatmentReport(declaration, observations);
    const output = report.opportunities.find((entry) => entry.id === "output");

    expect(output.qualification.status).toBe("confounded");
    expect(output.qualification.deficits).toContainEqual(expect.objectContaining({ kind: "unknown" }));
    expect(output.qualification.deficits).toContainEqual(expect.objectContaining({ kind: "confounded", at: "output.evidence.output.source" }));
    expect(output.effect).toBeNull();
    expect(report.axes.conformity.populations.old.rate).toBeNull();
    expect(report.axes.conformity.populations.new.rate).toBeNull();
    expect(report.axes.conformity.effect).toBeNull();
    expect(report.axes.selection.effect).toBe(0);
    expect(report.axes.acquisition.effect).toBe(0);
    expect(JSON.stringify({ declaration, observations })).toBe(before);
  });

  it.each(["skills", "guidance", "adapters"].flatMap((kind) => [
    { kind, order: "baseline first", indices: [0, 1, 2, 3] },
    { kind, order: "candidate first", indices: [2, 3, 0, 1] },
  ]))("allows acquisition sources to track one named allowed $kind material across repetitions with $order", ({ kind, indices }) => {
    const { declaration, observations } = treatmentFixture(2);
    const name = kind === "skills" ? "target" : kind === "guidance" ? "policy" : "adapter";
    declaration.allowedDifferences = [{ kind, name }];
    declaration.treatments[1].materials.skills.target = structuredClone(declaration.treatments[0].materials.skills.target);
    declaration.treatments[0].materials[kind][name].source = "acquired-old";
    declaration.treatments[1].materials[kind][name].source = "acquired-new";
    declaration.cells.forEach((cell, index) => {
      const treatment = declaration.treatments.find((entry) => entry.id === cell.treatment);
      const material = treatment.materials[kind][name];
      cell.opportunities[1].evidence.output.source = material.source;
      observations.records[index].materials = structuredClone(treatment.materials);
      observations.records[index].results[1].evidence.output.source = material.source;
      observations.records[index].results[1].status = cell.treatment === "old" ? "fail" : "pass";
    });
    declaration.cells = indices.map((index) => declaration.cells[index]);

    const report = computeTreatmentReport(declaration, observations);
    const acquire = report.opportunities.find((entry) => entry.id === "acquire");

    expect(acquire).toMatchObject({ qualification: { status: "qualified", deficits: [] }, effect: 1 });
    expect(report.axes.acquisition.effect).toBe(1);
    expect(report.axes.conformity.effect).toBe(1);
    expect(report.axes.selection.effect).toBe(0);
  });

  it.each(["skills", "guidance", "adapters"].flatMap((kind) => [
    { order: "baseline first", indices: [0, 1, 2, 3] },
    { order: "candidate first", indices: [2, 3, 0, 1] },
  ].flatMap((order) => [
    { kind, ...order, evidence: "complete sources", sources: ["shared-old", "shared-old", "target-new", "peer-new"], hasUnknown: false },
    { kind, ...order, evidence: "missing baseline source", sources: [null, "shared-old", "target-new", "peer-new"], hasUnknown: true },
  ])))("blocks mixed allowed $kind acquisition producers across repetitions with $order and $evidence", ({ kind, indices, sources, hasUnknown }) => {
    const { declaration, observations } = treatmentFixture(2);
    declaration.allowedDifferences = [{ kind, name: "target" }, { kind, name: "peer" }];
    declaration.treatments[1].materials.skills.target = structuredClone(declaration.treatments[0].materials.skills.target);
    declaration.treatments[0].materials[kind] = {
      target: { source: "shared-old", content: digest("old target") },
      peer: { source: "shared-old", content: digest("old peer") },
    };
    declaration.treatments[1].materials[kind] = {
      target: { source: "target-new", content: digest("new target") },
      peer: { source: "peer-new", content: digest("new peer") },
    };
    declaration.cells.forEach((cell, index) => {
      const treatment = declaration.treatments.find((entry) => entry.id === cell.treatment);
      cell.opportunities[1].evidence.output.source = sources[index];
      observations.records[index].materials = structuredClone(treatment.materials);
      observations.records[index].results[1].evidence.output.source = sources[index];
      observations.records[index].results[1].status = cell.treatment === "old" ? "fail" : "pass";
    });
    declaration.cells = indices.map((index) => declaration.cells[index]);
    const before = JSON.stringify({ declaration, observations });

    const report = computeTreatmentReport(declaration, observations);
    const acquire = report.opportunities.find((entry) => entry.id === "acquire");

    expect(acquire).toMatchObject({ qualification: { status: "confounded" }, effect: null });
    expect(acquire.qualification.deficits).toContainEqual(expect.objectContaining({ kind: "confounded", at: "acquire.evidence.output.source" }));
    expect(acquire.qualification.deficits.some((entry) => entry.kind === "unknown" && entry.at.includes(".evidence.output.source"))).toBe(hasUnknown);
    expect(report.axes.acquisition.populations.old.rate).toBeNull();
    expect(report.axes.acquisition.populations.new.rate).toBeNull();
    expect(report.axes.acquisition.effect).toBeNull();
    expect(report.axes.conformity.effect).toBe(1);
    expect(report.axes.selection.effect).toBe(0);
    expect(report.qualification.status).toBe("qualified");
    expect(JSON.stringify({ declaration, observations })).toBe(before);
  });

  it.each(["skills", "guidance", "adapters"])("keeps allowed %s acquisition sources unknown rather than confounded with a later candidate anchor", (kind) => {
    const { declaration, observations } = treatmentFixture(2);
    const name = kind === "skills" ? "target" : kind === "guidance" ? "policy" : "adapter";
    declaration.allowedDifferences = [{ kind, name }];
    declaration.treatments[1].materials.skills.target = structuredClone(declaration.treatments[0].materials.skills.target);
    declaration.treatments[0].materials[kind][name].source = "acquired-old";
    declaration.treatments[1].materials[kind][name].source = "acquired-new";
    declaration.cells.forEach((cell, index) => {
      const treatment = declaration.treatments.find((entry) => entry.id === cell.treatment);
      cell.opportunities[1].evidence.output.source = treatment.materials[kind][name].source;
      observations.records[index].materials = structuredClone(treatment.materials);
      observations.records[index].results[1].evidence.output.source = treatment.materials[kind][name].source;
    });
    delete declaration.cells[0].opportunities[1].evidence.output.source;
    delete observations.records[0].results[1].evidence.output.source;
    declaration.cells = [declaration.cells[0], declaration.cells[2], declaration.cells[1], declaration.cells[3]];
    const before = JSON.stringify({ declaration, observations });

    const report = computeTreatmentReport(declaration, observations);
    const acquire = report.opportunities.find((entry) => entry.id === "acquire");

    expect(acquire.qualification.status).toBe("unknown");
    expect(acquire.qualification.deficits).toContainEqual(expect.objectContaining({ kind: "unknown", at: expect.stringContaining(".evidence.output.source") }));
    expect(acquire.qualification.deficits.some((entry) => entry.kind === "confounded")).toBe(false);
    expect(acquire.effect).toBeNull();
    expect(report.axes.acquisition.effect).toBeNull();
    expect(report.axes.conformity.effect).toBe(1);
    expect(report.axes.selection.effect).toBe(0);
    expect(JSON.stringify({ declaration, observations })).toBe(before);
  });

  it.each([1, 2])("blocks an unrelated acquisition source declared and observed in candidate repetition %s", (repetition) => {
    const { declaration, observations } = treatmentFixture(2);
    const cell = declaration.cells.find((entry) => entry.treatment === "new" && entry.repetition === repetition);
    const record = observations.records.find((entry) => entry.id === cell.observationId);
    cell.opportunities[1].evidence.output.source = "unrelated-origin";
    record.results[1].evidence.output.source = "unrelated-origin";

    const report = computeTreatmentReport(declaration, observations);

    expect(report.opportunities.find((entry) => entry.id === "acquire").qualification.status).toBe("confounded");
    expect(report.axes.acquisition.effect).toBeNull();
    expect(report.axes.acquisition.populations.new.rate).toBeNull();
    expect(report.axes.conformity.effect).toBe(1);
  });

  it("does not match acquisition sources from two different allowed materials", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.allowedDifferences.push({ kind: "skills", name: "peer" });
    declaration.treatments[1].materials.skills.peer.source = "peer-new";
    observations.records[1].materials.skills.peer.source = "peer-new";
    declaration.cells[0].opportunities[1].evidence.output.source = "target-old";
    observations.records[0].results[1].evidence.output.source = "target-old";
    declaration.cells[1].opportunities[1].evidence.output.source = "peer-new";
    observations.records[1].results[1].evidence.output.source = "peer-new";

    const report = computeTreatmentReport(declaration, observations);

    expect(report.opportunities.find((entry) => entry.id === "acquire").qualification.status).toBe("confounded");
    expect(report.axes.acquisition.effect).toBeNull();
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

  it("qualifies the applicable population when only inapplicable results are omitted", () => {
    const { declaration, observations } = treatmentFixture(2);
    declaration.cells.filter((cell) => cell.repetition === 2).forEach((cell) => { cell.opportunities[2].applicable = false; });
    observations.records.filter((record) => record.repetition === 2).forEach((record) => { record.results = record.results.filter((result) => result.id !== "output"); });
    const before = JSON.stringify({ declaration, observations });

    const report = computeTreatmentReport(declaration, observations);
    const output = report.opportunities.find((entry) => entry.id === "output");

    expect(report.qualification.status).toBe("qualified");
    expect(report.primaryComplete).toBe(true);
    expect(report.counts).toEqual({ planned: 4, observedStarted: 4, observedCompleted: 4 });
    expect(report.axes.conformity.populations.old).toMatchObject({ planned: 2, applicable: 1, inapplicable: 1, observed: 1, resolved: 1, states: { pass: 0, fail: 1, missing: 0 }, rate: 0 });
    expect(report.axes.conformity.populations.new).toMatchObject({ planned: 2, applicable: 1, inapplicable: 1, observed: 1, resolved: 1, states: { pass: 1, fail: 0, missing: 0 }, rate: 1 });
    expect(report.axes.conformity.effect).toBe(1);
    expect(output.qualification).toEqual({ status: "qualified", deficits: [] });
    expect(output.populations).toEqual(report.axes.conformity.populations);
    expect(output.effect).toBe(1);
    const missingOutput = expect.objectContaining({
      applicable: false, observedStatus: null, status: "missing",
      qualification: {
        status: "unknown",
        deficits: expect.arrayContaining([expect.objectContaining({ kind: "unknown", at: expect.stringContaining(".output.scorer.method"), reason: "missing identity" })]),
      },
    });
    expect(report.cells.filter((cell) => cell.repetition === 2).map((cell) => cell.opportunities[2])).toEqual([missingOutput, missingOutput]);
    expect(JSON.stringify({ declaration, observations })).toBe(before);
  });

  it("counts every supported state and missing while conserving only applicable opportunities", () => {
    const { declaration, observations } = treatmentFixture(10);
    const candidateRecords = observations.records.filter((record) => record.treatment === "new");
    ["pass", "fail", "failure", "partial", "unknown", "approval-wait", "unsupported", "not-reached"].forEach((status, index) => {
      candidateRecords[index].results[2].status = status;
    });
    candidateRecords[8].results.splice(2, 1);
    declaration.cells.filter((cell) => cell.repetition === 10).forEach((cell) => { cell.opportunities[2].applicable = false; });

    const report = computeTreatmentReport(declaration, observations);
    const population = report.axes.conformity.populations.new;
    const output = report.opportunities.find((entry) => entry.id === "output");

    expect(population).toEqual({
      planned: 10, applicable: 9, inapplicable: 1, observed: 8, resolved: 2,
      states: { pass: 1, fail: 1, failure: 1, partial: 1, unknown: 1, "approval-wait": 1, unsupported: 1, "not-reached": 1, missing: 1 },
      rate: null, denominator: "all declared applicable opportunities",
    });
    expect(Object.values(population.states).reduce((sum, count) => sum + count, 0)).toBe(population.applicable);
    expect(output.populations.new).toEqual(population);
    expect(report.primaryComplete).toBe(false);
    expect(report.axes.conformity.populations.old.rate).toBeNull();
    expect(report.axes.conformity.effect).toBeNull();
    expect(output.effect).toBeNull();
  });

  it.each([true, false])("reports no rate for a zero applicable population with retained results %s", (hasInapplicableResults) => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells.forEach((cell) => { cell.opportunities[2].applicable = false; });
    observations.records.forEach((record) => { record.results = record.results.filter((result) => hasInapplicableResults || result.id !== "output"); });

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
    ["stale", { coverage: "full", delivery: "stale" }, "fail"],
    ["truncated", { coverage: "full", delivery: "truncated" }, "partial"],
    ["mixed", { coverage: "full", delivery: "mixed" }, "fail"],
    ["mismatch", { coverage: "mismatch" }, "fail"],
    ["partial", { coverage: "partial" }, "partial"],
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

  it.each([
    { delivery: "omitted", details: {}, status: "pass", rate: 1 },
    { delivery: "current", details: { delivery: "current" }, status: "pass", rate: 1 },
    { delivery: "unknown", details: { delivery: "unknown" }, status: "unknown", rate: null },
    { delivery: "unknown with mismatch", details: { delivery: "unknown", coverage: "mismatch" }, status: "fail", rate: 0 },
    { delivery: "unknown with partial coverage", details: { delivery: "unknown", coverage: "partial" }, status: "partial", rate: null },
    { delivery: "stale with partial coverage", details: { delivery: "stale", coverage: "partial" }, status: "fail", rate: 0 },
    { delivery: "mixed with partial coverage", details: { delivery: "mixed", coverage: "partial" }, status: "fail", rate: 0 },
    { delivery: "truncated", details: { delivery: "truncated" }, status: "partial", rate: null },
    { delivery: "truncated with mismatch", details: { delivery: "truncated", coverage: "mismatch" }, status: "fail", rate: 0 },
  ])("assesses $delivery delivery as $status without changing independently checked conformity", ({ details, status, rate }) => {
    const { declaration, observations } = treatmentFixture();
    observations.records[0].results[1].status = "fail";
    Object.assign(observations.records[1].results[1].details, details);
    const before = JSON.stringify({ declaration, observations });

    const report = computeTreatmentReport(declaration, observations);
    const acquire = report.opportunities.find((entry) => entry.id === "acquire");

    expect(report.cells[1].opportunities[1]).toMatchObject({ observedStatus: "pass", status, details });
    expect(report.axes.acquisition.populations.new).toMatchObject({ planned: 1, applicable: 1, observed: 1, states: { [status]: 1 }, rate });
    expect(report.axes.acquisition.effect).toBe(rate);
    expect(acquire.populations).toEqual(report.axes.acquisition.populations);
    expect(acquire.effect).toBe(rate);
    expect(report.cells[1].opportunities[2].status).toBe("pass");
    expect(report.axes.conformity.effect).toBe(1);
    expect(report.axes.selection.effect).toBe(0);
    expect(JSON.stringify({ declaration, observations })).toBe(before);
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

  it.each([
    { applicable: false, details: { invoked: false }, status: "pass" },
    { applicable: false, details: { invoked: false, timing: "unknown" }, status: "pass" },
    { applicable: true, details: { invoked: false }, status: "fail" },
    { applicable: true, details: { invoked: false, timing: "unknown" }, status: "fail" },
    { applicable: true, details: { invoked: true, timing: "unknown" }, status: "unknown" },
    { applicable: false, details: { timing: "unknown" }, status: "unknown" },
  ])("assesses selection as $status for applicability $applicable with details $details", ({ applicable, details, status }) => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells[1].opportunities[0].applicable = applicable;
    observations.records[1].results[0].details = details;

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[0]).toMatchObject({ observedStatus: "pass", status });
    expect(report.axes.conformity.effect).toBe(1);
  });

  it("retains selection approval waiting rather than reclassifying a non-invocation", () => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].results[0].status = "approval-wait";
    observations.records[1].results[0].details = { invoked: false };

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[0].status).toBe("approval-wait");
    expect(report.axes.selection.effect).toBeNull();
    expect(report.axes.conformity.effect).toBe(1);
  });

  it.each(["before-dependent-judgment", "after-dependent-judgment"].flatMap((timing) => [true, false].flatMap((applicable) => ["pass", "fail", "failure", "partial", "unknown", "approval-wait", "unsupported", "not-reached"].map((status) => ({ timing, applicable, status })))))("rejects non-invocation with $timing on applicability $applicable and status $status", ({ timing, applicable, status }) => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells[1].opportunities[0].applicable = applicable;
    observations.records[1].results[0].status = status;
    observations.records[1].results[0].details = { invoked: false, timing };
    const before = JSON.stringify({ declaration, observations });

    expect(() => computeTreatmentReport(declaration, observations)).toThrow(/contradictory selection/);
    expect(JSON.stringify({ declaration, observations })).toBe(before);
  });

  it.each([undefined, null, "unknown"].flatMap((timing) => [true, false].flatMap((applicable) => ["pass", "approval-wait"].map((status) => ({ timing, applicable, status })))))("accepts non-invocation with unknown/absent timing $timing on applicability $applicable and status $status", ({ timing, applicable, status }) => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells[1].opportunities[0].applicable = applicable;
    observations.records[1].results[0].status = status;
    observations.records[1].results[0].details = { invoked: false, timing };

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[0].observedStatus).toBe(status);
    expect(report.cells[1].opportunities[0].status).toBe(status === "approval-wait" ? status : applicable ? "fail" : "pass");
  });

  it.each(["before-dependent-judgment", "after-dependent-judgment"])("accepts an invocation with known timing %s", (timing) => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].results[0].details = { invoked: true, timing };

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[0]).toMatchObject({ observedStatus: "pass", status: timing === "before-dependent-judgment" ? "pass" : "fail" });
  });

  it.each(["failure", "partial", "unknown", "approval-wait", "unsupported", "not-reached"])("preserves %s and never reports an incomplete primary effect", (status) => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].status = status;
    observations.records[1].results[2].status = status;

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].status).toBe(status);
    expect(report.cells[1].opportunities[2].status).toBe(status);
    expect(report.cells[1].opportunities[0].status).toBe("pass");
    expect(report.primaryComplete).toBe(false);
    expect(report.axes.conformity.populations.new.states[status]).toBe(1);
    expect(report.axes.conformity.populations.new.rate).toBeNull();
    expect(report.axes.conformity.effect).toBeNull();
  });

  it("can qualify synthetic guard discrimination without qualifying live prevention", () => {
    const { declaration, observations } = treatmentFixture();

    expect(computeTreatmentReport(declaration, observations).guards[0]).toMatchObject({ instrumentQualified: true, reason: null, liveQualified: false, liveReason: expect.stringContaining("live prevention") });
  });

  it("does not qualify guard discrimination under a scorer change declared only for the candidate", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells[1].opportunities[3].scorer.rubric = digest("changed guard rubric");
    observations.records[1].results[3].scorer.rubric = digest("changed guard rubric");

    expect(computeTreatmentReport(declaration, observations).guards[0]).toMatchObject({ instrumentQualified: false, reason: expect.stringMatching(/unqualified guard/) });
  });

  it("does not qualify constant denial even when every recorded verdict claims pass", () => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].results[4].details = { decision: "refuse", writeReached: true, writePrevented: true, writeOccurred: false };

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[4].status).toBe("fail");
    expect(report.guards[0]).toMatchObject({ instrumentQualified: false, reason: expect.stringMatching(/guard result.*valid.*fail/), liveQualified: false });
  });

  it("does not qualify an ignored refusal or refusal without observed prevention", () => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].results[3].details = { decision: "refuse", writeReached: true, writePrevented: false, writeOccurred: true };

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[3].status).toBe("fail");
    expect(report.guards[0]).toMatchObject({ instrumentQualified: false, reason: expect.stringMatching(/guard result.*invalid.*fail/), liveQualified: false });
  });

  it("retains edit-not-reached rather than converting refusal to prevention", () => {
    const { declaration, observations } = treatmentFixture();
    observations.records[1].results[3].details = { decision: "refuse", writeReached: false, writePrevented: null, writeOccurred: false };

    const report = computeTreatmentReport(declaration, observations);

    expect(report.cells[1].opportunities[3].status).toBe("not-reached");
    expect(report.guards[0]).toMatchObject({ instrumentQualified: false, reason: expect.stringContaining("not-reached"), liveQualified: false });
  });

  it.each([
    ["missing result", (fixture) => { fixture.observations.records[3].results.splice(3, 1); }, /guard result.*missing/],
    ["incomplete cells", (fixture) => { fixture.observations.records[3].lifecycle = "started"; fixture.observations.records[3].status = "partial"; }, /incomplete cells/],
    ["comparison unknown", (fixture) => { delete fixture.observations.records[3].fixed.profile; }, /comparison.*unknown/],
    ["comparison confounded", (fixture) => { fixture.observations.records[3].fixed.profile = digest("changed profile"); }, /comparison.*confounded/],
    ["missing scorer identity", (fixture) => { delete fixture.observations.records[3].results[3].scorer.model; }, /unqualified guard/],
    ["missing evidence identity", (fixture) => { delete fixture.observations.records[3].results[3].evidence.output.content; }, /unqualified guard/],
  ])("explains failed guard qualification for %s in a later repetition", (_, change, reason) => {
    const fixture = treatmentFixture(2);
    change(fixture);
    const before = JSON.stringify(fixture);

    const report = computeTreatmentReport(fixture.declaration, fixture.observations);

    expect(report.guards[0]).toMatchObject({ instrumentQualified: false, reason: expect.stringMatching(reason), liveQualified: false, liveReason: expect.stringContaining("live prevention") });
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it("requires a valid-edit contrast instead of qualifying refusal alone", () => {
    const { declaration, observations } = treatmentFixture();
    declaration.cells.forEach((cell) => cell.opportunities.pop());
    observations.records.forEach((record) => record.results.pop());

    expect(computeTreatmentReport(declaration, observations).guards[0]).toMatchObject({ instrumentQualified: false, reason: expect.stringContaining("valid-edit") });
  });

  describe.each([
    { surface: "observation", inputLocator: (observations) => observations.records[0], reportLocator: (report) => report.cells[0].observation },
    { surface: "evidence", inputLocator: (observations) => observations.records[0].results[2].evidence.output, reportLocator: (report) => report.cells[0].opportunities[2].evidence.output },
  ])("when a $surface locator is supplied", ({ inputLocator, reportLocator }) => {
    it.each([
      "https://example.test/evidence.json?synthetic-query-marker",
      "stored/evidence.json?synthetic-query-marker",
      "/stored/evidence.json?synthetic-query-marker",
      "?synthetic-query-marker",
      "//example.test/evidence.json?synthetic-query-marker",
      "//synthetic-userinfo-marker@example.test/evidence.json",
      "https://:synthetic-password-marker@example.test/evidence.json",
      "stored/evidence.json?#fragment",
      "https://[invalid]/evidence.json?synthetic-query-marker",
    ])("rejects unsafe locator %s with a contract error and no input mutation", (locator) => {
      const { declaration, observations } = treatmentFixture();
      inputLocator(observations).locator = locator;
      const before = JSON.stringify({ declaration, observations });

      expect(() => computeTreatmentReport(declaration, observations)).toThrow(/locator.*(?:credentials or queries|parseable)/);

      expect(JSON.stringify({ declaration, observations })).toBe(before);
    });

    it.each([
      "stored/evidence.json",
      "/stored/evidence.json",
      "//EXAMPLE.test/evidence.json",
      "HTTPS://EXAMPLE.test:443/evidence.json",
      "stored/evidence.json#section?fragment-text",
      "https://example.test/evidence.json#?fragment-text",
      "stored/evidence%3F%23%40.json",
      "plain correlation text \uFFFD",
    ])("preserves valid locator %s verbatim without changing inputs", (locator) => {
      const { declaration, observations } = treatmentFixture();
      inputLocator(observations).locator = locator;
      const before = JSON.stringify({ declaration, observations });

      const report = computeTreatmentReport(declaration, observations);

      expect(reportLocator(report).locator).toBe(locator);
      expect(report.qualification.status).toBe("qualified");
      expect(report.axes.conformity.effect).toBe(1);
      expect(JSON.stringify({ declaration, observations })).toBe(before);
    });

    it.each([undefined, null])("retains missing locator %s as unknown rather than rejecting it", (locator) => {
      const { declaration, observations } = treatmentFixture();
      inputLocator(observations).locator = locator;

      const report = computeTreatmentReport(declaration, observations);

      expect(reportLocator(report).locator).toBeNull();
      expect(report.axes.conformity.effect).toBeNull();
    });
  });

  it.each([
    ["duplicate declaration", (fixture) => { fixture.declaration.cells.push(structuredClone(fixture.declaration.cells[0])); }, /duplicate/],
    ["duplicate observation", (fixture) => { fixture.observations.records.push(structuredClone(fixture.observations.records[0])); }, /duplicate/],
    ["unexpected observation", (fixture) => { fixture.observations.records[1].repetition = 9; }, /unexpected observed/],
    ["contradictory observation identity", (fixture) => { fixture.observations.records[1].condition = "skill-absent"; }, /contradictory/],
    ["submitted missing observation status", (fixture) => { fixture.observations.records[1].status = "missing"; }, /invalid observed lifecycle\/status/],
    ["submitted missing opportunity status", (fixture) => { fixture.observations.records[1].results[2].status = "missing"; }, /invalid opportunity status/],
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
