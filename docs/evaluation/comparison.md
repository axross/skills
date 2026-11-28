---
type: Procedure
title: Compare Evaluation Treatments
description: Run the offline comparison with a frozen declaration and observations, then locate missing or confounded evidence.
---

# Compare Evaluation Treatments

This command reads two separate UTF-8 JSON inputs and writes one regenerable
JSON report to stdout. It never changes the inputs, scans measurements, calls
models or dispatches actors. Authors designing the comparison can use
[the portable authoring practice](../../skills/agent-skill-authoring/references/skill-adoption-evaluation.md).

Supply the frozen declaration independently of the observations; copying actual
identities into an expected declaration after seeing results does not qualify an
experiment. Keep measured inputs immutable and keep raw payloads private. The
command does not authenticate declared identities or safely publish arbitrary
input text. Use safe correlation names and evidence locators without credentials
or URL queries. The report retains locators, source/content identifiers and
counts, not raw evidence or full judge prompts.

Run the offline interface from the repository root:

```bash
node tools/evaluation/compare.mjs <declaration.json> <observations.json>
node tools/evaluation/compare.mjs --help
```

Exit 0 means a report was emitted, including unknown or confounded comparisons.
Exit 1 means unreadable or invalid inputs; exit 2 means invalid invocation.
Neither exit 0 nor `qualified` means a live host or consumer adopted a rule.

## Input contract

This version-1 interface belongs only to this instrument, not to installed
skills. Unknown identities may be omitted or null; nonempty identities are
opaque caller-supplied strings except for the reasoning template and payload
hashes described below. Explicit empty material maps describe absence, whereas
a missing inventory remains unknown. The following fields define the declaration:

| Field                    | Contents                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`, `id`, `scope` | Version 1, comparison identity and claim scope                                                                                                                 |
| `baseline`, `candidate`  | The two distinct treatment IDs, in effect order                                                                                                                |
| `tasks`                  | `{ id, fixed }` entries; `fixed` names `fixture`, `outcome`, `taskMaterial`, `model`, `profile`, `harness` identities                                          |
| `treatments`             | `{ id, materials }` entries; `materials` has `skills`, `guidance`, `adapters` maps of names to `{ source, content }`                                           |
| `allowedDifferences`     | `{ kind, name }` entries naming only intended skill, guidance or adapter differences                                                                           |
| `cells`                  | `{ task, treatment, repetition, condition, observationId, opportunities }` entries; positive integer repetitions, `skill-present` or `skill-absent` conditions |

Each opportunity carries `id`, `axis`, boolean `applicable`, `dimensions`,
`scorer` and an `evidence` slot map. The axis dimensions are the fields in this
table:

| Axis          | `dimensions` fields                                                  |
| ------------- | -------------------------------------------------------------------- |
| `selection`   | `responsibility`, `stage`                                            |
| `acquisition` | `actor`, `phase`, `material`                                         |
| `conformity`  | `obligation`                                                         |
| `guards`      | `call`, `stage`, `scope`, `control` (`valid-edit` or `invalid-edit`) |

The scorer carries `method` (`script` or `reasoning`), definition identities
`rubric`, `template`, `script`, `model`, `route`, and `evidenceSlots` (unique
unordered slot names). Permuting `evidenceSlots` does not change the scorer;
membership and full reasoning-prompt checks still apply.
Use an explicit `none` identity for inapplicable script/model
fields. A reasoning scorer also carries the literal `promptTemplate`.
Its `template` identity is the SHA-256 digest of that string's exact UTF-8
bytes, formatted as `sha256:<lowercase hex>`. `{{slot}}` inserts that slot's
payload. The declaration's evidence map names each expected slot source and, where fixed,
content. Acquisition also needs expected required-content identities. Other
slots can have varying output content while their sources remain fixed.

The observations object carries `version: 1`, `comparison` equal to the
declaration ID and `records`. Each record identifies `id`, `locator`, `task`,
`treatment`, `repetition`, `condition`, `provenance` (`synthetic` or `live`),
`scope`, `lifecycle` (`planned`, `started`, `completed`), `status`, actual
`fixed` and `materials`, and `results`. Results carry opportunity `id`,
`status`, actual `scorer`, evidence slots and axis `details`. Evidence entries
carry `source`, `content`, `locator` and optional `payload`. For reasoning evidence,
`content` is the SHA-256 digest of the `payload` string's exact UTF-8 bytes,
formatted as `sha256:<lowercase hex>`. Reasoning results retain `fullPrompt`
and all slot payloads in the immutable observation input.

Statuses are `pass`, `fail`, `failure`, `partial`, `unknown`, `approval-wait`,
`unsupported`, or `not-reached`. A planned record has unknown status and no
results; a started record cannot claim a completed pass/fail verdict. The
report retains supplied verdicts and checks claimed passes against these
details:

| Axis        | `details` fields and values                                                                                                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selection   | Boolean/null `invoked`; `timing`: `before-dependent-judgment`, `after-dependent-judgment`, `unknown`                                                                                                                                                                    |
| Acquisition | `availability`: `available`, `unavailable`, `unknown`; `route`: `native`, `direct`, `retained`, `parent-only`, `unknown`; `coverage`: `full`, `partial`, `mismatch`, `unavailable`, `unknown`; optional `delivery`: `current`, `stale`, `truncated`, `mixed`, `unknown` |
| Conformity  | No additional fields; the separately evidenced output verdict supplies this observation                                                                                                                                                                                 |
| Guards      | `decision`: `allow`, `refuse`, `unknown`; boolean/null `writeReached`, `writePrevented`, `writeOccurred`                                                                                                                                                                |

Selection with `invoked: false` MUST NOT carry known before/after timing,
regardless of status or applicability; contradictory inputs exit 1. Omitted,
null or `unknown` timing remain legal for non-invocation. Use false for an observed non-invocation. If invocation itself was unobserved, omit `invoked` or use null. A supplied pass with unobserved invocation is assessed as unknown. An absent result for a planned opportunity is reported as missing.

`writeReached` means the edit path reached the relevant prevention checkpoint,
not that the mutation occurred. A refusal without observed prevention cannot
pass the invalid-edit control. Contradictory write observations are rejected.
Unavailable acquisition is unsupported, not automatically a failed delivery.
The [synthetic comparison fixtures](../../tests/evaluation/helpers/treatment-fixture.mjs)
show complete input construction and separated reasoning evidence; they are
instrument controls, not executable natural tasks or host evidence.

## Reading the report

Inspect `qualification.deficits`, each cell's qualification, and each common
opportunity's qualification before interpreting `axes.*.effect`. Read `counts`,
`primaryComplete`, opportunity membership, observation provenance and guard scopes
alongside effects. The [comparison specification](../specs/treatment-comparison.md)
owns denominator, completeness, qualification and claim semantics.

Each guard scope's `reason` explains one instrument-qualification blocker or is
null when `instrumentQualified` is true. Read `liveReason` separately for the
permanent offline limitation; `liveQualified` is always false.
