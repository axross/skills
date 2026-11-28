---
type: Specification
title: Treatment Comparison
description: Qualification, denominators and missing-evidence behavior for a declared comparison of two treatments.
---

# Treatment Comparison

`compare.mjs` reports a declared candidate-minus-baseline comparison from two
independently supplied files: a declaration frozen before execution and stored
observations. It does not take measurements, call a judge, discover an implicit
baseline or change ordinary predecessor matching. An intentional skill revision
can differ only through named treatment material; there is no blanket digest or
full-prompt exemption for ordinary measurements.

For the two input files, an example fixture and the checks to run on a report, see [Compare Evaluation Treatments](../evaluation/comparison.md).

A treatment label identifies a guidance, skill or adapter variant, not its
digest or a skill-present/absent condition. Every planned task/treatment/repetition
cell identifies its expected observation and opportunities. Every supplied cell
is checked against its own expected source/content identities and fixed fixture,
requested outcome, task material, model, profile and non-treatment harness.
Duplicate, unexpected and internally contradictory inputs are rejected. Missing
observations or identities remain visible as unknown deficits. Declared identity
agreement qualifies this report's comparison; it authenticates neither execution
nor adoption.

Comparison qualification is `qualified`, `confounded` or `unknown`, with reasons.
An undeclared material or fixed-condition difference blocks all effects. Each
common opportunity also needs the same dimensions, applicability and repetitions
on both sides. Scorer differences block the affected opportunity or axis rather
than independent axes. A fixed scorer definition identifies its rubric, template
or script, judge model, route and evidence slots. Slot names are unique and
unordered; reordering them changes neither scorer identity nor prompt matching.
Non-acquisition slot sources
stay fixed across treatments and repetitions; output content may vary.
Acquisition slot sources stay fixed unless both compared sources match the
respective treatment sources of the same named allowed material. Naming two
unrelated sources in cell declarations does not make that change a treatment.
Expected acquisition content remains separately declared for each cell; the
report does not equate delivered-material content with one material's file hash.
For reasoning, the report checks the actual full prompt against the fixed
template rendered with those slots. Slot payloads and full prompts remain in
the immutable inputs; the report
carries their identities and locators, not their raw contents. Historical
records without this separation remain unknown, not retrofitted measurements.

The report keeps four populations separate:

| Axis        | Declared opportunity                              | Retained distinction                                                      |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| Selection   | Responsibility and stage                          | Selection before dependent judgment versus late or unnecessary invocation |
| Acquisition | Actor × phase × required material                 | Availability, route, coverage and delivery diagnostics                    |
| Conformity  | Output obligation                                 | Checked output verdict, independent of material acquisition               |
| Guards      | Call, stage, scope and valid/invalid edit control | Refusal, reached edit path, actual write and observed prevention          |

The instrument preserves submitted non-pass states. For claimed acquisition
passes, explicit unavailability remains unsupported. Known failure diagnostics
outrank partial diagnostics; either outranks missing or unknown dimensions, so
incomplete evidence cannot hide an observed problem. A claimed pass otherwise
lacking its axis evidence is not promoted: parent-only material stays
acquisition-unknown, partial delivery stays partial, and an unreached edit stays
not-reached.
For selection, an observed non-invocation passes an inapplicable control and
fails an applicable opportunity without needing invocation timing. A reported
non-invocation with known before/after timing is contradictory and rejected,
regardless of status or applicability; omitted, null and unknown timing remain
valid. Timing is
required only for an applicable invocation; unknown invocation stays unknown.
Domain criteria and applicability still come from adopted contracts; these
fields are an offline report interface, not another domain-policy owner.

Counts distinguish planned, observed-started and observed-completed cells.
Each population retains all declared applicable opportunities, including missing
results. No complete-case rate substitutes for that denominator. An unresolved
cell blocks every primary effect. Within completed cells, an unresolved
opportunity blocks its own population, not independently checked output or other
axes. Common opportunities contribute to effects; added and removed obligations
are reported separately. Empty applicable populations have a null rate. The
report-wide `primaryComplete` describes whether all applicable observations
resolved, not whether every scorer or identity qualified.

Synthetic and live provenance, and differing observation scopes, cannot be
pooled into one qualified report. Guard discrimination requires both invalid-edit
and valid-edit controls in each treatment: constant denial and ignored refusal
fail that check. Each applicable guard control also belongs to a qualified common
opportunity, using shared opportunity IDs for scorer and dimension comparison.
Added or removed guard controls remain visible but cannot qualify the comparative
instrument. `instrumentQualified` describes the supplied controls only;
its `reason` is null on success and otherwise names one instrument-qualification
blocker. The separate `liveReason` explains
why `liveQualified` remains false. Synthetic reports, installer checks and invocation
records establish no genuine worker, resume, normal-permission, live audit or
prevention qualification. The current unattended no-delegation profile cannot
establish those claims. Live fixtures, dependency adoption, host qualification,
cost/effect limits and execution authorization remain separate prerequisites.
