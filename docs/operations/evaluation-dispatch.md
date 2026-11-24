---
type: Procedure
title: Evaluation Dispatch
description: How to admit, run, judge and compare measurements and inspect dispatch artifacts.
---

# Evaluation Dispatch

`probe.mjs`, `evaluate.mjs` and `derive.mjs` run by hand locally or through
`.github/workflows/evaluation-dispatch.yaml`, this repository's one dispatch
workflow. `compare.mjs` instead reads declared inputs through a standalone offline
CLI; the workflow does not call it. [Verification
Gates](../conventions/verification-gates.md) covers why the instrument reports
rather than gates; this document covers how to operate both routes.

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
   model. It installs the same pinned Claude Code CLI `probe` does and asks a
   reasoning factor's judge through it — the Anthropic Messages API this job
   used to call directly refuses a Claude Code OAuth token outright — so it
   authenticates with the same `CLAUDE_CODE_OAUTH_TOKEN` credential `probe`
   already holds. Without the secret set, `evaluate.mjs` still records each
   reasoning factor's result as an error carrying its reason rather than as
   `false`, so the cell still completes and still uploads what it judged.
4. **`land`** is the only job with `contents: write` and
   `pull-requests: write`, and the only one that receives no model
   credential at any step.
   It admits every supplied bundle against the dispatch contract before copying
   data into tracked measurements, and derives only measurements with every
   planned measured file and judgment available (a derivation that fails is
   reported rather than allowed to fail the job — a measurement whose
   judgment could not complete is still committed, with the pull request
   body saying its derived tier is absent, because the probes already cost
   money and are not re-acquired for free), runs this repository's own
   `npm run check` — which **does** fail the job, because a measurement
   that fails this repository's own gates is a defect in the instrument
   rather than a finding about a skill — commits under the `github-actions[bot]`
   identity, and opens the measurement pull request.
   `merge-checks.yaml` excludes that pull request by path (see
   [Verification Gates](../conventions/verification-gates.md)), which is why
   the checks run here instead of there.

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

### Artifact admission: `artifacts.mjs`

Each normal upload contains only `record.json`, a JSON data bundle whose
envelope carries repository, run, source commit, producer attempt, artifact
name and version. Its `files` array carries relative paths and verbatim UTF-8
content. A probe owns only its planned cell's four measured files; a judged
bundle owns only its scenario's planned `factors.json` files. Judged bundles
MUST NOT overlay measured bytes or other scenarios. Whole-tree uploads are
rejected because they erase ownership and collision evidence.

Downloads retain artifact-name directories in scratch (`merge-multiple: false`),
not in the repository. Admission MUST perform these steps in order:

1. Compare downloaded bundles with the independently supplied workflow context
   and plan-job matrices.
2. Validate all supplied bundles.
3. Copy selected content into fresh measurement directories.

Admission rejects unexpected entries (including empty nested directories), links, special
files, duplicate ownership, reused destinations, identity mismatches, malformed
consumed JSON and invalid declared-factor outcomes. Admission never executes
transcript text or applies patches. Empty patches, truncated transcripts,
failed probe exit codes, optional runtime fields and factor error objects remain
legitimate observations.

The landing report distinguishes missing artifacts from missing files in valid
bundles and lists factor errors separately. Valid nonempty subsets are `partial`,
retained without a summary for incomplete scenarios; entirely empty input fails
with nothing to land. `complete` means all planned material is available, not
that a probe succeeded or every factor returned a verdict. The generated
measurement PR includes those deficits and errors. Copy or report-write failure
fails the job; filesystem publication is not atomic and may need a fresh
checkout before retrying locally.

The transport selects the current workflow run, not arbitrary runs, but neither
that selection nor a matching envelope authenticates the producer. Source/run
consistency and content admission are not cryptographic provenance. The selected
action and artifact service remain trusted transport dependencies: validating
after download is not containment for arbitrary hostile ZIP extraction or a
compromised action. Fixed-basename uploads reduce the normal producer's archive
surface; payload paths stay inside inert JSON. Repository checks likewise do
not prove provenance. npm's content cache is not an executable `node_modules`
or evaluation-artifact trust boundary.

