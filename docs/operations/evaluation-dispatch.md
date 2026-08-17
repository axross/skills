# Evaluation Dispatch

Running `tools/evaluation`'s one instrument — `probe.mjs`, `evaluate.mjs`,
and `derive.mjs` — against this repository's declared evaluation scenarios,
by hand on a local machine or through `.github/workflows/evaluation-dispatch.yaml`,
this repository's one dispatch workflow. [Verification
Gates](../conventions/verification-gates.md) covers why it reports rather
than gates; this document covers how to run it, either way.

## The Dispatch Workflow

`evaluation-dispatch.yaml` is triggered manually, by `workflow_dispatch`, and
by nothing else — a contributor cannot cause a run, and a pull request cannot
alter what a run executes, because `workflow_dispatch` requires write access
on the repository to fire at all (a dispatch runs the workflow file as it
exists on whichever ref is selected, not forcibly the default branch; the
default branch only has to hold the file for the event to be dispatchable in
the first place). Someone able to dispatch a modified copy of this workflow
from a branch could already push that branch — and could already push to the
default branch.

Its dispatch form takes four inputs: `scenario` (blank: every scenario
declared under `tools/evaluation/scenarios/`), `repetitions` (blank: the
instrument's own default), `probe-limit` (the exact probe count admission
refuses the dispatch against; blank: no limit), and `dry-run` (a boolean; see
below).

It runs four jobs in order:

1. **`plan`** expands the selected scenario(s) into the probe matrix and the
   judgment matrix once, applying the same admission `probe.mjs` applies
   locally, and emits both as job outputs. A dispatch whose exact probe count
   exceeds `probe-limit` is refused here, naming both the count and the
   limit, before any probe job starts.
2. **`probe`** fans the probe matrix out one cell per job — one scenario, one
   condition, one repetition — with `permissions: {}` and the
   `CLAUDE_CODE_OAUTH_TOKEN` credential a probe's `claude` CLI authenticates
   with, and no `GITHUB_TOKEN`. `fail-fast: false`, so one failed probe
   neither cancels its siblings nor discards the paid work of the cells that
   already finished. Every probe of one dispatch that shares a scenario
   writes under the same measurement directory, whichever cell's own process
   wrote it — `plan` mints that directory name once per scenario and hands it
   to every cell that needs it.
3. **`evaluate`** fans out one cell per selected scenario — not one job for
   the whole dispatch, and not one cell per probe — and judges what `probe`
   stored. **The granularity follows the instrument, not a preference**:
   `evaluate.mjs` takes a measurement directory as its one argument, and a
   measurement directory is exactly one scenario's, so one cell per scenario
   is the grain the script itself already draws. `fail-fast: false` for the
   same reason `probe` has it — a scenario's failed judgment must not take
   every other scenario's, after every probe in the dispatch has already
   been paid for; a coarser grain (one job for the whole dispatch) would give
   judgment no equivalent of that isolation. `permissions: {}` and no
   `GITHUB_TOKEN`, since this is the job that feeds a probe's transcript to a
   model. It references `secrets.ANTHROPIC_API_KEY`, which this repository
   does not set today; with none, `evaluate.mjs` already records each
   reasoning factor's result as an error carrying its reason rather than as
   `false`, so the cell still completes and still uploads what it judged.
4. **`land`** is the only job with `contents: write` and
   `pull-requests: write`, and the only one that receives no model
   credential at any step.
   It assembles every probe artifact and every judged artifact the dispatch
   produced, derives each measurement's summary (a derivation that fails is
   reported rather than allowed to fail the job — a measurement whose
   judgment could not complete is still committed, with the pull request
   body saying its derived tier is absent, because the probes already cost
   money and are not re-acquired for free), runs this repository's own
   `npm run check` — which **does** fail the job, because a measurement
   that fails this repository's own gates is a defect in the instrument
   rather than a finding about a skill — commits under the `github-actions[bot]`
   identity, and opens the measurement pull request.
   `merge-checks.yaml` excludes that pull request by path (see its own
   header comment), which is why the checks run here instead of there.

Every probe cell and every `evaluate` cell uploads its own artifact
independently of what any other cell does, so a `land` that fails is
recovered by re-running `land` alone against those artifacts — never by
re-probing.

**A dry-run dispatch reaches `probe` and stops there.** `plan`'s matrix
derivation never spawns anything regardless of this input, and every `probe`
cell adds the instrument's own `--dry-run` — which walks the same
matrix-and-admission path with the spawn stubbed, so nothing is spawned,
nothing is billed, and no record is written. With nothing recorded,
`evaluate` and `land` have nothing to run against and are skipped by
condition rather than by an empty run.

## Taking a Measurement: `probe.mjs`

```bash
node tools/evaluation/probe.mjs --dry-run
node tools/evaluation/probe.mjs --scenario <id> --repetitions <n> --limit <n>
node tools/evaluation/probe.mjs --help
```

