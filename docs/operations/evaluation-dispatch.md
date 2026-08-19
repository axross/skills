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

Under `tools/evaluation/scenarios/`, <!-- count:declared-scenarios -->eighteen<!-- /count --> scenarios are declared today: ten against the `inkwell` mock project, and eight against `tsuzuri`.

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
- [`give-every-screen-one-loading-and-error-treatment`](../../tools/evaluation/scenarios/give-every-screen-one-loading-and-error-treatment/)
  targets `react-component-development`, alongside `code-maintainability` and
  `react-component-styling` as peers, against the three route components that
  each hand-roll their own loading and error branches in three different
  shapes. It carries a `discovery` factor and two `outcome` factors — one
  checking the repetition landed in one new module both screens import, the
  other checking that module still lets each screen say its own thing — and
  no `transcript` factor.
- [`sketch-a-screen-for-how-an-authors-posts-are-doing`](../../tools/evaluation/scenarios/sketch-a-screen-for-how-an-authors-posts-are-doing/)
  targets `wireframe-design`, alongside `high-fidelity-ui-design` and
  `react-component-styling` as peers, against a screen `inkwell` deliberately
  does not have: an author's own performance dashboard. It carries a
  `discovery` factor and two `outcome` factors — one checking a
  self-contained document exists and names this screen's own subject, the
  other checking it stays at breadboard fidelity — and no `transcript`
  factor.
- [`confirm-a-draft-save-like-a-publish-does`](../../tools/evaluation/scenarios/confirm-a-draft-save-like-a-publish-does/)
  targets `github-operation` on an ordinary `inkwell` task with nothing
  GitHub-shaped about it — this practice's **negative control** (see
  [`docs/glossary.md`](../glossary.md)), its one measurement of its own
  noise floor. It declares no `discovery` factor, for the reason its own
  `scenario.json` states.
- [`bring-the-analytics-event-names-into-one-scheme`](../../tools/evaluation/scenarios/bring-the-analytics-event-names-into-one-scheme/)
  targets `software-instrumentation`, with `amplitude-instrumentation` and
  `code-maintainability` as peers, and
  [`keep-a-running-count-of-an-authors-visits`](../../tools/evaluation/scenarios/keep-a-running-count-of-an-authors-visits/)
  targets `amplitude-instrumentation`, with `software-instrumentation` and
  `sentry-instrumentation` as peers — each names the other as its own peer,
  since a scheme for an event's name and which `Identify` operator a running
  count needs are the same kind of question read two ways. Both carry a
  `discovery` factor and two `outcome` factors, every factor judged by
  script, and neither declares a `transcript` phase.
- [`restore-real-file-names-in-production-stack-traces`](../../tools/evaluation/scenarios/restore-real-file-names-in-production-stack-traces/)
  targets `sentry-instrumentation`, alongside `software-instrumentation` and
  `software-development` as peers, and is the first scenario in the tree to
  declare a `patch`: a unified diff that turns off `inkwell`'s working
  source-map upload, applied at materialization rather than shipped in the
  mock. Every factor, including its transcript factor, is judged by script —
  see [Skill Evaluation](../specs/skill-evaluation.md) on `patch`, and
  [Directory Structure](../conventions/directory-structure.md) for the
  convention it follows.
- [`run-the-toast-tests-the-suite-never-collects`](../../tools/evaluation/scenarios/run-the-toast-tests-the-suite-never-collects/)
  targets `vitest-testing`, alongside `unit-testing` and `software-development`
  as peers, and likewise declares a `patch`: one that adds a real-DOM test for
  `PublishToast` named so it matches neither Vitest project's own `include`.
  Its two outcome factors are textual, structural reads of `vitest.config.ts`
  rather than a glob evaluator, and its transcript factor, like the sentry
  scenario's, is judged by script.
- [`publish-an-edit-without-a-redeploy`](../../tools/evaluation/scenarios/publish-an-edit-without-a-redeploy/)
  targets `next-app-development` against `tsuzuri`'s build-time post catalog
  — [`tools/evaluation/mocks/README.md`](../../tools/evaluation/mocks/README.md)'s
  own "choices made for coverage" list names it — alongside
  `tanstack-query-development` and `code-maintainability` as peers, and
  carries a `discovery` factor and two `outcome` factors. It declares no
  `transcript` factor, and its own `scenario.json` says why: the mock
  states this defect's cause in its own prose, in both conditions, so a
  transcript scan for that reasoning would measure reading rather than
  reasoning.
