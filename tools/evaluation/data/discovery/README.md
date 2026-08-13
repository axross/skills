# Skill discovery evaluation — measurements

What the skill discovery evaluation has measured, and the declared cases it
measures. The instrument that writes all of this lives in
[`tools/evaluation/discovery/`](../../discovery/README.md).

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
tools/evaluation/data/discovery/
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
are always `Read`, `Glob`, `Grep` and `Skill` at most (`tools/evaluation/discovery`'s
own README has the full posture), so a probe never edits the workspace and
produces no artifact to capture.

## There is no baseline

[`tools/evaluation/discovery/summarize.mjs`](../../discovery/summarize.mjs)
derives `summary.json` across every directory under `measurements/` and
regenerates it from that directory alone — nothing here is a stored
conclusion a later run is compared against. With no measurements present the
derivation would be the empty-but-valid document
`{ "measurementCount": 0, "comparableCount": 0, "measurements": [] }`;
`measurements/.gitkeep` held the directory in that state until the first real
measurement landed beside it, and was removed then. What is committed today
is the derivation over the 46 case measurements described under "What is
committed here" below.

A measurement's delta — whether it agrees with its most recent comparable
predecessor — is derived the same way, by looking at the case's other
committed measurements. There is no re-record ritual and no `unmeasured`
declaration to clear: a case with no measurement yet simply has no directory
under `measurements/`, and a case with no comparable prior measurement yet
reports the condition that made none comparable rather than a delta.

## Regenerating, and the drift check

```sh
node tools/evaluation/discovery/summarize.mjs           # derive and write every summary
node tools/evaluation/discovery/summarize.mjs --check   # derive and compare; write nothing
```

`--check` is the drift check. It runs in this repository's test suite over
every committed measurement, re-deriving each `summary.json` (including the
root one) from the measured and declared files beside it and failing on any
byte difference.

Both derived surfaces are covered by `.prettierignore`'s generic
`tools/evaluation/data/*/summary.json` and
`tools/evaluation/data/*/measurements/**` entries — the bytes come from
exactly one serializer (`tools/evaluation/discovery/src/layout.mjs`'s
`canonicalJson`), and a second formatter with an opinion about them would make
the drift check fail against a file this instrument never wrote.

## `capUsd` and `unmeasuredProbeCostCeilingUsd`

Both bound spending, and they bound different things — the same split
[`tools/evaluation/data/effect/README.md`](../effect/README.md) documents for its own
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