| Flag                    | Does                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--scenario <id>`       | Only this scenario (default: every scenario under `tools/evaluation/scenarios/`)                                        |
| `--conditions <list>`   | Comma-separated, from `skill-present`, `skill-absent` (default: both)                                                   |
| `--repetitions <n>`     | Repetitions per condition (default: 3)                                                                                  |
| `--condition <c>`       | With `--repetition`, select exactly one probe instead of the `--conditions` x `--repetitions` cross product             |
| `--repetition <n>`      | With `--condition`, the 1-based repetition index this one probe is recorded under                                       |
| `--measurement-id <id>` | Fix the id `measurementDirName` mints, so every invocation given the same id writes into the same measurement directory |
| `--limit <n>`           | Refuses the run before anything starts if the exact probe count exceeds this                                            |
| `--out <dir>`           | Measurement root to write under (default: `tools/evaluation/measurements`)                                              |
| `--dry-run`             | Reports the probe matrix and the admission outcome; spawns nothing                                                      |
| `--emit-matrix`         | Prints the probe matrix and the judgment matrix as one JSON document; spawns nothing                                    |

`--condition`/`--repetition`, `--measurement-id`, and `--emit-matrix` exist
for the dispatch workflow above: they are what makes one GitHub Actions
matrix cell — its own, separate process — able to run exactly one probe of a
larger matrix and agree with its sibling cells on where their shared
scenario's measurement lives, and what lets `plan` feed Actions a matrix
without re-parsing the human-readable lines below. Run by hand, the plural
`--conditions`/`--repetitions` and the default fresh id per scenario are
still what a person normally wants.

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

## The Declared Scenario Set

Seven scenarios are declared today, all against the `inkwell` mock project,
under `tools/evaluation/scenarios/`:

- [`quiet-the-stale-post-list-after-a-draft-save`](../../tools/evaluation/scenarios/quiet-the-stale-post-list-after-a-draft-save/)
  targets `tanstack-query-development`, alongside `react-component-development`
  and `code-maintainability` as peers, and carries a `discovery` factor, two
  `outcome` factors, and a `transcript` factor judged by reasoning.
- [`respect-reduced-motion-in-the-publish-toast`](../../tools/evaluation/scenarios/respect-reduced-motion-in-the-publish-toast/)
  and
  [`give-the-empty-post-list-a-real-empty-state`](../../tools/evaluation/scenarios/give-the-empty-post-list-a-real-empty-state/)
  both target `react-component-styling`, claiming the two subjects
  `tools/evaluation/mocks/README.md`'s own "choices made for coverage" list
  names for `inkwell`: the toast's missing `prefers-reduced-motion` guard,
  and the property order the mock's stylesheets deliberately never
  demonstrate.
- [`confirm-a-draft-save-like-a-publish-does`](../../tools/evaluation/scenarios/confirm-a-draft-save-like-a-publish-does/)
  targets `github-operation` on an ordinary `inkwell` task with nothing
  GitHub-shaped about it — this practice's **negative control** (see
  [`docs/glossary.md`](../glossary.md)), its one measurement of its own
  noise floor. It declares no `discovery` factor, for the reason its own
  `scenario.json` states.
- [`find-out-what-a-change-has-to-pass-here`](../../tools/evaluation/scenarios/find-out-what-a-change-has-to-pass-here/)
  targets `software-development`, alongside `quality-assurance` and
  `unit-testing` as peers, on a plain contributor question rather than a
  code change. It carries a `discovery` factor and three `transcript`
  factors — two judged by script (reading the project's own contributor
  documentation, then naming every check it lists) and one by reasoning
  (conveying the format-then-lint loop as an ordered discipline rather
  than a flat checklist) — and declares no `outcome` phase, since the task
  leaves no artefact in the working tree for one to read.
- [`go-through-the-routes-commit-before-anyone-else-does`](../../tools/evaluation/scenarios/go-through-the-routes-commit-before-anyone-else-does/)
  targets `code-review`, alongside `quality-assurance`, `code-maintainability`,
  and `loop-engineering` as peers, on `inkwell`'s `routes + shell` commit — its
  real front end, not the trivial `docs` commit at `HEAD`. It carries a
  `discovery` factor and three `transcript` factors — two judged by script
  (scoping the review from the commit's own diff, then anchoring findings to
  real lines of the commit's own files) and one by reasoning (naming an
  actual defect) — with no `outcome` phase, for the same reason as above.
- [`judge-what-the-publish-toast-commit-leaves-unchecked`](../../tools/evaluation/scenarios/judge-what-the-publish-toast-commit-leaves-unchecked/)
  targets `quality-assurance`, alongside `code-review` and `unit-testing` as
  peers, on a different commit from the review scenario above — `publish
toast` — and a differently framed question: not what a reviewer would
  raise about the change, but what signing it off would mean taking on
  trust. It carries a `discovery` factor and two `transcript` factors — one
  judged by script (requiring the format-and-lint gate as evidence) and one
  by reasoning (naming the untested toast as the actual gap) — again with
  no `outcome` phase.

Together these exercise every path through the three scripts named above,
plus three more that read a stored transcript's tool inputs and assistant
text directly rather than by counting keywords over the whole stream: every
phase, both judgment methods, and a scenario that omits a phase entirely.
This change is itself further scenario authoring against `inkwell`; what
remains later work is authoring against the mock's still-uncatalogued
subjects and against this repository's other mocks, not against `inkwell`
as a whole. This document describes what runs today, not the coverage it
will eventually have.