- [`accept-a-page-number-from-a-url`](../../tools/evaluation/scenarios/accept-a-page-number-from-a-url/)
  targets `zod-schema` against a URL page number `tsuzuri` parses nowhere
  today, alongside `next-app-development` and `react-component-development`
  as peers, and carries a `discovery` factor and two `outcome` factors.
- [`let-readers-leave-a-note-on-a-post`](../../tools/evaluation/scenarios/let-readers-leave-a-note-on-a-post/)
  targets `application-security` against a reader-note feature invented in
  its own prompt, alongside `zod-schema` and `next-app-development` as
  peers, and carries a `discovery` factor, one `outcome` factor, and a
  `transcript` factor judged by script.
- [`let-readers-choose-which-language-a-post-shows-in`](../../tools/evaluation/scenarios/let-readers-choose-which-language-a-post-shows-in/)
  targets `loop-engineering` on `tsuzuri`, alongside
  `product-requirement-document-authoring`, `software-development`, and
  `next-app-development` as peers. It declares a `discovery` factor judged by
  script and nothing else, because the other two phases cannot be judged
  honestly for a skill that governs how an agent works — see
  [`docs/decisions/2026-08-17-measure-agent-conduct-skills-by-discovery-alone.md`](../decisions/2026-08-17-measure-agent-conduct-skills-by-discovery-alone.md).

- [`document-a-rollback-someone-can-follow`](../../tools/evaluation/scenarios/document-a-rollback-someone-can-follow/)
  targets `technical-document-authoring` against `docs/deployment.md`'s
  bare "Rolling back" section, alongside `living-project-documentation`
  and `product-requirement-document-authoring` as peers, and carries a
  `discovery` factor, two structural `outcome` factors reading that section,
  and an `outcome` factor judged by reasoning.
- [`specify-reader-corrections-before-anyone-builds-it`](../../tools/evaluation/scenarios/specify-reader-corrections-before-anyone-builds-it/)
  targets `product-requirement-document-authoring` against a feature the mock
  has never specified, alongside `technical-document-authoring` and
  `living-project-documentation` as peers, and carries a `discovery` factor,
  three structural `outcome` factors — one per required heading, since a
  factor result is never a ratio — and an `outcome` factor judged by reasoning.
- [`keep-the-locale-notes-true-after-changing-the-fallback`](../../tools/evaluation/scenarios/keep-the-locale-notes-true-after-changing-the-fallback/)
  targets `living-project-documentation` against a behaviour change that
  invalidates what the project already documents, alongside
  `technical-document-authoring` and `next-app-development` as peers. It
  carries a `discovery` factor, a guard `outcome` factor confirming the
  requested behaviour change actually happened, two structural `outcome`
  factors reading whether the documentation it invalidated was corrected, and
  an `outcome` factor judged by reasoning.
- [`make-room-for-a-third-language-matching-rule`](../../tools/evaluation/scenarios/make-room-for-a-third-language-matching-rule/)
  targets `code-maintainability` against the duplicated translation search in
  `shared/resolve-translation.ts`, alongside `code-review` and `unit-testing`
  as peers, and carries a `discovery` factor, an improvement `outcome` factor,
  and a non-effect `outcome` factor that neither requires nor forbids the
  mock's own declared choice to keep its helpers exported. It declares no
  `reasoning` factor: its artefact is code and both of its expectations are
  mechanically checkable.

Together the eighteen exercise every path through the three scripts above:
every phase, both judgment methods, a scenario that omits a phase entirely, one
that declares a single phase alone, a scenario whose mock is patched before a
probe or the offline check under `tests/repository/` ever sees it, a second mock
project, and — across the four writing-and-maintainability scenarios — an
artefact that is prose rather than code. Authoring further scenarios against
`inkwell`'s and `tsuzuri`'s remaining catalogued subjects, and against this
repository's other mocks, is separate, later work; this document describes what
runs today, not the coverage it will eventually have.
