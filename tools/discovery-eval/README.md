# Skill discovery evaluation — the instrument

Measures whether a prompt actually surfaces the right skill, **in situ**: each
case is asked inside a materialized mock project, with the whole skill corpus
competing and the project's own `AGENTS.md` present. It measures; it never
judges. The measurements it writes live in
[`data/discovery-eval/`](../../data/discovery-eval/README.md).

## It never gates

Not in `npm run check`, not in `merge-checks.yaml`, not a required check, not
in any hook. It is non-deterministic, it costs real money per run, and — for
head evaluation — it needs a secret that fork pull requests do not receive.
`tests/repository/reporting-tools.test.mjs` keeps it out of the enforced set
on purpose, so wiring it in has to be a deliberate act.

What `npm test` _does_ run is the drift check over
[`data/discovery-eval/`](../../data/discovery-eval/README.md) — a
deterministic re-derivation from committed files, offline, with no model
call. That is a check on the instrument's own bookkeeping, not on a
measurement's verdict, and it is the one thing here that can legitimately
fail a merge.

## Two entry points, one process each

```sh
node tools/discovery-eval/evaluate.mjs  --case <id> --out <dir> [--repeats <n>] [--dry-run]
node tools/discovery-eval/evaluate.mjs  --case <id> --head-skills <dir> [--head-sha <sha>]
node tools/discovery-eval/summarize.mjs [--check]
```