Earlier producer attempts from the same run/source remain admissible when only
`land` is retried; attempt metadata is descriptive, not forced to match the
landing attempt. Expired or unavailable artifacts are reported as missing,
never regenerated silently. Dispatches predating this bundle format require the
old matching workflow source; whole-tree artifacts are not accepted by the new
consumer.

The workflow supplies `GITHUB_REPOSITORY`, `GITHUB_RUN_ID`, `GITHUB_SHA`,
`GITHUB_RUN_ATTEMPT`, `PROBE_MATRIX` and `JUDGMENT_MATRIX`. Offline callers MUST
supply the expected identity and matrices independently, not read them out of a
bundle to bless that bundle. The selector is one exact matrix entry as JSON.

Keep `--report` outside planned measurement directories; the CLI rejects
overlaps before copying data. It also refuses report-path symlinks and special
files, including unsafe ancestors. Existing regular reports outside those
directories can be replaced, including a report alongside measurements under
the output root.

```bash
node tools/evaluation/artifacts.mjs pack-probe --input <probe-root> --out <bundle-dir>/record.json --selector '<cell-json>'
node tools/evaluation/artifacts.mjs pack-judged --input <scenario-root> --out <bundle-dir>/record.json --selector '<scenario-json>'
node tools/evaluation/artifacts.mjs admit --input <probe-downloads> --judged <judged-downloads> --out <measurement-root> --report <report.json>
node tools/evaluation/artifacts.mjs admit --input <probe-downloads> --out <scratch-root> --report <report.json> --scenario <id>
node tools/evaluation/artifacts.mjs --help
```

Packing refuses unexpected producer output rather than stripping it. Admission
exits 0 for valid complete or partial material, 1 for refusal or failed effects,
and 2 for bad invocation. Only complete report entries are eligible for the
workflow's summary step; standalone `derive.mjs` does not know the plan matrix.

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
`claude` CLI on the scenario's task. A probe is told in its own system
prompt that it runs unattended, and it runs until it finishes or until it
has produced 100 assistant turns, whichever comes first.

## What Bounds a Probe's Tool Surface

`tools/evaluation/src/probe-process.mjs` passes both `--allowed-tools` and
`--disallowed-tools`, and only the second of them bounds anything. The first
is **additive**: naming a tool the CLI defers surfaces it, naming one the
CLI does not have does nothing at all, and a name appearing in both lists is
denied. So `ALLOWED_TOOLS` — `Bash`, `Edit`, `Glob`, `Grep`, `Read`,
`Skill`, `Write` — is passed for one real effect, putting `Glob` and `Grep`
in front of a probe, and MUST NOT be read as the set of tools a probe holds.

`DISALLOWED_TOOLS` is the bound. A tool is denied when it delegates the
probe's work to another agent, when it reaches outside the probe workspace,
when it blocks waiting for a human the probe's own system prompt has
already said is not there, or — `NotebookEdit`'s own case — when no mock
ships anything for it to touch. `ToolSearch` is deliberately left reachable.

Everything else the CLI exposes is reachable by a probe and named by
neither list, which is the state a reader has to keep in mind: the
declarations state intent, and the record below states fact.

**Every probe records what the CLI reported, and the run says where the two
disagree.** `parseTranscript` reads the `system`/`init` event's own `tools`
array — the CLI's report of what that session held — and
`tools/evaluation/src/tool-surface.mjs` compares it against both
declarations. The result lands under `metadata.json`'s
`runtime.tools`, alongside the two declarations it was compared against, and
any non-empty disagreement is written to the run's standard error as a
warning naming the tools:

