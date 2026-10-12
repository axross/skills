import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { canonicalJson } from "./layout.mjs";
import { AXES, FIXED_FIELDS, MATERIAL_KINDS, validateTreatmentInputs } from "./treatment-contract.mjs";

const SCORER = ["method", "rubric", "template", "script", "model", "route", "evidenceSlots"];
const resolved = (status) => ["pass", "fail"].includes(status);
const hash = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const keyOf = (cell) => JSON.stringify([cell.task, cell.treatment, cell.repetition]);
const deficit = (kind, at, reason) => ({ kind, at, reason });

/** missing identities are not evidence of equality, even on both sides. */
function compareIdentity(expected, actual, at, deficits) {
  if (expected == null || actual == null) deficits.push(deficit("unknown", at, "missing identity"));
  else if (!isDeepStrictEqual(expected, actual)) deficits.push(deficit("confounded", at, "identity mismatch"));
}

/** qualifies every source/content entry, including unexpected peer material. */
function compareMaterials(expected, actual, at, deficits, allowed = null) {
  for (const kind of MATERIAL_KINDS) {
    if (expected?.[kind] == null || actual?.[kind] == null) {
      deficits.push(deficit("unknown", `${at}.${kind}`, "missing material inventory"));
      continue;
    }
    const names = new Set([...Object.keys(expected[kind]), ...Object.keys(actual[kind])]);
    for (const name of names) {
      const left = Object.hasOwn(expected[kind], name) ? expected[kind][name] : null;
      const right = Object.hasOwn(actual[kind], name) ? actual[kind][name] : null;
      const isAllowed = allowed?.has(JSON.stringify([kind, name]));
      if (!left || !right) {
        if (!isAllowed) deficits.push(deficit("confounded", `${at}.${kind}.${name}`, "material inventory differs"));
        continue;
      }
      for (const field of ["source", "content"]) {
        if (isAllowed && left[field] != null && right[field] != null) continue;
        compareIdentity(left[field], right[field], `${at}.${kind}.${name}.${field}`, deficits);
      }
    }
  }
}

/** folds deficits without turning a known confound into an unknown. */
function qualification(deficits) {
  return {
    status: deficits.some((entry) => entry.kind === "confounded") ? "confounded" : deficits.length ? "unknown" : "qualified",
    deficits,
  };
}

/** checks a fixed scorer independently from the content of its declared slots. */
function scoringDeficits(declared, result, at) {
  const deficits = [];
  const expectedScorer = declared.scorer ?? {};
  for (const field of SCORER) compareIdentity(expectedScorer[field], result?.scorer?.[field], `${at}.scorer.${field}`, deficits);
  const expectedSlots = expectedScorer.evidenceSlots ?? [];
  if (expectedSlots.length === 0) deficits.push(deficit("unknown", `${at}.scorer.evidenceSlots`, "no declared evidence slots"));
  for (const slot of Object.keys(result?.evidence ?? {})) {
    if (expectedScorer.evidenceSlots && !expectedSlots.includes(slot)) deficits.push(deficit("confounded", `${at}.evidence.${slot}`, "undeclared evidence slot"));
  }
  for (const slot of expectedSlots) {
    const expected = declared.evidence?.[slot];
    const actual = result?.evidence?.[slot];
    compareIdentity(expected?.source, actual?.source, `${at}.evidence.${slot}.source`, deficits);
    if (expected?.content != null) compareIdentity(expected.content, actual?.content, `${at}.evidence.${slot}.content`, deficits);
    else if (declared.axis === "acquisition") deficits.push(deficit("unknown", `${at}.evidence.${slot}.content`, "missing expected acquisition content identity"));
    else if (!actual?.content) deficits.push(deficit("unknown", `${at}.evidence.${slot}.content`, "missing evidence content identity"));
    if (!actual?.locator) deficits.push(deficit("unknown", `${at}.evidence.${slot}.locator`, "missing evidence locator"));
  }
  if (expectedScorer.method !== "reasoning") return deficits;
  compareIdentity(expectedScorer.promptTemplate, result?.scorer?.promptTemplate, `${at}.scorer.promptTemplate`, deficits);
  if (!expectedScorer.promptTemplate || result?.fullPrompt == null) {
    deficits.push(deficit("unknown", `${at}.fullPrompt`, "missing full reasoning prompt or separated template"));
    return deficits;
  }
  compareIdentity(hash(expectedScorer.promptTemplate), expectedScorer.template, `${at}.template`, deficits);
  const foundSlots = new Set();
  let isPromptComplete = true;
  const rendered = expectedScorer.promptTemplate.replace(/\{\{([^{}]+)\}\}/g, (placeholder, slot) => {
    foundSlots.add(slot);
    const evidence = result?.evidence?.[slot];
    if (!expectedSlots.includes(slot)) {
      deficits.push(deficit("confounded", `${at}.template`, "undeclared prompt slot"));
      isPromptComplete = false;
      return placeholder;
    }
    if (typeof evidence?.payload !== "string") {
      deficits.push(deficit("unknown", `${at}.evidence.${slot}`, "missing declared prompt evidence"));
      isPromptComplete = false;
      return placeholder;
    }
    compareIdentity(hash(evidence.payload), evidence.content, `${at}.evidence.${slot}.payload`, deficits);
    return evidence.payload;
  });
  if (expectedSlots.some((slot) => !foundSlots.has(slot))) deficits.push(deficit("confounded", `${at}.template`, "declared evidence slot absent from template"));
  if (isPromptComplete && rendered !== result.fullPrompt) deficits.push(deficit("confounded", `${at}.fullPrompt`, "prompt differs outside declared evidence slots"));
  return deficits;
}

