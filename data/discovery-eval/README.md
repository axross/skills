# Skill discovery evaluation — measurements

What the skill discovery evaluation has measured, and the declared cases it
measures. The instrument that writes all of this lives in
[`tools/discovery-eval/`](../../tools/discovery-eval/README.md).

## Three kinds of file, three rules

Measured, declared, and derived data are kept in separate files, because they
answer different questions when something goes wrong.

| Kind         | Files                | Rule                                                                     |
| ------------ | -------------------- | ------------------------------------------------------------------------ |
| **measured** | `transcript.jsonl`   | Never regenerated. Re-acquiring it costs a paid probe.                   |
| **declared** | `metadata.json`      | What was set. The CLI argv is derived from it, never recorded beside it. |
| **derived**  | every `summary.json` | Regenerable. A drift check re-derives and fails on a mismatch.           |

A file in the wrong category is the failure this split exists to prevent: a
derived value stored as measured is a value nothing can check, and a measured
value treated as derived is one something will cheerfully regenerate as
empty.

```text
data/discovery-eval/
  fixture.json                  declared — the cases
  summary.json                  derived — one entry per measurement, across all of them
  measurements/
    <case-id>-<id>/
      summary.json              derived
      probe-<id>/
        metadata.json           declared
        transcript.jsonl        measured — verbatim, redacted
```

`<id>` is eight random hex digits. Repeats of one case have no ordering — they
are not a series — so an index would imply one; a random id implies none.

No `changes.patch` appears under a probe directory. A discovery probe's tools
are always `Read`, `Glob`, `Grep` and `Skill` at most (`tools/discovery-eval`'s
own README has the full posture), so a probe never edits the workspace and
produces no artifact to capture.

## There is no baseline

[`tools/discovery-eval/summarize.mjs`](../../tools/discovery-eval/summarize.mjs)
derives `summary.json` across every directory under `measurements/` and
regenerates it from that directory alone — nothing here is a stored
conclusion a later run is compared against. With no measurements present the
derivation would be the empty-but-valid document
`{ "measurementCount": 0, "comparableCount": 0, "measurements": [] }`;
`measurements/.gitkeep` held the directory in that state until the first real
measurement landed beside it, and was removed then. What is committed today
is the derivation over the 40 case measurements described under "What is
committed here" below.

A measurement's delta — whether it agrees with its most recent comparable
predecessor — is derived the same way, by looking at the case's other
committed measurements. There is no re-record ritual and no `unmeasured`
declaration to clear: a case with no measurement yet simply has no directory
under `measurements/`, and a case with no comparable prior measurement yet
reports the condition that made none comparable rather than a delta.

## Regenerating, and the drift check

```sh
node tools/discovery-eval/summarize.mjs           # derive and write every summary
node tools/discovery-eval/summarize.mjs --check   # derive and compare; write nothing
```

`--check` is the drift check. It runs in this repository's test suite over
every committed measurement, re-deriving each `summary.json` (including the
root one) from the measured and declared files beside it and failing on any
byte difference.

Both derived surfaces are covered by `.prettierignore`'s generic
`data/*/summary.json` and `data/*/measurements/**` entries — the bytes come
from exactly one serializer (`tools/discovery-eval/src/layout.mjs`'s
`canonicalJson`), and a second formatter with an opinion about them would make
the drift check fail against a file this instrument never wrote.

## `capUsd` and `unmeasuredProbeCostCeilingUsd`

Both bound spending, and they bound different things — the same split
[`data/effect-eval/README.md`](../effect-eval/README.md) documents for its own
instrument. `capUsd` is a case's real budget: a dispatch may lower it and may
not raise it, because the fixture is reviewed and committed where a dispatch
input is typed into a form. `unmeasuredProbeCostCeilingUsd` is not a budget at
all — it is the per-probe figure admission projects from for a case nothing
has measured yet in that mode, and it is read on no other occasion; the first
comparable measurement supersedes it permanently for that case, in that mode.

**It is declared per probe mode, not as one figure**, because a situated probe
and a bare probe cost roughly an order of magnitude apart:

```json
"unmeasuredProbeCostCeilingUsd": { "situated": 0.35, "bare": 0.05 }
```