| Command         | Does                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evaluate.mjs`  | Resolves one case, prepares its probe workspace, runs its declared repeats serially, writes one probe record per repeat.                                               |
| `summarize.mjs` | Derives the per-measurement and repository-wide summaries, the delta against each measurement's predecessor, and enforces the within-measurement comparability checks. |

Two, not three. `tools/effect-eval` splits `setup.mjs` from `evaluate.mjs`
because its probes fan out across separate runners under two conditions.
Discovery has one condition, so preparing a case's workspace and probing it
happen in one process — a case's repeats run serially against the one
workspace they share, which is what keeps a warm cache from being paid for
twice. `summarize.mjs` stays separate because its derivation has two
independent callers: the landing job (a later part of this issue), which
derives after a dispatch finishes and before it commits, and the drift check,
which re-derives a _committed_ summary and compares bytes.

## Two probe modes, and a single dispatch may not mix them

|                    | situated                                                                        | bare                                                          |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| workspace          | a materialized mock, the whole skill corpus installed                           | a scratch directory holding `.claude/skills` and nothing else |
| turns              | a runaway guard (`src/plan.mjs`'s `PROVISIONAL_SITUATED_TURN_CAP`, provisional) | 2 (`src/plan.mjs`'s `BARE_TURN_CAP`)                          |
| tools permitted    | `Read`, `Glob`, `Grep`, `Skill`                                                 | `Skill` (`ToolSearch` denied — see below)                     |
| may hold head text | no                                                                              | yes                                                           |
| recorded           | yes                                                                             | yes, except under `--head-skills`                             |

**Why bare's cap is 2, not 1.** Measured turn accounting from a real dispatch:
a probe that calls any tool — `Skill` included — reports `num_turns: 2` and
terminates `error_max_turns`; a probe that calls nothing reports `num_turns: 1`
and terminates `success`. Under a 1-turn cap, the only bare outcome that could
ever read as `success` was one where the model selected nothing — a bare probe
that _did_ select a skill was truncated by construction, before it could ever
report cleanly. Raising the cap by exactly one turn lets a single `Skill` call
finish; it is not a budget for a second, unrelated tool call.

**Why `ToolSearch` is denied.** `allowedTools: ["Skill"]` alone did not keep it
out: measured records show bare probes spending their entire turn cap on a
`ToolSearch` call instead of `Skill`, burning the cap on a tool this evaluation
was never meant to expose. `src/spawn.mjs`'s `BARE_DISALLOWED_TOOLS` now names
it explicitly. **That the CLI honours it is measured, not assumed**: the six
bare cases were re-run under this denial and not one probe called `ToolSearch`,
against three of twelve in the round before it — and the case whose two probes
had both spent their only turn on it selected a skill instead. The mechanism is
the installed CLI's own tool-search gate, which reads a tool named `ToolSearch`
off the set it was actually given and logs "may have been disallowed via
disallowedTools" once that name is absent. Both rounds are recorded in
[`data/discovery-eval/README.md`](../../data/discovery-eval/README.md).

A case declaring a `mock` runs situated; a case declaring none runs bare,
because situating would remove the very thing its prompt is about (a mock
project deliberately holds no `SKILL.md` files, so a case about authoring one
has nothing to read once situated). A situated workspace never runs
`npm ci` — the editing and shell tools are always denied, so nothing a probe
does can depend on a dependency being installed.

**`--head-skills` forces bare mode and refuses to record.** Staging a pull
request's head `SKILL.md` text as prompt content is safe only because the
model that reads it can then do nothing filesystem-shaped — a bare workspace
holds no project and permits only `Skill`. A situated workspace holds exactly
the capability (`Read`/`Glob`/`Grep` over a real project) that bound removes,
so the two may never meet in one dispatch: a case declaring a `mock` runs bare
under `--head-skills` regardless, and combining `--head-skills` with `--out` —
a request to persist the run as a case measurement — is refused with a
non-zero exit rather than documented as a caution. It reports to a caller
(stdout, and eventually a pull request comment); it records nothing.

## The fingerprint covers `description` only

Discovery reads one frontmatter field — `description` — so
[`src/fingerprint.mjs`](./src/fingerprint.mjs) digests only that, per skill,
rather than a skill's whole installed tree the way
[`tools/effect-eval/src/fingerprint.mjs`](../effect-eval/src/fingerprint.mjs)
does for its own question. A skill's body can change without invalidating a
discovery measurement, because the body is not what selects it. The project
tree digest _does_ follow the effect side's shape — `sha256` over sorted
`path\0mode\0sha256(content)` lines, `.git/`, `node_modules/` and
`.claude/skills/` excluded — because nothing about what makes two project
trees comparable is specific to either evaluation.

## The per-probe signal set

[`src/signals.mjs`](./src/signals.mjs) reads a transcript deterministically —
no model judges anything — and reports each probe's turn count, the CLI's
terminal reason (`success` or `error_max_turns`), and the paths it read,
globbed or grepped **before** its first `Skill` selection. That is what lets a
reader tell a finding from a failed exploration: two probes that both miss a
`mustInclude` skill read very differently if one read straight to the file
that names the defect and the other read only `README.md`.

A probe terminating on `error_max_turns` **with no `Skill` call recorded** is
marked **unreadable**, not counted as a selection of nothing — the runaway
guard binding means the model was still working when the CLI cut it off, and
`selectedSkills` is `null` on that probe rather than `[]`. A probe terminating
on `error_max_turns` **having already selected a skill** is instead marked
**readable**, carrying the selection(s) it made: the decision was already on
the tape before the cap fired, so discarding it would be data loss, not
caution — this is what makes a bare probe's raised turn cap (above) legible at
all, since under the old 1-turn cap a bare selection could never be anything
but truncated. `src/summary.mjs`'s verdict tally excludes an unreadable probe
from both the numerator and the denominator of every rate it computes; a
readable `error_max_turns` probe's selection counts exactly as a `success`
probe's would.

## Comparability has two scopes

**Within one measurement** — `src/summary.mjs`'s `runComparabilityChecks` —
probes that ran under different conditions (a different project tree, a
different installed corpus, a different loaded skill set) are not a
measurement of anything. A failure here is a hard finding: `comparable` goes
`false`, named with the disagreement, and a later landing job refuses to
commit the measurement.

**Across measurements of the same case** — `findComparablePredecessor` /
`deriveDelta` — a new measurement looks back through that case's other
committed measurements for the most recent one sharing the same prompt, the
same model, the same project tree, the same `runtime` (the CLI's name and
version, and the `maxTurns`/`allowedTools`/`disallowedTools` a probe actually
ran under), and the same `description` digest **for the skills that case
tracks** (its `mustInclude` and `mustExclude` union, not its whole corpus).
Editing an unrelated skill's description no longer degrades a case that never
tracked it. The `runtime` comparison matters most whenever this instrument's
own probe configuration changes — raising bare's turn cap is the case in
point: a bare measurement taken before that change and one taken after it must
never be judged comparable, or the cap's own effect would be silently
attributed to a skill. Where no comparable predecessor exists, the delta
reports the condition that failed — the most recent prior's specific
mismatch, or "no prior measurement of this case exists yet" — rather than
suppressing the comparison or leaving it absent.

## Verdicts, unchanged

`MISS` at zero hits and `SPURIOUS` above half carry over unchanged from
the instrument this one replaces, whose asymmetric rule holds: a `mustInclude`
skill selected even once is demonstrably reachable, so only zero hits is a
miss; a `mustExclude` skill is a defect only once it clears half the readable
repeats, so one stray selection is never reported as one. The coverage line
for a case naming two or more `mustInclude` skills carries over with them.
Both are derived at summarize time from stored counts, never stored
themselves — revising either rule is a re-derivation over data already paid
for.

**Zero hits is not the same condition as zero readable probes.** A case whose
every probe was unreadable has produced no evidence about any tracked skill,
so `src/summary.mjs`'s `verdictFor` answers `repeats === 0` before it ever
reaches the `mustInclude`/`mustExclude` rule above, returning a distinct
`unevidenced` verdict rather than `miss`. `unevidenced` is deliberately not a
finding — it is a claim about the probes, not the skill — so it never appears
in a case's `findings`; a reader looking for it instead checks the
measurement's `readableCount` (or the tally's own `repeats`), which is never
absent, so the condition surfaces rather than reading as a silent "fine".

`expectAlways` does not return. The one skill it named is a mandated skill,
and the fixture's `population: "mandated"` cases now ask that question on
their own, reported separately from the `discovered` population so no
headline number mixes wiring with routing.

## What does not carry over

The posterior-predictive band, the 5% benchmark, a `--determinism` mode, and
snapshot emission. The replaced instrument refused to choose those constants
"before the determinism probe has measured this corpus's noise floor" since
it was written, and that probe never ran. Because every probe's transcript is
stored verbatim, a determinism question is a derivation over committed
records rather than a second dispatch mode — measure one case at high
repeats, then compute the interval offline from data already paid for.

## The path allowlist and the credential filter

[`src/head-overlay.mjs`](./src/head-overlay.mjs) carries
the replaced instrument's allowlist over whole: only
`.agents/skills/<kebab-name>/SKILL.md` may be staged, traversal and absolute
paths and backslashes are rejected, size is capped in bytes (matching
`check-skill-frontmatter.mjs`'s own cap on `description`), and every
destination is derived from the diff path rather than from any `name:` field
inside the head file. Read that module closely — it is a security boundary
and its reasoning is in its own comments.

The credential filter travels with it through
[`tools/lib/credentials.mjs`](../lib/credentials.mjs): `src/spawn.mjs`'s
`runProbe` strips the subprocess environment for every probe, bare, situated
and head alike, and `evaluate.mjs` redacts every transcript by value before
writing it, refusing rather than writing anything a credential shape survives.

## Running it without spending anything

`evaluate.mjs --dry-run` materializes a real workspace (offline — no
`npm ci`, no network), takes a real fingerprint, builds the real argv per
repeat, and writes each probe record with a synthetic transcript, spawning
nothing. Run with no `--case`, `--dry-run` instead previews every case in the
fixture — mode, tools, turns and the projected admission decision — without
materializing anything. Every bundled test stays on one of these two paths:
nothing in `tests/discovery-eval/` spawns the CLI or reaches the network.

## Admission binds by refusal, before the spend

[`src/admission.mjs`](./src/admission.mjs) mirrors the effect side's:
projecting from committed measurements where they exist and from the
fixture's `unmeasuredProbeCostCeilingUsd` where they do not, and refusing a
real run before any probe is spawned rather than after. A refusal is a
finding, not a prompt to raise the cap. See
[`data/discovery-eval/README.md`](../../data/discovery-eval/README.md) for
`capUsd` and `unmeasuredProbeCostCeilingUsd`'s full contract.

**The ceiling is per probe mode, not one figure** — `{ "situated": 0.35,
"bare": 0.05 }` — because the two probe shapes cost roughly an order of
magnitude apart: a situated probe explores a real project across a runaway
turn guard, a bare probe is two turns with only `Skill` permitted. Both
[`src/admission.mjs`](./src/admission.mjs)'s `ceilingFor` and `admitCase` and
[`.github/scripts/discovery-eval-admit.mjs`](../../.github/scripts/discovery-eval-admit.mjs)'s
fixture-wide check project each case at the ceiling for **the mode that
dispatch will actually run it in** ([`src/plan.mjs`](./src/plan.mjs)'s
`planFor`), never the mode the case merely declares — a case declaring a
`mock` runs bare under `--head-skills` regardless, and is projected at the
bare figure. Superseding a ceiling with a committed measurement is per mode
too: a situated measurement never becomes the projection for a bare case, and
a bare measurement never becomes the projection for a situated one — see
`historicalCostsFor` in both `evaluate.mjs` and
`discovery-eval-admit.mjs`, which filter a case's history to the mode being
projected before it ever reaches `admitCase`.

## What `tools/lib` holds, and what stays here

`tools/lib/credentials.mjs`, `tools/lib/mock-workspace.mjs` and
`tools/lib/transcript/` are shared because they are shaped by the operating
system, the CLI's `stream-json` format, and materializing a mock project —
none of which either evaluation owns. The own/colliding/foreign loaded-skill
classification (`src/isolation.mjs`) does **not** move there: the effect side
reads `loadedSkills` only to assert set equality across probes and never
asks whether a name is own, foreign or colliding, so a second consumer
proved nothing about that classification being shared. Cross-measurement
comparability likewise stays here — discovery is its first and only consumer.
