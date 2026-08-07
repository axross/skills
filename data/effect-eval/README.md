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

## `capUsd` and `estimatedCostUsdPerProbe`

Each case declares its own cap. A dispatch may lower it and may not raise it:
the fixture is reviewed and committed, and a dispatch input is typed into a
form.

`estimatedCostUsdPerProbe` seeds the admission projection for a case that has
no committed measurement yet. **It is a declared placeholder, not a
measurement.** The current value is carried over from the previous instrument's
$40 cap across its six planned probes; the recovered 2026-08-06 figures that
would replace it were lost with the container that held them. That is sound
rather than sloppy — a cost estimate does not require measurement
comparability, which is the expensive property — and the first committed
measurement supersedes it, because admission projects from measured costs
wherever they exist.

## No measurement is committed yet

The instrument is built and this directory holds only the declared cases. The
pilot that fills `measurements/` is its own issue, and is the step that spends
money.
