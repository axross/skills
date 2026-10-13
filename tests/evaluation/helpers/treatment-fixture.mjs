import { createHash } from "node:crypto";

export const digest = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

/** creates scorer-only synthetic evidence, not an executable/live scenario. */
export function declaredOpportunity(id, axis, dimensions) {
  return {
    id, axis, applicable: true, dimensions,
    scorer: { method: "script", rubric: digest("rubric"), template: "none", script: digest("script"), model: "none", route: "offline-script", evidenceSlots: ["output"] },
    evidence: { output: { source: "stored-evidence" } },
  };
}

/** creates a complete explicit matrix and its separately stored synthetic observations. */
export function treatmentFixture(repetitions = 1) {
  const opportunities = [
    declaredOpportunity("select", "selection", { responsibility: "style", stage: "before-edit" }),
    declaredOpportunity("acquire", "acquisition", { actor: "worker", phase: "initial", material: "authoring" }),
    declaredOpportunity("output", "conformity", { obligation: "requested-output" }),
    declaredOpportunity("invalid", "guards", { call: "edit-invalid", stage: "pre-edit", scope: "synthetic-write", control: "invalid-edit" }),
    declaredOpportunity("valid", "guards", { call: "edit-valid", stage: "pre-edit", scope: "synthetic-write", control: "valid-edit" }),
  ];
  const declaration = {
    version: 1, id: "offline-comparison", scope: "synthetic instrument controls only",
    baseline: "old", candidate: "new",
    tasks: [{ id: "task", fixed: { fixture: digest("fixture"), outcome: digest("outcome"), taskMaterial: digest("task"), model: "vendor/probe-model", profile: digest("profile"), harness: digest("harness") } }],
    treatments: ["old", "new"].map((id) => ({ id, materials: {
      skills: { target: { source: `target-${id}`, content: digest(id) }, peer: { source: "peer", content: digest("peer") } },
      guidance: { policy: { source: "policy", content: digest("policy") } },
      adapters: { adapter: { source: "adapter", content: digest("adapter") } },
    } })),
    allowedDifferences: [{ kind: "skills", name: "target" }],
    cells: [],
  };
  for (const treatment of ["old", "new"]) {
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      declaration.cells.push({ task: "task", treatment, repetition, condition: "skill-present", observationId: `${treatment}-${repetition}`, opportunities: structuredClone(opportunities) });
    }
  }
  for (const cell of declaration.cells) {
    cell.opportunities[1].evidence.output.content = digest(`${cell.observationId}-acquire`);
  }
  const observations = { version: 1, comparison: declaration.id, records: declaration.cells.map((cell) => ({
    id: cell.observationId, locator: `stored/${cell.observationId}.json`,
    task: cell.task, treatment: cell.treatment, repetition: cell.repetition, condition: cell.condition,
    provenance: "synthetic", scope: "unqualified worker/resume/guard simulation",
    lifecycle: "completed", status: "pass",
    fixed: structuredClone(declaration.tasks[0].fixed),
    materials: structuredClone(declaration.treatments.find((entry) => entry.id === cell.treatment).materials),
    results: cell.opportunities.map((entry) => ({
      id: entry.id, status: entry.id === "output" && cell.treatment === "old" ? "fail" : "pass",
      scorer: structuredClone(entry.scorer),
      evidence: { output: { source: "stored-evidence", content: digest(`${cell.observationId}-${entry.id}`), locator: `stored/${cell.observationId}.json#${entry.id}` } },
      details: {
        select: { invoked: true, timing: "before-dependent-judgment" },
        acquire: { availability: "available", route: "native", coverage: "full" },
        output: {},
        invalid: { decision: "refuse", writeReached: true, writePrevented: true, writeOccurred: false },
        valid: { decision: "allow", writeReached: true, writePrevented: false, writeOccurred: true },
      }[entry.id],
    })),
  })) };
  return { declaration, observations };
}

/** retains full actual judge prompts while varying only the declared evidence slot. */
export function withReasoningOutput({ declaration, observations }) {
  const promptTemplate = "Fixed rubric. Assess this output:\n{{output}}";
  const scorer = { method: "reasoning", rubric: digest("rubric"), template: digest(promptTemplate), script: "none", model: "vendor/judge-model", route: "stored-judge-route", promptTemplate, evidenceSlots: ["output"] };
  for (const cell of declaration.cells) cell.opportunities.find((entry) => entry.id === "output").scorer = structuredClone(scorer);
  for (const record of observations.records) {
    const result = record.results.find((entry) => entry.id === "output");
    const payload = `private synthetic output ${record.id}`;
    result.scorer = structuredClone(scorer);
    result.evidence.output.payload = payload;
    result.evidence.output.content = digest(payload);
    result.fullPrompt = promptTemplate.replace("{{output}}", payload);
  }
  return { declaration, observations };
}
