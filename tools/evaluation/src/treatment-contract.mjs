export const AXES = ["selection", "acquisition", "conformity", "guards"];
export const MATERIAL_KINDS = ["skills", "guidance", "adapters"];
export const FIXED_FIELDS = ["fixture", "outcome", "taskMaterial", "model", "profile", "harness"];
const STATES = ["pass", "fail", "failure", "partial", "unknown", "approval-wait", "unsupported", "not-reached"];
const SCORER_FIELDS = ["method", "rubric", "template", "script", "model", "route", "promptTemplate", "evidenceSlots"];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.length > 0;
const cellKey = (cell) => JSON.stringify([cell.task, cell.treatment, cell.repetition]);

/** @throws {Error} when a consumed contract field is malformed */
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

/** @throws {Error} when an object has an unexpected field */
function fields(value, allowed, label) {
  requireValue(object(value), `${label} must be an object`);
  requireValue(Object.keys(value).every((key) => allowed.includes(key)), `${label} has unexpected fields`);
}

/** @throws {Error} when identifiers collide or a list is malformed */
function uniqueBy(values, key, label) {
  requireValue(Array.isArray(values), `${label} must be an array`);
  const indexed = new Map();
  for (const value of values) {
    const id = key(value);
    requireValue(text(id) && !indexed.has(id), `duplicate or invalid ${label}: ${id}`);
    indexed.set(id, value);
  }
  return indexed;
}

/** @throws {Error} when a source/content identity has malformed fields */
function identity(value, label, withEvidence = false) {
  fields(value, withEvidence ? ["source", "content", "locator", "payload"] : ["source", "content"], label);
  for (const key of ["source", "content"]) {
    requireValue(value[key] == null || text(value[key]), `${label}.${key} must be an identity or null`);
  }
  if (withEvidence) {
    requireValue(value.locator == null || text(value.locator), `${label}.locator must be text or null`);
    requireValue(value.payload == null || typeof value.payload === "string", `${label}.payload must be text`);
    if (text(value.locator) && URL.canParse(value.locator)) {
      const url = new URL(value.locator);
      requireValue(!url.search && !url.username && !url.password, `${label}.locator must not carry URL credentials or queries`);
    }
  }
}

/** @throws {Error} on malformed fixed conditions or treatment identities */
function identities(value, label, isFixed = false) {
  fields(value, isFixed ? FIXED_FIELDS : MATERIAL_KINDS, label);
  for (const [key, entry] of Object.entries(value)) {
    if (isFixed) requireValue(entry == null || text(entry), `${label}.${key} must be text or null`);
    else {
      requireValue(object(entry), `${label}.${key} must be a material map`);
      for (const [name, material] of Object.entries(entry)) identity(material, `${label}.${key}.${name}`);
    }
  }
}

/** @throws {Error} on malformed scoring separation; absent fields remain unknown */
function scorer(value, label) {
  fields(value, SCORER_FIELDS, label);
  for (const key of SCORER_FIELDS.filter((field) => field !== "evidenceSlots")) {
    requireValue(value[key] == null || text(value[key]), `${label}.${key} must be text or null`);
  }
  requireValue(value.method == null || ["script", "reasoning"].includes(value.method), `${label}.method is invalid`);
  if (value.evidenceSlots != null) uniqueBy(value.evidenceSlots, (slot) => slot, `${label} evidence slot`);
}

/** @throws {Error} when axis-specific opportunities are malformed */
function opportunity(value) {
  fields(value, ["id", "axis", "applicable", "dimensions", "scorer", "evidence"], "opportunity");
  requireValue(text(value.id) && AXES.includes(value.axis) && typeof value.applicable === "boolean", "invalid opportunity");
  const dimensionFields = {
    selection: ["responsibility", "stage"],
    acquisition: ["actor", "phase", "material"],
    conformity: ["obligation"],
    guards: ["call", "stage", "scope", "control"],
  }[value.axis];
  fields(value.dimensions, dimensionFields, `${value.axis} dimensions`);
  requireValue(dimensionFields.every((key) => text(value.dimensions[key])), "incomplete opportunity dimensions");
  if (value.axis === "guards") {
    requireValue(["valid-edit", "invalid-edit"].includes(value.dimensions.control), "invalid guard control");
  }
  if (value.scorer != null) scorer(value.scorer, "declared scorer");
  requireValue(value.evidence == null || object(value.evidence), "declared evidence must be a slot map");
  for (const [slot, expected] of Object.entries(value.evidence ?? {})) identity(expected, `declared evidence.${slot}`);
  if (value.scorer?.evidenceSlots && value.evidence) {
    requireValue(Object.keys(value.evidence).sort().join("\0") === [...value.scorer.evidenceSlots].sort().join("\0"), "evidence slots contradict scorer");
  }
}

