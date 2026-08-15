# Evaluation Dispatch

Running `tools/evaluation`'s one instrument — `probe.mjs`, `evaluate.mjs`,
and `derive.mjs` — against this repository's declared evaluation scenarios.
[Verification Gates](../conventions/verification-gates.md) covers why it
reports rather than gates; this document covers how to run it.

## There Is No Dispatch Workflow Yet

Every run described below is local. `.github/workflows/` names no entry
point for this instrument, and nothing here should be read as one — the two
workflows it replaced are deleted, not renamed, and their replacement has
not been written yet. Until it lands, taking a measurement means a person
running the three scripts below on their own machine, with their own
credentials, and deciding for themselves whether to commit what came out.

## Taking a Measurement: `probe.mjs`

```bash
node tools/evaluation/probe.mjs --dry-run
node tools/evaluation/probe.mjs --scenario <id> --repetitions <n> --limit <n>
node tools/evaluation/probe.mjs --help
```

| Flag                  | Does                                                                             |
| --------------------- | -------------------------------------------------------------------------------- |
| `--scenario <id>`     | Only this scenario (default: every scenario under `tools/evaluation/scenarios/`) |
| `--conditions <list>` | Comma-separated, from `skill-present`, `skill-absent` (default: both)            |
| `--repetitions <n>`   | Repetitions per condition (default: 3)                                           |
| `--limit <n>`         | Refuses the run before anything starts if the exact probe count exceeds this     |
| `--out <dir>`         | Measurement root to write under (default: `tools/evaluation/measurements`)       |
| `--dry-run`           | Reports the probe matrix and the admission outcome; spawns nothing               |

With no `--scenario`, a run expands every scenario under
`tools/evaluation/scenarios/` into its probe matrix — every declared
condition times every repetition — and, absent `--dry-run`, runs each probe
for real: materializing the scenario's mock project as a real Git
repository, installing the condition's skills into it, and spawning the
`claude` CLI on the scenario's task with `Bash`, `Edit`, `Glob`, `Grep`,
`Read`, `Skill`, `TodoWrite`, and `Write` all permitted. A probe is told in
its own system prompt that it runs unattended, and it runs until it
finishes or until it has produced 100 assistant turns, whichever comes
first.

`--dry-run` walks the same matrix-and-admission path with the spawn
stubbed out: it prints the matrix and the admission outcome and exits
before any probe would have started, so it costs nothing and needs no
credential. A real run needs the `claude` CLI on `PATH`, authenticated with
`CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` — the two variables
`tools/evaluation/src/credentials.mjs` keeps in a probe's environment while
stripping everything else that looks like a secret, and redacts from the
transcript it stores.

Each probe writes its `metadata.json`, `transcript.jsonl`, `changes.patch`,
and `invocations.json` under
`tools/evaluation/measurements/<scenario-id>-<id>/<condition>-<repetition>/`.
Nothing here commits what it wrote — that stays a person's decision, the
same as opening the pull request that would carry it.

## Admission Binds Before Any Probe Starts

A run refuses before spawning anything when its exact probe count exceeds
the `--limit` it was given — never by projecting a dollar figure. That
replaces a cost estimate rather than tightening one:
[`2026-08-15-rebuild-skill-evaluation-around-scenarios-and-factors.md`](../decisions/2026-08-15-rebuild-skill-evaluation-around-scenarios-and-factors.md)
is the decision that rejected estimating cost before a dispatch, because
the deleted instrument's own projection was wrong often enough that the
limit it fed was not a limit. `--limit` is optional; a run given none is
admitted unconditionally, and a run over its limit is refused with a
message naming both the count and the limit.

## Judging a Measurement: `evaluate.mjs`

```bash
node tools/evaluation/evaluate.mjs <measurement-dir>
node tools/evaluation/evaluate.mjs --help
```

For every probe directory under `<measurement-dir>`, `evaluate.mjs`
reconstructs that probe's workspace from what it stored — never from a
workspace still on disk — and judges every factor its scenario declares
against the material its phase permits: a `discovery` factor sees the
skill invocations, an `outcome` factor sees the diff and the task, a
`transcript` factor sees the transcript. A measurement missing one of the
four files a probe writes fails the whole run loudly, naming what is
missing, rather than being judged on what remains.

A `script` factor runs its declared script against the reconstructed
workspace. A `reasoning` factor asks the model its scenario names, over the
Anthropic Messages API directly, and needs `ANTHROPIC_API_KEY`; without
one, that factor's own result is recorded as an error — never as `false`,
and never by aborting any other factor's judgment — so the script still
completes end to end with no credential present at all, which is how this
repository's own test suite exercises it. Each probe's judged factors are
written to its own `factors.json`.

## Deriving the Summary: `derive.mjs`

```bash
node tools/evaluation/derive.mjs <measurement-dir>
node tools/evaluation/derive.mjs <measurement-dir> --check
node tools/evaluation/derive.mjs --help
```

`derive.mjs` computes a measurement's derived tier — each factor's
differential, the probe counts, the measurement's actual spend summed from
each probe's own, and its comparable predecessor among that scenario's
other measurements — from what
`probe.mjs` and `evaluate.mjs` already wrote, and writes it to the
measurement's own `summary.json`. `--check` recomputes it and compares the
result byte-for-byte against what is already there, failing on any
mismatch — the drift check that catches a hand-edited derived file.

## The One Declared Scenario

`tools/evaluation/scenarios/quiet-the-stale-post-list-after-a-draft-save/`
is the only scenario declared today. It targets
`tanstack-query-development` against the `inkwell` mock project, alongside
`react-component-development` and `code-maintainability` as peers, and
carries a `discovery` factor, two `outcome` factors, and a `transcript`
factor judged by reasoning — enough to exercise every path through the
three scripts above. Authoring the rest of the scenario set is separate,
later work; this document describes what runs today, not the coverage it
will eventually have.
