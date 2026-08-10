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
derivation is the empty-but-valid document
`{ "measurementCount": 0, "comparableCount": 0, "measurements": [] }`, which
is exactly what is committed in this tree today. `measurements/.gitkeep`
holds the directory until the first real measurement lands beside it and can
be removed then.

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

| Mode         | Declared | Measured                                                                                                                                                                                                  |
| ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **situated** | `0.35`   | Unmeasured for this instrument; a ceiling above the effect axis's own measured $0.209–$0.315, since a situated probe explores similarly                                                                   |
| **bare**     | `0.05`   | Comfortably above the one dispatch this instrument's bare-only predecessor ever ran: 140 probes for $3.76, or $0.0269 each ([run 30519599805](https://github.com/axross/skills/actions/runs/30519599805)) |

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

**No measurement has been taken yet**, so `measurements/` holds only
`.gitkeep` and `summary.json` is the empty-but-valid derivation over nothing.
With nothing measured, admission projects every case from the fixture's
declared ceiling for the mode that case actually runs in. A whole-fixture
**measurement** dispatch (34 situated cases plus 6 that declare no `mock` and
run bare regardless of dispatch type, 80 probes total) projects to **$24.40**
against the $40 `capUsd` — admitted. A whole-fixture **head** dispatch
(`--pull-request`, every case forced bare) projects to **$4.00** — also
admitted, and the scenario this per-mode ceiling exists to make usable (see
`tools/discovery-eval/src/admission.mjs`'s header). Either projection refuses
outright, before any probe spawns, the moment it would exceed the cap — that
stop-loss is unconditional and does not depend on which mode a dispatch runs.
