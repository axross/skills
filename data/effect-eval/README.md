# Skill effect evaluation — measurements

What the skill effect evaluation has measured, and the declared cases it
measures. The instrument that writes all of this lives in
[`tools/effect-eval/`](../../tools/effect-eval/README.md).

## Three kinds of file, three rules

The layout keeps measured, declared, and derived data in separate files,
because they answer different questions when something goes wrong.

| Kind         | Files                               | Rule                                                                     |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------ |
| **measured** | `transcript.jsonl`, `changes.patch` | Never regenerated. Re-acquiring them costs a paid probe.                 |
| **declared** | `metadata.json`                     | What was set. The CLI argv is derived from it, never recorded beside it. |
| **derived**  | every `summary.json`                | Regenerable. A drift check re-derives and fails on a mismatch.           |

A file in the wrong category is the failure this split exists to prevent: a
derived value stored as measured is a value nothing can check, and a measured
value treated as derived is one something will cheerfully regenerate as empty.

```text
data/effect-eval/
  fixture.json                  the declared cases
  summary.json                  derived — a snapshot across every measurement
  measurements/
    <case>-<id>/
      summary.json              derived — a summary of every probe below
      skill-absent-<id>/
        metadata.json           declared
        transcript.jsonl        measured — verbatim, redacted
        changes.patch           measured
      skill-present-<id>/
        …
```

`<id>` is eight random hex digits. Repetitions of one condition have no
ordering and are not paired across conditions, so an index would imply two
things that are not true; a random id implies neither.

## The transcript is stored verbatim, and that is the whole point

The instrument this replaced stored extracted signals and threw the raw stream
away, on the reasoning that a later question would be a threshold over the
signal already extracted. It was not. Reading six recovered session logs
answered three questions the stored records could not: which tools each run
used, the per-message token usage, and the model each message reported.

So every question a reading does not answer used to cost a paid re-run. Now it
costs a new reading of a file already on disk. Add the reading to
[`summarize.mjs`](../../tools/effect-eval/summarize.mjs)'s derivation, regenerate,
and commit — no probe is spawned and nothing is billed.

The transcripts are committed raw rather than compressed. Git zlib-compresses
blobs in its object store, so the disk saving from a hand-gzipped file is near
zero, and the file would stop being greppable, diffable, and readable in the
GitHub UI.

## Regenerating, and the drift check

```sh
node tools/effect-eval/summarize.mjs           # derive and write every summary
node tools/effect-eval/summarize.mjs --check   # derive and compare; write nothing
```

`--check` is the drift check. It runs in this repository's test suite over
every committed measurement, and again inside the measurement workflow before
anything is committed — one derivation, two callers.

Both derived surfaces are in `.prettierignore`. The bytes come from exactly one
serializer, and a second formatter with an opinion about them would make the
drift check fail against a file the instrument never wrote.

## `patch`, when a case needs a broken starting state

Optional, and no case declares one yet. A case whose prompt is symptom-shaped —
it describes a defect rather than naming a task — needs that defect to be real,
or the model reads the project, finds nothing wrong, and the probe measures
confusion. The mock does not carry it: a mock ships sound and the case brings
its own defect as a unified diff, applied while the workspace is materialized
and before the recorded history is replayed over it. `mocks/README.md` states
the principle and
[`docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md`](../../docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md)
records what it beat.

```json
{
  "id": "fix-a-thing",
  "mock": "tsuzuri",
  "patch": "patches/fix-a-thing.patch"
}
```

The path is resolved against **this directory**, so a patch lives beside the
fixture that declares it. Three rules govern one:

- **It is per case, not per condition.** Both conditions of one case start from
  one project tree, which is what the comparability check requires.
- **It maintains `history.jsonc` itself** whenever it changes the file set —
  dropping a name it deleted, adding a name it created. Modifying a file needs
  no such edit, because the name is already there.
- **It is checked offline.** `npm test` applies every declared patch against its
  mock, so a patch that stopped fitting fails there rather than in a dispatch
  that has already spent money reaching it.

## `capUsd` and `unmeasuredProbeCostCeilingUsd`

Both bound spending, and they bound different things. `capUsd` is the case's
real budget: a dispatch may lower it and may not raise it, because the fixture
is reviewed and committed where a dispatch input is typed into a form.
`unmeasuredProbeCostCeilingUsd` is not a budget at all — it is the per-probe
figure admission projects from **for a case nothing has measured yet**, and it
is read on no other occasion.

**Declare it above what the case is expected to cost, not at it.** Admission
admits when the projection fits the cap, so the direction of a wrong figure
decides which way it fails:

| Declared            | Projection | If it is wrong                                         |
| ------------------- | ---------- | ------------------------------------------------------ |
| Above the true cost | inflated   | a cheap case is refused before spending. Costs nothing |
| At the true cost    | accurate   | no spurious refusals, no margin either                 |
| Below the true cost | deflated   | an expensive case is admitted. Money leaves            |

Only the last row spends money on a mistake, which is why the field is named
for a ceiling rather than an estimate. It was called
`estimatedCostUsdPerProbe` until the pilot measured $0.25 per probe against a
declared 6 and made the mismatch plain; the value did not change, because 6 is
wrong as an estimate and correct as a guard.

Its provenance is worth keeping: 6 is the previous instrument's $40 cap divided
across six planned probes, never a cost observation. The recovered 2026-08-06
figures that might have informed it were lost with the container that held
them.

**The first comparable measurement supersedes it permanently.** Admission
projects from measured costs wherever they exist, so once a case has landed one
this field is never read for that case again — it governs only the first run.

## What is committed here

`measurements/` holds the case measurements taken so far, one directory per
measurement, and `summary.json` is the snapshot derived across all of them. The
pilot — `unit-testing` on `content-site`, since renamed `tsuzuri`, six probes —
landed in [#290](https://github.com/axross/skills/pull/290) at a total of
$1.5232 against its $40 cap.