- an allowance the CLI did not surface — a name that allows nothing, which
  is what `TodoWrite` was until [#440](https://github.com/axross/skills/issues/440);
- a denial the CLI surfaced anyway — a bound that did not take;
- a surfaced tool neither list names.

A disagreement is reported, never enforced: it is a fact about the CLI a
probe ran under, and a probe that hits one still writes all four of its
files. A transcript carrying no `tools` array at all — an older CLI —
records `null` for both the reported surface and the comparison, which is
deliberately distinct from reporting an empty one.

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
replaces a cost estimate rather than tightening one: the deleted instrument
projected a dollar figure before a dispatch, and its projection was wrong
often enough that the limit it fed was not a limit, where a probe count is
exact before anything is spawned. `--limit` is optional; a run given none is
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
workspace. A `reasoning` factor asks the model its scenario names through the
`claude` CLI — the same route a probe's own model spawn uses, non-interactively,
with every tool denied and no setting sources loaded — and needs
`CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` set in the process's
environment; without either, that factor's own result is recorded as an
error — never as `false`, and never by aborting any other factor's
judgment — so the script still completes end to end with no credential
present at all, which is how this repository's own test suite exercises it.
Each probe's judged factors are written to its own `factors.json`. A reasoning
judge is asked through the CLI rather than over HTTP, and that route is part of
what makes two measurements comparable — see
[Skill Evaluation](../specs/skill-evaluation.md).

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

## Comparing declared treatments: `compare.mjs`

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

### Input contract

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
| Selection   | Boolean `invoked`; `timing`: `before-dependent-judgment`, `after-dependent-judgment`, `unknown`                                                                                                                                                                         |
| Acquisition | `availability`: `available`, `unavailable`, `unknown`; `route`: `native`, `direct`, `retained`, `parent-only`, `unknown`; `coverage`: `full`, `partial`, `mismatch`, `unavailable`, `unknown`; optional `delivery`: `current`, `stale`, `truncated`, `mixed`, `unknown` |
| Conformity  | No additional fields; the separately evidenced output verdict supplies this observation                                                                                                                                                                                 |
| Guards      | `decision`: `allow`, `refuse`, `unknown`; boolean/null `writeReached`, `writePrevented`, `writeOccurred`                                                                                                                                                                |

Selection with `invoked: false` MUST NOT carry known before/after timing,
regardless of status or applicability; contradictory inputs exit 1. Omitted,
null or `unknown` timing remain legal for non-invocation.

`writeReached` means the edit path reached the relevant prevention checkpoint,
not that the mutation occurred. A refusal without observed prevention cannot
pass the invalid-edit control. Contradictory write observations are rejected.
Unavailable acquisition is unsupported, not automatically a failed delivery.
The [synthetic comparison fixtures](../../tests/evaluation/helpers/treatment-fixture.mjs)
show complete input construction and separated reasoning evidence; they are
instrument controls, not executable natural tasks or host evidence.

### Reading the report

Inspect `qualification.deficits`, each cell's qualification, and each common
opportunity's qualification before interpreting `axes.*.effect`. Read `counts`,
`primaryComplete`, opportunity membership, observation provenance and guard scopes
alongside effects. The [comparison specification](../specs/treatment-comparison.md)
owns denominator, completeness, qualification and claim semantics.

Each guard scope's `reason` explains one instrument-qualification blocker or is
null when `instrumentQualified` is true. Read `liveReason` separately for the
permanent offline limitation; `liveQualified` is always false.

### Natural-task preparation

[Evaluation Study Preparation](./evaluation-study-preparation.md) provides the proposed fixtures, controls and scoring instructions for future trials.

#### Documentation-only preparation

See [Documentation-only preparation](./evaluation-study-preparation.md#documentation-only-preparation).

##### Actor-visible project fixture

See [Actor-visible project fixture](./evaluation-study-preparation.md#actor-visible-project-fixture).

##### Scorer-only phase controls

See [Scorer-only phase controls](./evaluation-study-preparation.md#scorer-only-phase-controls).

##### Scoring observations and future trials

See [Scoring observations and future trials](./evaluation-study-preparation.md#scoring-observations-and-future-trials).

#### Late-verification preparation

See [Late-verification preparation](./evaluation-study-preparation.md#late-verification-preparation).

##### Actor-visible TypeScript fixture

See [Actor-visible TypeScript fixture](./evaluation-study-preparation.md#actor-visible-typescript-fixture).

##### Separate simulated control harness

See [Separate simulated control harness](./evaluation-study-preparation.md#separate-simulated-control-harness).

##### Late-decision evidence and scoring

See [Late-decision evidence and scoring](./evaluation-study-preparation.md#late-decision-evidence-and-scoring).

## The Declared Scenario Set

Use the [scenario registry](./evaluation-scenarios.md) to find the task, target skill and mock project for a dispatch.