/** keeps axis observations independent and refuses proxy success claims. */
function assessedStatus(opportunity, result) {
  if (!result) return "missing";
  if (result.status !== "pass") return result.status;
  const details = result.details ?? {};
  if (opportunity.axis === "selection") {
    if (details.invoked == null || details.timing == null || details.timing === "unknown") return "unknown";
    if (!opportunity.applicable) return details.invoked ? "fail" : "pass";
    return details.invoked && details.timing === "before-dependent-judgment" ? "pass" : "fail";
  }
  if (opportunity.axis === "acquisition") {
    if (details.availability === "unavailable" || details.coverage === "unavailable") return "unsupported";
    if (!details.availability || details.availability === "unknown" || !details.route || ["unknown", "parent-only"].includes(details.route) || !details.coverage || details.coverage === "unknown") return "unknown";
    if (details.coverage === "mismatch" || ["stale", "mixed"].includes(details.delivery)) return "fail";
    if (details.coverage === "partial" || details.delivery === "truncated") return "partial";
    return "pass";
  }
  if (opportunity.axis !== "guards") return result.status;
  if (details.writeReached === false) return "not-reached";
  if (details.writeReached == null || details.writePrevented == null || details.writeOccurred == null || !details.decision || details.decision === "unknown") return "unknown";
  if (opportunity.dimensions.control === "valid-edit") {
    return details.decision === "allow" && details.writeOccurred && !details.writePrevented ? "pass" : "fail";
  }
  return details.decision === "refuse" && details.writePrevented && !details.writeOccurred ? "pass" : "fail";
}

/** counts the declared population; no surviving-record denominator is substituted. */
function population(entries, isComplete, isQualified) {
  const applicable = entries.filter((entry) => entry.applicable);
  const states = Object.fromEntries(["pass", "fail", "failure", "partial", "unknown", "approval-wait", "unsupported", "not-reached", "missing"].map((state) => [state, applicable.filter((entry) => entry.status === state).length]));
  const isResolved = applicable.every((entry) => resolved(entry.status) && entry.qualification.status === "qualified");
  return {
    planned: entries.length,
    applicable: applicable.length,
    inapplicable: entries.length - applicable.length,
    observed: applicable.filter((entry) => entry.observedStatus !== null).length,
    resolved: states.pass + states.fail,
    states,
    rate: isComplete && isQualified && isResolved && applicable.length > 0 ? states.pass / applicable.length : null,
    denominator: "all declared applicable opportunities",
  };
}

/**
 * computes an explicit candidate-minus-baseline report without dispatch or input mutation.
 * raw evidence and full reasoning prompts remain in the supplied immutable records.
 * @throws {Error} on malformed, duplicate, unexpected or contradictory inputs
 */