/** @throws {Error} when an observed verdict or its axis details are malformed */
function result(value, declared) {
  fields(value, ["id", "status", "scorer", "evidence", "fullPrompt", "details"], "opportunity result");
  requireValue(STATES.includes(value.status), "invalid opportunity status");
  if (value.scorer != null) scorer(value.scorer, "observed scorer");
  if (value.evidence != null) {
    requireValue(object(value.evidence), "observed evidence must be a slot map");
    for (const [slot, entry] of Object.entries(value.evidence)) identity(entry, `observed evidence.${slot}`, true);
  }
  requireValue(value.fullPrompt == null || typeof value.fullPrompt === "string", "fullPrompt must be text");
  if (value.details == null) return;
  const detailFields = {
    selection: ["invoked", "timing"],
    acquisition: ["availability", "route", "coverage", "delivery"],
    conformity: [],
    guards: ["decision", "writeReached", "writePrevented", "writeOccurred"],
  }[declared.axis];
  fields(value.details, detailFields, `${declared.axis} details`);
  const choices = {
    timing: ["before-dependent-judgment", "after-dependent-judgment", "unknown"],
    availability: ["available", "unavailable", "unknown"],
    route: ["native", "direct", "retained", "parent-only", "unknown"],
    coverage: ["full", "partial", "mismatch", "unavailable", "unknown"],
    delivery: ["current", "stale", "truncated", "mixed", "unknown"],
    decision: ["allow", "refuse", "unknown"],
  };
  for (const [key, entry] of Object.entries(value.details)) {
    requireValue(entry == null || (choices[key] ? choices[key].includes(entry) : typeof entry === "boolean"), `invalid ${key}`);
  }
  requireValue(!(value.details.writePrevented === true && value.details.writeOccurred === true), "contradictory guard write observation");
  requireValue(!(value.details.writeReached === false && (value.details.writeOccurred === true || value.details.writePrevented === true)), "guard write not reached but outcome recorded");
}

/**
 * validates only this instrument's explicit offline comparison contract.
 * missing identity fields survive validation for unknown qualification.
 * @throws {Error} on duplicate, unexpected, malformed or contradictory input
 */
export function validateTreatmentInputs(declaration, observations) {
  fields(declaration, ["version", "id", "scope", "baseline", "candidate", "tasks", "treatments", "allowedDifferences", "cells"], "declaration");
  requireValue(declaration.version === 1 && text(declaration.id) && text(declaration.scope), "invalid declaration identity/scope");
  const tasks = uniqueBy(declaration.tasks, (task) => task?.id, "task");
  const treatments = uniqueBy(declaration.treatments, (treatment) => treatment?.id, "treatment");
  requireValue(treatments.size === 2 && declaration.baseline !== declaration.candidate && treatments.has(declaration.baseline) && treatments.has(declaration.candidate), "comparison must name two distinct declared treatments");
  for (const task of tasks.values()) {
    fields(task, ["id", "fixed"], "task");
    identities(task.fixed ?? {}, "task fixed identities", true);
  }
  for (const treatment of treatments.values()) {
    fields(treatment, ["id", "materials"], "treatment");
    identities(treatment.materials ?? {}, "treatment materials");
  }
  const allowed = uniqueBy(declaration.allowedDifferences, (difference) => JSON.stringify([difference?.kind, difference?.name]), "allowed difference");
  for (const difference of allowed.values()) {
    fields(difference, ["kind", "name"], "allowed difference");
    requireValue(MATERIAL_KINDS.includes(difference.kind) && text(difference.name), "only named skill/guidance/adapter differences are permitted");
    requireValue([...treatments.values()].some((treatment) => Object.hasOwn(treatment.materials?.[difference.kind] ?? {}, difference.name)), "allowed difference names no treatment material");
  }
  const cells = uniqueBy(declaration.cells, cellKey, "declared cell");
  requireValue(cells.size > 0, "comparison has no declared cells");
  for (const cell of cells.values()) {
    fields(cell, ["task", "treatment", "repetition", "condition", "observationId", "opportunities"], "declared cell");
    requireValue(tasks.has(cell.task) && treatments.has(cell.treatment) && Number.isSafeInteger(cell.repetition) && cell.repetition > 0 && text(cell.observationId), "invalid declared cell identity");
    requireValue(["skill-present", "skill-absent"].includes(cell.condition), "invalid cell condition");
    uniqueBy(cell.opportunities, (entry) => entry?.id, "declared opportunity");
    for (const entry of cell.opportunities) opportunity(entry);
  }
  uniqueBy(declaration.cells, (cell) => cell.observationId, "declared observation");
  for (const task of tasks.keys()) requireValue([...cells.values()].some((cell) => cell.task === task), "task has no planned cells");

  fields(observations, ["version", "comparison", "records"], "observations");
  requireValue(observations.version === 1 && observations.comparison === declaration.id, "observation comparison identity mismatch");
  const records = uniqueBy(observations.records, cellKey, "observed cell");
  uniqueBy(observations.records, (record) => record?.id, "observation");
  for (const [key, record] of records) {
    const cell = cells.get(key);
    requireValue(cell, "unexpected observed cell");
    fields(record, ["id", "locator", "task", "treatment", "repetition", "condition", "provenance", "scope", "lifecycle", "status", "fixed", "materials", "results"], "observation");
    requireValue(record.id === cell.observationId && (record.condition == null || record.condition === cell.condition), "contradictory observation identity");
    requireValue((record.locator == null || text(record.locator)) && (record.scope == null || text(record.scope)) && (record.provenance == null || ["synthetic", "live"].includes(record.provenance)), "invalid observation provenance/locator/scope");
    identity({ locator: record.locator }, "observation locator", true);
    requireValue(["planned", "started", "completed"].includes(record.lifecycle) && STATES.includes(record.status), "invalid observed lifecycle/status");
    requireValue(!(record.lifecycle === "planned" && (record.status !== "unknown" || record.results?.length)), "planned observation cannot carry execution results");
    requireValue(!(record.lifecycle === "started" && ["pass", "fail"].includes(record.status)), "started observation cannot claim completed verdict");
    if (record.fixed != null) identities(record.fixed, "observed fixed identities", true);
    if (record.materials != null) identities(record.materials, "observed treatment materials");
    const results = uniqueBy(record.results ?? [], (entry) => entry?.id, "opportunity result");
    const opportunities = new Map(cell.opportunities.map((entry) => [entry.id, entry]));
    for (const [id, entry] of results) {
      requireValue(opportunities.has(id), "unexpected opportunity result");
      result(entry, opportunities.get(id));
    }
  }
  return { tasks, treatments, cells, records, allowed };
}