| Mode         | Declared | Measured                                                                                                                                                                                                                                                                                                                                                |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **situated** | `0.35`   | $0.2541/probe (34 cases, 68 probes, $17.276125 total — [run 31564332460](https://github.com/axross/skills/actions/runs/31564332460)). The declared ceiling sat **above** the measured figure, the direction the surrounding prose intends.                                                                                                              |
| **bare**     | `0.05`   | $0.1335/probe under the current runtime (6 cases, 12 probes, $1.6020058 total, the re-measurement below); $0.0770/probe under the 1-turn cap it replaced. Either way the declared ceiling sat **below** the measured figure — optimistic, not pessimistic, the one direction that lets an expensive case get admitted when it should have been refused. |

Both are now permanently superseded for these 40 cases by their own committed
measurements, per mode, per "Superseding is per mode too" below. The bare
figure's shortfall did not cost anything here — the whole fixture still
admitted comfortably under its cap either way — but it is a defect in the
declared number's direction, not a rounding difference: a ceiling that sits
below the true cost is the "Money leaves" row `tools/evaluation/data/effect/README.md`'s
own ceiling table names, and the discovery fixture's declared `0.05` was in
that row for the entire run that measured it. The situated figure had no such
problem.

Admission projects each case at the ceiling for **the mode that dispatch will
actually run it in** ([`tools/evaluation/discovery/src/plan.mjs`](../../discovery/src/plan.mjs)'s
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

**46 measurements are committed, from two rounds** — 92 probes, 89 readable,
$19.80 in total. Across all of them the findings are 24 `MISS` and 2
`SPURIOUS` (`living-product-specification`, `sentry-instrumentation`); 22 of
the 46 carry no finding at all. No delta is usable yet: every measurement is
either its case's first, or the first taken under a runtime its predecessor
did not share.

**Round one measured the whole fixture**, in
[run 31564332460](https://github.com/axross/skills/actions/runs/31564332460)
(`main` @ `d8e1748`, model `claude-sonnet-5`, claude-code `2.1.220`): 40
measurements, all 40 comparable, 80 probes, $18.20. The 34 situated cases ran
68 probes for $17.276125 ($0.2541/probe); the 6 bare cases ran 12 probes for
$0.9239418 ($0.0770/probe). 37 of the 40 report the `discovered` population
and 3 the `mandated` one. Of its 77 readable probes, 42 selected no skill at
all and 35 did. Its 3 unreadable probes are all bare: each spent its single
permitted turn on `ToolSearch` rather than `Skill`, so no selection exists on
the tape to recover. What that 42, and the 22 `MISS` verdicts alongside it,
does and does not mean is
[`docs/specs/skill-evaluation.md`](../../../../docs/specs/skill-evaluation.md)'s
to say; this file only reports what ran.

**Round two re-measured the 6 bare cases** under the runtime
[#345](https://github.com/axross/skills/pull/345) introduced — a 2-turn cap
with `ToolSearch` denied — in six single-case dispatches (runs
[31654577018](https://github.com/axross/skills/actions/runs/31654577018),
[31654578808](https://github.com/axross/skills/actions/runs/31654578808),
[31654580183](https://github.com/axross/skills/actions/runs/31654580183),
[31654586022](https://github.com/axross/skills/actions/runs/31654586022),
[31654587341](https://github.com/axross/skills/actions/runs/31654587341),
[31654588651](https://github.com/axross/skills/actions/runs/31654588651)): 12
probes, all 12 readable, $1.6020058 ($0.1335/probe). Four cases selected their
`mustInclude` skill in both repeats; two did not —
`write-the-commit-message-for-this-change`, whose probes both chose
`software-instrumentation` over `conventional-commits`, and
`judge-whether-a-change-was-actually-checked`, whose probes selected nothing.
Both are `MISS` on readable evidence, which is what round one could not
produce for any bare case.

**That round settled the question #345 shipped open.** `ToolSearch` really is
withheld by `disallowedTools`: no probe called it, against three of twelve in
round one, and the case those three belonged to selected a skill this time.
Round one's own bare records improved without being re-run, too — the reader
fix in the same pull request lifted them from 1 readable probe to 9, by
reading a selection that was already on the tape.

**Two things the round did not settle, recorded rather than concluded.** Six
of its twelve probes still terminated `error_max_turns`, at a recorded `turns`
of 3 under a cap of 2, so the CLI's turn accounting is not what
`BARE_TURN_CAP`'s comment assumes; every selection was recovered anyway, and
one round is not enough to choose a different number. And a bare probe that
runs to completion costs more than one cut off early — $0.1335 against
$0.0770 — so the rise is the cap working, not a regression.

One case, `write-the-commit-message-for-this-change`, has a round-one
measurement with zero readable probes: every tracked skill there reports
`unevidenced` rather than `miss`, because `verdictFor` answers "no evidence"
before it ever reaches the `mustInclude`/`mustExclude` rule — see
[`tools/evaluation/discovery/README.md`](../../discovery/README.md)'s
"Verdicts, unchanged".

**`living-product-specification` no longer names a skill in this corpus.**
[#344](https://github.com/axross/skills/pull/344) renamed it to
`living-project-documentation` after this measurement was taken, so the
`MISS` above for `keep-the-docs-true-after-changing-behaviour` and one of
the two `SPURIOUS` findings both name a skill a reader will not find under
`skills/` today. That is not an error in the record: a measurement stores
the case as it stood the moment it ran and derives from that stored
`mustInclude`/`mustExclude` and stored `description` digests rather than
from today's fixture — the rename touches neither, so every committed
measurement still derives `comparable: true` (the within-measurement check,
unaffected either way). It does mean a future measurement of
`keep-the-docs-true-after-changing-behaviour` — which now tracks
`living-project-documentation`, per the current `fixture.json` — will find
no comparable predecessor in this one: `predecessorMismatches` will report a
description-digest disagreement for the tracked skill, because this
measurement's stored skill map has no entry for a name that did not exist
when it ran. That is `predecessorMismatches` working as designed, not a
defect to fix — the two measurements really did run against different text
under that case's tracked skill, and reporting them non-comparable is the
correct answer.

With every case now measured, a fresh dispatch prices from those committed
measurements rather than from the declared ceiling —
`node .github/scripts/discovery-eval-admit.mjs --dry-run-input false` prints
the current projection, and it moves as measurements accumulate, so derive it
rather than quoting this paragraph. A whole-fixture **measurement** dispatch
projects to **$18.54** against the $40 `capUsd` — admitted. A whole-fixture
**head** dispatch — the same command with `--pull-request <n>` added, which
forces every case bare — projects to **$4.66**: the 6 cases with a committed
_bare_ measurement price from it, and the 34 situated-declared cases — which
have no committed measurement in bare mode, superseding being per mode —
still price from the declared bare ceiling. Both figures rose with round two,
which measured a bare probe at `0.1335` where round one had it at `0.0770`.
Either projection refuses outright, before any probe spawns, the moment it
would exceed the cap — that stop-loss is unconditional and does not depend
on which mode a dispatch runs.