export function computeTreatmentReport(declaration, observations) {
  const { tasks, treatments, cells, records, allowed } = validateTreatmentInputs(declaration, observations);
  const deficits = [];
  compareMaterials(treatments.get(declaration.baseline).materials, treatments.get(declaration.candidate).materials, "treatments", deficits, allowed);
  const populationIdentities = Object.fromEntries(["provenance", "scope"].map((field) => [field, [...records.values()].find((record) => record[field] != null)?.[field]]));
  const cellReports = [];
  const groups = new Map();
  for (const [key, cell] of cells) {
    const record = records.get(key);
    const at = `cell:${key}`;
    const cellDeficits = [];
    if (!record) cellDeficits.push(deficit("unknown", at, "missing planned observation"));
    compareIdentity(cell.condition, record?.condition, `${at}.observedCondition`, cellDeficits);
    if (!record?.locator) cellDeficits.push(deficit("unknown", `${at}.locator`, "missing observation locator"));
    for (const field of FIXED_FIELDS) compareIdentity(tasks.get(cell.task).fixed?.[field], record?.fixed?.[field], `${at}.fixed.${field}`, cellDeficits);
    compareMaterials(treatments.get(cell.treatment).materials, record?.materials, `${at}.materials`, cellDeficits);
    const counterpart = cells.get(keyOf({ ...cell, treatment: cell.treatment === declaration.baseline ? declaration.candidate : declaration.baseline }));
    if (!counterpart) cellDeficits.push(deficit("unknown", at, "missing declared counterpart"));
    else compareIdentity(cell.condition, counterpart.condition, `${at}.condition`, cellDeficits);
    if (record) {
      for (const [field, expected] of Object.entries(populationIdentities)) compareIdentity(expected, record[field], `${at}.${field}`, cellDeficits);
    }
    deficits.push(...cellDeficits);
    const results = new Map((record?.results ?? []).map((entry) => [entry.id, entry]));
    const opportunities = cell.opportunities.map((opportunity) => {
      const result = results.get(opportunity.id);
      const entry = {
        id: opportunity.id, axis: opportunity.axis, applicable: opportunity.applicable,
        dimensions: { ...opportunity.dimensions }, observedStatus: result?.status ?? null,
        status: assessedStatus(opportunity, result),
        details: result?.details ? { ...result.details } : null,
        qualification: qualification(scoringDeficits(opportunity, result, `${at}.${opportunity.id}`)),
        evidence: Object.fromEntries(Object.entries(result?.evidence ?? {}).map(([slot, evidence]) => [slot, { source: evidence.source ?? null, content: evidence.content ?? null, locator: evidence.locator ?? null }])),
      };
      const groupKey = JSON.stringify([cell.task, opportunity.axis, opportunity.id]);
      const group = groups.get(groupKey) ?? { task: cell.task, axis: opportunity.axis, id: opportunity.id, entries: [] };
      group.entries.push({ treatment: cell.treatment, repetition: cell.repetition, opportunity, report: entry });
      groups.set(groupKey, group);
      return entry;
    });
    cellReports.push({ task: cell.task, treatment: cell.treatment, repetition: cell.repetition, condition: cell.condition, expectedObservation: cell.observationId, observation: record ? { id: record.id, locator: record.locator ?? null, provenance: record.provenance ?? null, scope: record.scope ?? null } : null, lifecycle: record?.lifecycle ?? "missing", status: record?.status ?? "missing", qualification: qualification(cellDeficits), opportunities });
  }
  const comparisonQualification = qualification(deficits);
  const cellsComplete = cellReports.every((cell) => cell.lifecycle === "completed" && resolved(cell.status));
  const isComplete = cellsComplete && cellReports.every((cell) => cell.opportunities.every((entry) => !entry.applicable || resolved(entry.status)));
  const isQualified = comparisonQualification.status === "qualified";
  const opportunityReports = [...groups.values()].map((group) => {
    const baseline = group.entries.filter((entry) => entry.treatment === declaration.baseline);
    const candidate = group.entries.filter((entry) => entry.treatment === declaration.candidate);
    const membership = baseline.length && candidate.length ? "common" : baseline.length ? "removed" : "added";
    const groupDeficits = group.entries.flatMap((entry) => entry.report.qualification.deficits);
    if (membership === "common") {
      const first = group.entries[0].opportunity;
      for (const entry of group.entries) {
        compareIdentity(first.scorer, entry.opportunity.scorer, `${group.id}.declaredScorer`, groupDeficits);
        for (const dimension of Object.keys(first.dimensions)) compareIdentity(first.dimensions[dimension], entry.opportunity.dimensions[dimension], `${group.id}.${dimension}`, groupDeficits);
        if (group.axis !== "acquisition") {
          for (const slot of first.scorer?.evidenceSlots ?? []) compareIdentity(first.evidence?.[slot]?.source, entry.opportunity.evidence?.[slot]?.source, `${group.id}.evidence.${slot}.source`, groupDeficits);
        }
      }
      if (!isDeepStrictEqual(baseline.map((entry) => entry.repetition).sort(), candidate.map((entry) => entry.repetition).sort())) groupDeficits.push(deficit("unknown", group.id, "unbalanced common opportunity population"));
      for (const entry of baseline) {
        const peer = candidate.find((other) => other.repetition === entry.repetition);
        if (peer) compareIdentity(entry.opportunity.applicable, peer.opportunity.applicable, `${group.id}.applicability`, groupDeficits);
      }
    }
    const groupQualification = qualification([...deficits, ...groupDeficits]);
    const populations = Object.fromEntries([declaration.baseline, declaration.candidate].map((treatment) => [treatment, population(group.entries.filter((entry) => entry.treatment === treatment).map((entry) => entry.report), cellsComplete, groupQualification.status === "qualified")]));
    const rates = [populations[declaration.baseline].rate, populations[declaration.candidate].rate];
    return { task: group.task, axis: group.axis, id: group.id, membership, qualification: groupQualification, populations, effect: membership === "common" && rates.every((rate) => rate !== null) ? rates[1] - rates[0] : null };
  });
  const axes = Object.fromEntries(AXES.map((axis) => {
    const commonIds = new Set(opportunityReports.filter((entry) => entry.axis === axis && entry.membership === "common").map((entry) => JSON.stringify([entry.task, entry.id])));
    const axisQualified = isQualified && opportunityReports.filter((entry) => entry.axis === axis && entry.membership === "common").every((entry) => entry.qualification.status === "qualified");
    const populations = Object.fromEntries([declaration.baseline, declaration.candidate].map((treatment) => [treatment, population(cellReports.filter((cell) => cell.treatment === treatment).flatMap((cell) => cell.opportunities.filter((entry) => entry.axis === axis && commonIds.has(JSON.stringify([cell.task, entry.id])))), cellsComplete, axisQualified)]));
    const rates = [populations[declaration.baseline].rate, populations[declaration.candidate].rate];
    return [axis, { populations, effect: rates.every((rate) => rate !== null) ? rates[1] - rates[0] : null }];
  }));
  const guards = cellReports.flatMap((cell) => cell.opportunities.filter((entry) => entry.axis === "guards" && entry.applicable).map((entry) => ({ ...entry, task: cell.task, treatment: cell.treatment })));
  const qualifiedGuardGroups = new Set(opportunityReports.filter((entry) => entry.axis === "guards" && entry.qualification.status === "qualified").map((entry) => JSON.stringify([entry.task, entry.id])));
  const guardScopes = [...new Set(guards.map((entry) => entry.dimensions.scope))].map((scope) => {
    const entries = guards.filter((entry) => entry.dimensions.scope === scope);
    const hasControls = [declaration.baseline, declaration.candidate].every((treatment) => ["valid-edit", "invalid-edit"].every((control) => entries.some((entry) => entry.treatment === treatment && entry.dimensions.control === control)));
    return { scope, instrumentQualified: cellsComplete && isQualified && hasControls && entries.every((entry) => entry.status === "pass" && qualifiedGuardGroups.has(JSON.stringify([entry.task, entry.id]))), reason: !hasControls ? "requires invalid-edit and valid-edit contrasts in both treatments" : "offline observations do not qualify live prevention", liveQualified: false };
  });
  return {
    version: 1, comparison: declaration.id, scope: declaration.scope,
    baseline: declaration.baseline, candidate: declaration.candidate,
    inputs: { declaration: hash(canonicalJson(declaration)), observations: hash(canonicalJson(observations)) },
    qualification: comparisonQualification,
    counts: { planned: cells.size, observedStarted: cellReports.filter((cell) => ["started", "completed"].includes(cell.lifecycle)).length, observedCompleted: cellReports.filter((cell) => cell.lifecycle === "completed").length },
    primaryComplete: isComplete,
    cells: cellReports, opportunities: opportunityReports, axes, guards: guardScopes,
    claimLimits: ["supplied declarations are not adoption or execution evidence", "synthetic observations test this report, not host behavior", "live worker, resume, permission, audit and prevention qualification remain pending"],
  };
}