| Mode         | Declared | Measured                                                                                                                                                                                                                                                |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **situated** | `0.35`   | $0.2541/probe (34 cases, 68 probes, $17.276125 total — [run 31564332460](https://github.com/axross/skills/actions/runs/31564332460)). The declared ceiling sat **above** the measured figure, the direction the surrounding prose intends.              |
| **bare**     | `0.05`   | $0.0770/probe (6 cases, 12 probes, $0.9239418 total — the same run). The declared ceiling sat **below** the measured figure — optimistic, not pessimistic, the one direction that lets an expensive case get admitted when it should have been refused. |

Both are now permanently superseded for these 40 cases by their own committed
measurements, per mode, per "Superseding is per mode too" below. The bare
figure's shortfall did not cost anything here — the whole fixture still
admitted comfortably under its cap either way — but it is a defect in the
declared number's direction, not a rounding difference: a ceiling that sits
below the true cost is the "Money leaves" row `data/effect-eval/README.md`'s
own ceiling table names, and the discovery fixture's declared `0.05` was in
that row for the entire run that measured it. The situated figure had no such
problem.

Admission projects each case at the ceiling for **the mode that dispatch will
actually run it in** ([`tools/discovery-eval/src/plan.mjs`](../../tools/discovery-eval/src/plan.mjs)'s
`planFor`), never the mode the case merely declares. A case declaring a `mock`
runs bare under `--head-skills` regardless — a head dispatch forces every case
bare — so it is projected at the bare figure, not the situated one. Projecting
a bare run at the situated figure was exactly the defect that made pull
request head evaluation unusable, pricing a dispatch at roughly seven times
what it costs.

**Superseding is per mode too.** A case's first _situated_ measurement
supersedes the situated ceiling for that case; it never supersedes the bare
one, and a bare measurement never supersedes the situated one. A situated
probe and a bare probe answer different questions at different prices, so one
mode's measurement standing in for the other's projection would be the same
category error committed in the other direction.

## What is committed here

`fixture.json` holds 40 cases: 34 situated across the three mocks —
`tsuzuri` 15, `inkwell` 14, `recall` 5 — and 6 bare, whose subject situating
would remove. Three of those six are there because materialization guarantees a
clean tree and no probe holds a shell, so a prompt about a change in flight — a
diff to review, a readiness to judge, a commit to write — has no referent a
situated probe could ever reach. 3 of the situated ones carry `"population": "mandated"` and
are reported apart, because a consumer's own instructions name those skills and
discovery never has to surface them. Seven declare a **case patch**, under
`patches/`, so the state their prompt describes is one the model can confirm
by reading rather than a premise it has to accept.

**Coverage is levelled rather than weighted.** Every skill in the corpus is
named by at least one case's `mustInclude`, and none by more than two. A second
case exists only where it measures a competitor boundary the first does not —
so the cases that used to sit three-deep on one skill, asking the same question
of the same competitor in the same shape, are one case now.

**The whole fixture has been measured once**, in
[run 31564332460](https://github.com/axross/skills/actions/runs/31564332460)
(`main` @ `d8e1748`, model `claude-sonnet-5`, claude-code `2.1.220`): 40
measurements, all 40 comparable, 80 probes, $18.20 total. The 34 situated
cases ran 68 probes for $17.276125 ($0.2541/probe); the 6 bare cases ran 12
probes for $0.9239418 ($0.0770/probe). 77 of the 80 probes are readable; the
3 that are not are all bare, all terminated `error_max_turns`, and all spent
their single permitted turn on `ToolSearch` rather than `Skill` — no
selection exists on the tape to recover for any of them. One case,
`write-the-commit-message-for-this-change`, has zero readable probes: every
tracked skill there reports `unevidenced` rather than `miss`, because
`verdictFor` answers "no evidence" before it ever reaches the
`mustInclude`/`mustExclude` rule — see
[`tools/discovery-eval/README.md`](../../tools/discovery-eval/README.md)'s
"Verdicts, unchanged". Of the 77 readable probes, 42 selected no skill at
all; the other 35 did. Across all 40 measurements the findings are 22
`MISS` and 2 `SPURIOUS` (`living-product-specification`,
`sentry-instrumentation`); 18 of the 40 cases carry no finding at all. 37
measurements report the `discovered` population and 3 the `mandated` one.
Every one of the 40 is a case's first measurement, so every delta reports
"no prior measurement of this case exists yet" rather than a comparison — 0
of 40 deltas are usable yet.

**`living-product-specification` no longer names a skill in this corpus.**
[#344](https://github.com/axross/skills/pull/344) renamed it to
`living-project-documentation` after this measurement was taken, so the
`MISS` above for `keep-the-docs-true-after-changing-behaviour` and one of
the two `SPURIOUS` findings both name a skill a reader will not find under
`skills/` today. That is not an error in the record: a measurement stores
the case as it stood the moment it ran and derives from that stored
`mustInclude`/`mustExclude` and stored `description` digests rather than
from today's fixture — the rename touches neither, so all 40 measurements
still derive `comparable: true` (the within-measurement check, unaffected
either way). It does mean a future measurement of
`keep-the-docs-true-after-changing-behaviour` — which now tracks
`living-project-documentation`, per the current `fixture.json` — will find
no comparable predecessor in this one: `predecessorMismatches` will report a
description-digest disagreement for the tracked skill, because this
measurement's stored skill map has no entry for a name that did not exist
when it ran. That is `predecessorMismatches` working as designed, not a
defect to fix — the two measurements really did run against different text
under that case's tracked skill, and reporting them non-comparable is the
correct answer.

With every case now measured once, a fresh dispatch prices from those
committed measurements rather than from the declared ceiling —
`node .github/scripts/discovery-eval-admit.mjs --dry-run-input false` prints
the current projection. A whole-fixture **measurement** dispatch now
projects to **$18.20** against the $40 `capUsd` — admitted, and equal to
what run 31564332460 actually spent, since every case's own measurement now
supersedes its ceiling. A whole-fixture **head** dispatch (`--pull-request`,
every case forced bare — `node .github/scripts/discovery-eval-admit.mjs
--dry-run-input false --pull-request <n>`) now projects to **$4.32**: the 6
cases with a committed _bare_ measurement price from it, and the 34
situated-declared cases — which have no committed measurement in bare mode,
superseding being per mode — still price from the declared bare ceiling.
Either projection refuses outright, before any probe spawns, the moment it
would exceed the cap — that stop-loss is unconditional and does not depend
on which mode a dispatch runs.
