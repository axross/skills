# Discovery evaluation

This directory holds the data the skill-discovery evaluation runs on. The runner
itself lives in [`scripts/discovery-eval/`](../../scripts/discovery-eval).

Every other mechanical check in this repository measures **form** — frontmatter
shape, bullet syntax, link integrity, section anatomy. This one measures an
**outcome**: given a prompt, does discovery surface the right skills? The unit
under test is the always-resident `description`/`when_to_use` pair, the input is
a prompt, and the assertion is set membership — so no model judges another
model's prose.

## Running it

```bash
node scripts/discovery-eval/run.mjs --help
node scripts/discovery-eval/run.mjs --dry-run          # validate, no model call
node scripts/discovery-eval/run.mjs --only wf-checkout-layout --repeats 3
node scripts/discovery-eval/run.mjs --repeats 5 --emit-selection-snapshot
node scripts/discovery-eval/run.mjs --determinism --only hf-touch-targets
```

It drives the real `claude` CLI, so it needs the CLI on `PATH` and working
authentication. **A full run costs real money** — about **`$0.026`** a probe,
measured over a 100-probe run against the 19-skill corpus of the time. The rate
is the durable figure: a full fixture is one probe per case per repeat, so the
total moves whenever the fixture or `--repeats` does. **`--dry-run` prints the
current estimate, and is the number to trust over this paragraph.** Short runs
cost more per probe: the ~4,500-token discovery listing is identical every time,
so prompt caching only amortizes it once a run is long enough to reuse it. Use
`--only` and `--repeats` while iterating anyway; a handful of probes is still
cents.

`--dry-run` needs neither a network nor a secret: it validates the fixture and
the selection snapshot and prints what would run. That is the path `npm test` exercises.

## Running it in CI

Dispatch [`discovery-eval.yaml`](../../.github/workflows/discovery-eval.yaml)
from the Actions tab. Four inputs, all optional:

| Input                     | Effect                                                                                                                                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repeats`                 | Runs per case, **overriding whatever a case declares**. Leave blank — the normal case — to honour the fixture's own counts.                                                                                                                                      |
| `pull_request`            | A pull request number. Its changed `SKILL.md` files are evaluated, and the report is posted there as a comment. Leave blank to evaluate the default branch and read the report in the job log.                                                                   |
| `emit_selection_snapshot` | Also produce a proposed selection snapshot, downloadable from the run as the `proposed-selection-snapshot` artifact. Off by default. See [Re-recording it](#re-recording-it).                                                                                    |
| `determinism`             | A case id. Repeats **that one case** against an unchanged corpus and reports its stability instead of running the fixture. **30 repeats by default, overriding any per-case declaration**, and a `repeats` below 10 is refused. See [the probe](#--determinism). |

Two combinations are refused, and one is explicitly allowed.

**`emit_selection_snapshot` and `pull_request` cannot be combined**, and a dispatch
supplying both fails before it spawns a single probe. A run that names a pull
request overlays that pull request's head `SKILL.md` files, so the emitted
`corpus` would fingerprint text that exists on no branch — a document that looks
exactly like a committable selection snapshot and is not one. Refusing the combination is
cheaper than documenting the trap.

**`emit_selection_snapshot` and `determinism` cannot be combined either**, for a different
reason and from a separate step with its own message: a determinism run measures
one case, a selection snapshot is a fixture-wide document, and there is no partial
selection snapshot worth emitting.

**`determinism` and `pull_request` _can_ be combined.** Measuring how stably a
changed skill is selected, against that pull request's own head text, is a
reasonable thing to ask for — and it produces a report rather than a document,
so nothing committable is fingerprinted. The posted comment says which of the
two reports it carries.

**Manual dispatch is the only trigger.** There is no event a pull request can
raise that starts this — no `pull_request`, and deliberately no
`pull_request_target`. Dispatching requires write access, so a contributor
cannot start a run, cannot start one by editing the workflow in a pull request
(dispatch always runs the file from the default branch), and cannot start one
by getting a label applied. That is the primary bound on both the money this
spends and the untrusted text it reads.

The only operator prerequisite is the `CLAUDE_CODE_OAUTH_TOKEN` secret that
`claude-review.yaml` already uses. No new secret, and no label.

## It never gates

Not in `npm run check`, not in `merge-checks.yaml`, not a required check, not in
any hook. It is non-deterministic, it costs money per run, and it needs a secret
that fork pull requests do not receive — and a flaky merge gate gets bypassed or
deleted. It exits 0 whatever it finds; its output is a finding for a human.

`tests/repository/reporting-tools.test.mjs` asserts it appears in exactly one
workflow — its own — so wiring it into a gate breaks a test first. What `npm
test` _does_ check is this directory's two JSON files, which is a deterministic
data check with no model call: see [Why `npm test` reads these
files](#why-npm-test-reads-these-files).

## `fixture.json`

```jsonc
{
  "version": 1,
  "expectAlways": ["professional-behavior"],
  "cases": [
    {
      "id": "wf-checkout-layout",
      "prompt": "Sketch the layout and flow for a two-step checkout screen.",
      "mustInclude": ["wireframe-design"],
      "mustExclude": ["high-fidelity-ui-design"],
      "rationale": "Why those labels are the right ones.",
    },
  ],
}
```

| Field          | Meaning                                                               |
| -------------- | --------------------------------------------------------------------- |
| `mustInclude`  | Absent from every run ⇒ a **miss**. Remedy: widen the discovery text. |
| `mustExclude`  | Selected by most runs ⇒ **spurious**. Remedy: narrow it.              |
| `mayInclude`   | Legitimate either way. Never a finding.                               |
| `rationale`    | Required. A human must be able to disagree without reading code.      |
| `repeats`      | Optional. How many runs this case earns. See below.                   |
| `expectAlways` | Fixture-level. Skills claiming to apply universally.                  |

### `repeats` — spending probes where the answer is in doubt

Repeats buy **resolution**, and resolution is only worth buying where the rate
is intermediate. A `MISS` fires at zero hits and a `SPURIOUS` above half, so for
a case whose tracked skills sit at `0/5` or `5/5` the extra three probes cannot
change either verdict. Those cases declare `"repeats": 2` and the run costs
proportionally less.

**Two is the floor, and it is arithmetic rather than taste.** At one repeat a
single stray selection is `1/1` — clear of the above-half bar, reported as a
`SPURIOUS` finding on the evidence of one probe. At two it is `1/2`, which is
not _above_ half and reports as `occasional`. Two is the smallest count at which
both verdicts still demand unanimity. A declared `1` is refused.

A case earns the reduction only while it keeps deserving it. `npm test` fails
when a case declaring `repeats` is recorded anywhere but at an extreme, and also
when it is a **standing finding** — a result under active remediation is one we
expect to move, so cutting its repeats would cut the power to notice the fix
landing. So the override cannot outlive the evidence for it: the ways out are to
drop it or to re-measure at full repeats.

An explicitly passed `--repeats` **overrides every declaration**, which keeps
`--only <case> --repeats 10` doing the obvious thing while iterating. That is
also why the CI workflow's `repeats` input has no default — a default would mean
CI always passed the flag, and every declaration would be silently ignored in
the one place that actually spends money.

A skill named in no tier is reported as an _unlabelled selection_ —
informational, never a failure. A spurious trigger is only ever claimed where a
human explicitly labelled it wrong.

## How a verdict is reached

With `N` repeats and `hits` = the runs in which a skill was selected:

| Tier          | `hits == 0` | `0 < hits/N ≤ 0.5` | `hits/N > 0.5` |
| ------------- | ----------- | ------------------ | -------------- |
| `mustInclude` | **miss**    | weak               | clear          |
| `mustExclude` | clear       | occasional         | **spurious**   |

**The asymmetry is the design, not an oversight.** The pilot deliberately
targets skills that compete — `wireframe-design`, `high-fidelity-ui-design` and
`react-component-styling` each disclaim the others in their own discovery text.
A prompt both legitimately answer _splits_ the distribution, so a symmetric
majority rule would report correct behaviour as two misses, and would do so
worst exactly where the fixture is most informative. Requiring only that a
`mustInclude` skill appear **at least once** removes that failure; a minority
rate reports as `weak` instead.

For a case naming two or more `mustInclude` skills the report also prints
**coverage** — how many runs selected at least one of them. That is what tells
healthy contention from a real gap:

```text
coverage: 5/5 runs selected at least one of wireframe-design, high-fidelity-ui-design
coverage: 3/5 runs selected at least one of … — 2 selected none of them
```

## What a finding is measured against

A verdict alone cannot tell a marginal result from a broken one. `MISS` fires at
**zero** hits, so a case whose skill genuinely sits at `1/5` draws zero about a
third of the time and reports a finding indistinguishable from a real
regression. `SPURIOUS` has the sharper version of the same problem: it fires
above half, so a skill genuinely sitting at half fires it half the time.

So **both** findings carry the prior the selection snapshot recorded, and — where that
selection snapshot fingerprinted its corpus — `P`, the chance of a result at least this
extreme if the rate had not moved:

```text
  hf-touch-targets: high-fidelity-ui-design 0/5  (prior 1/5, P 27.3% — consistent with no change)
  si-neutral-consent-gate: software-instrumentation 0/5  (prior 5/5, P 0.2% — regression)
  hf-contrast-audit: wireframe-design 5/5  (prior 0/5, P 0.2% — regression)
  hf-contrast-audit: wireframe-design 3/5  (prior 0/5, P 6.1% — consistent with no change)
```

The last two are the case this exists for. Today they render identically; their
evidence differs by a factor of exactly **28**.

**The estimator is a posterior predictive tail, not `(1 − p̂)ⁿ`.** The point
estimate treats a rate measured from five samples as the truth, and at `p̂ = 1`
returns exactly `0%` — so a `2/2` prior would call two probes proof of
impossibility. Integrating over `Beta(h + 1, n₀ − h + 1)` counts the prior's own
sampling error, which is the whole difficulty when every prior comes from a
handful of probes. The 5% band is **not** a measured noise floor; it is a
benchmark, and [`--determinism`](#--determinism) is what will eventually measure
the real thing. Under a Jeffreys `Beta(0.5, 0.5)` prior instead, no verdict in
this fixture flips.

**A tally entry is always a prior; an absence is one only for a skill the run
tracked.** A selection snapshot records a zero-hit skill by omitting it, so an absence
means _measured, and zero_ for a skill in `mustInclude`, `mustExclude` or
`expectAlways` — and _nobody ever looked_ for anything else. `mayInclude` is
deliberately outside that set: those skills are never a finding, so a run has no
obligation to tally them, and reading their silence as a measured zero would
manufacture priors. A line with no prior prints an em dash, never a `0`:

```text
  hf-touch-targets: react-component-styling —/5 -> 2/5  (no prior: not tracked, and nothing recorded)
```

The inference stays sound only while, since the tally was recorded, **(a)** no
measured case has gained a `mustInclude`/`mustExclude` label and **(b)**
`expectAlways` has gained no skill. Both hold today. The second is the sharper
edge: an `expectAlways` addition changes the tracked set for **every** case at
once, where a per-case label changes one.

**A zero prior against a zero run is `standing`, not a probability** — and it
renders even with no corpus fingerprint, because it is a statement about counts:

```text
  boundary-hierarchy-and-css: high-fidelity-ui-design 0/5  (prior 0/5 — standing)
```

**Some prior/run pairs cannot clear the band at all.** The _resolvability floor_
is the smallest tail any attainable outcome could have produced. Where it sits
at or above 5%, every possible result would have read as "consistent with no
change", so the line says that outright rather than carrying a verdict that was
never in doubt:

```text
  rcs-css-module: react-component-styling 0/2  (prior 2/2, P 10.0% — cannot resolve at 2 repeats)
```

That is the cost of [`repeats`](#repeats--spending-probes-where-the-answer-is-in-doubt),
made visible. It can only ever replace `consistent with no change`, never a
finding: `floor ≤ P` holds by construction.

**Without a `corpus` fingerprint there is no `P` at all** — counts, and the
reason. That is the state this ships in, since the committed selection snapshot predates
fingerprinting:

```text
  hf-touch-targets: high-fidelity-ui-design 0/5  (prior 1/5 — no P: selection snapshot records no corpus)
```

The delta block reads the same priors through the same helper, so the two blocks
cannot disagree about one event. Below the band each uses its own word: a
finding is a `regression`, a delta line has `moved`.

## `--determinism`

Every probability above assumes a case's repeats are independent draws from a
fixed rate. **Nothing has ever measured that.** Probes run sequentially, in one
workspace, against a warm prompt cache, so they could be correlated in either
direction. `compare.mjs` has refused to choose tuned constants "before the
determinism probe has measured this corpus's noise floor" since it was written;
this is that probe.

```bash
node scripts/discovery-eval/run.mjs --determinism --only hf-touch-targets
```

It repeats **one** case — exactly one `--only` — against a single unchanged
workspace, and reports a 95% Wilson score interval plus a Wald–Wolfowitz runs
test over the probe-ordered sequence. The interval says how precisely the rate
is pinned; the runs test is the one that addresses the assumption, by asking
whether hits **cluster** in probe order, which is what a warm cache would cause.

It defaults to **30** repeats, overriding any per-case `repeats` declaration —
a case that earns 2 repeats for a settled verdict is exactly the kind whose
stability is worth measuring. An explicit `--repeats` still overrides both, and
fewer than 10 is refused: below that the runs test has no power. It refuses
`--emit-selection-snapshot`, it records nothing, and it exits 0 whatever it finds.

A row appears for every skill selected at least once, **plus** every skill the
case labels and every `expectAlways` skill — so a skill selected in none of the
probes still gets a line, which is the only way the report can say so. The runs
test reports three ways, and they are not interchangeable: a constant sequence
is **undefined** rather than extreme, and a non-constant one with fewer than ten
of either outcome keeps its expected count but has `Z` **withheld**, because
what fails there is the normal approximation rather than the statistic.

## `selection-snapshot.json`

Recorded output the report is expressed as a delta against, so a reader sees
what **moved** rather than a bare score:

```jsonc
{
  "recordedAt": "2026-07-29T14:32:07Z",
  "model": "claude-sonnet-5",
  "repeats": 5,
  "corpus": { "wireframe-design": "b17c4e2a8d61" },
  "cases": { "wf-checkout-layout": { "wireframe-design": 5 } },
}
```

`recordedAt` is a UTC instant to the second — exactly `YYYY-MM-DDTHH:MM:SSZ`,
and anything else is refused: a bare date, a local time with no zone, an offset
such as `+09:00`, a millisecond fraction, or a well-shaped impossible instant
like `2026-02-30T00:00:00Z`. Seconds rather than milliseconds because a run
takes minutes. **The value in this file, `2026-07-29T00:00:00Z`, is a
normalisation, not a measurement.** The selection snapshot it belongs to was recorded when
the runner emitted a bare `2026-07-29`, so its true time of day is unrecoverable;
midnight is a placeholder and nothing was measured at it.

`repeats` is the **default** a case ran at, and `caseRepeats` records the ones
that ran at something else — sparse, so a file where every case ran at the
default carries no such key. A delta compares each case against its own
denominator, so a case recorded `2/2` and now running `5/5` is the same rate and
reports no change.

The `model` field is the one this whole comparison hangs on. **A result is not
durable across models** — it moves when a new model ships, with no change to
this repository at all. When the observed model differs from the selection snapshot's, the
report suppresses the delta entirely and says so, rather than printing a
comparison that looks meaningful and is not. Deltas compare **rates**, so a
selection snapshot recorded at 5 repeats stays comparable against a 10-repeat run.

### What this selection snapshot already records

The most consequential result in this file is a negative one, and it is about a
skill of this library's own. `professional-behavior` — the fixture's sole
`expectAlways` entry, a skill whose `when_to_use` claims it applies to **every**
session — was selected in **none** of the recorded probes:

```bash
node -e '
const b = require("./evals/discovery/selection-snapshot.json");
const named = Object.values(b.cases).filter((t) => "professional-behavior" in t).length;
console.log("cases naming professional-behavior:", named);
'
# cases naming professional-behavior: 0
```

That command counts **tallies** rather than hits because a 0-hit skill is
recorded by being absent from a tally, never by a `0`:
[`renderSelectionSnapshot`](../../scripts/discovery-eval/report.mjs) writes a skill only
when `hits > 0`. The skill was tracked on every case regardless —
[`tallyCase`](../../scripts/discovery-eval/compare.mjs) unions `expectAlways`
into the names it tallies — so the absence is a measured zero rather than a
skill that was never tracked.

**What produced it.** `claude-sonnet-5`, at 5 repeats on each of the 28 measured
cases: 140 probes, and no selection in any of them.

**Why it is not a statement about today.** Two reasons, and re-reading the file
resolves neither. The tallies are not one run — they accreted across four
commits as new skills landed, against an installed corpus that grew from 22
skills to 25. And nothing records which version of `professional-behavior`'s own
discovery text the probes read: #111 rewrote both its `description` and its
`when_to_use` in the commit immediately before the first tallies landed, the
probes themselves ran on a branch, and this selection snapshot predates the
[`corpus`](#corpus--the-fingerprint-of-what-a-measurement-ran-against)
fingerprint that would have settled which side of that rewrite they fell on.
Only a re-record yields a live figure.

**It is not a verdict on the skill.** That rewrite kept the "apply in EVERY
session" claim, so the claim this result bears on is still being made — but the
text competing for selection is no longer the text that was measured, and
[`expectAlways` is informational](#known-limits) precisely because whether such
a claim can hold under a one-turn measurement is unsettled. The result is
recorded here; what to do about it is a question nothing measured so far can
close.

### `foreignSkills` — the skills the run could not isolate

The workspace holds exactly this repository's installed skills. **The CLI loads
more than that.** Whatever a machine carries at the user level, and whatever a
managed environment injects, competes in every probe — and
[`corpus`](#corpus--the-fingerprint-of-what-a-measurement-ran-against) cannot
see any of it, because it only ever fingerprinted what the runner installed.

Measured against the pinned CLI in a Claude Code cloud container, reading the
`system`/`init` event's `skills` array:

| Spawn                       | Skills loaded | Workspace corpus still reaches the model? |
| --------------------------- | ------------- | ----------------------------------------- |
| no flag                     | 24            | yes                                       |
| `--setting-sources project` | **18**        | **yes**                                   |
| `--setting-sources ''`      | 17            | no                                        |
| `--bare`                    | 15            | no                                        |

So the runner passes `--setting-sources project` on every probe, which strips
the six user-level skills for free. The seventeen that remain arrive from the
managed environment, and **every** switch that removes them removes the
workspace's own skills too — which measures nothing. Full isolation is not
reachable, so the run records what it could not isolate instead.

Each loaded name is sorted three ways, against the invocability of the skill of
ours it might match:

| Bucket      | Meaning                                              | Triggers a refusal? |
| ----------- | ---------------------------------------------------- | ------------------- |
| `own`       | matches one of ours carrying `user-invocable: true`  | no                  |
| `colliding` | matches one of ours carrying `user-invocable: false` | yes                 |
| `foreign`   | matches nothing of ours                              | yes                 |

**`colliding` is the loudest case, and the one a naive `loaded − corpus`
subtraction would have hidden.** A skill of ours that is `user-invocable: false`
can never appear in that array, so a loaded name matching it is something else
wearing its name — `code-review` really does collide in the cloud container.
`own` exists because this repository's authoring rules require
`user-invocable: true` on every workflow entry-point skill, and reporting such a
skill as foreign would refuse a selection snapshot on a completely clean run.

**The field is written on every re-record, `[]` included** — deliberately unlike
`corpus` and `caseRepeats`, which are omitted when empty. An empty corpus cannot
occur, so for those two absence unambiguously means "not recorded". Here `[]` is
a real state — _recorded, and nothing foreign loaded_ — that absence cannot
express, since a selection snapshot predating the field looks identical. Do not "fix" that
inconsistency; it is the distinction.

That `[]` can only ever mean a clean run **measured across every probe**, because
a run that could not measure its isolation everywhere refuses to emit a document
at all. Coverage is counted, not assumed: a run where even one probe failed to
report what the CLI loaded is a **partial**, and a partial refuses too. One probe
out of 145 seeing nothing foreign would otherwise write exactly the `[]` that 145
agreeing probes write — and the probes that went unreported are the ones that
could have differed. Without those refusals the field would quietly acquire two
further meanings it cannot signal.

**What this cannot see.** The init event lists **user-invocable skills only**, so
a foreign skill that is itself `user-invocable: false` is invisible, and no
signal in the stream can find it. The report says "user-invocable only" for that
reason. The runner also reads a skill's `user-invocable` value by **key presence
first, then value** — a present-but-empty `user-invocable:` is indistinguishable
by value from an absent key, and anything it cannot parse is treated as _not_
invocable, so an unreadable field produces a noisy false collision rather than a
silent clean bill of health.

### Re-recording it

Two routes, and **neither is a plain dispatch** — an ordinary run produces a
report and no selection-snapshot document at all.

**A run whose isolation does not hold refuses to emit one**, and there are three
ways for it not to hold. The obvious one is that the CLI loaded skills the
workspace did not install. The other two are quiet, and both look exactly like
success — nothing foreign was found, because nothing was looked at:

- **no probe reported a skill list at all**, so nothing could be checked — an
  older or different CLI;
- **only some probes reported**, so isolation holds for part of the run. This is
  the more convincing impostor: something _did_ report, so a check asking merely
  "did anything report?" waves it through, and one probe out of 145 writes the
  same `foreignSkills: []` as 145 agreeing probes.

All three refuse. When the CLI loaded skills the workspace did not install — see
[`foreignSkills`](#foreignskills--the-skills-the-run-could-not-isolate) — the
runner prints its report and then exits **3** without emitting a document. The
report is still worth having, and the probes are paid for either way; a
_selection snapshot_ is different, because its whole purpose is to be compared
against
later, so recording one against a corpus that was never the one measured is the
precise staleness `corpus` exists to prevent, arriving through a door that
fingerprint cannot watch. In CI the emitting job fails and uploads no artifact.
There is no override flag: if the CI runner itself turns out to be contaminated,
that is a finding to act on rather than a check to bypass.

Dispatch `discovery-eval.yaml` with **`emit_selection_snapshot` checked and no pull
request number**, then download the `proposed-selection-snapshot` artifact from the
finished run and commit it. This is the route that needs no local CLI and no
local credentials, and it is the one to reach for.

Or run it locally, if you have the CLI and working authentication:

```bash
node scripts/discovery-eval/run.mjs --repeats 5 --emit-selection-snapshot
```

That prints the proposed selection snapshot to **stdout**, after the report and after a
fixed marker line. The runner never writes the working tree either way: CI lifts
the document into an artifact with
[`extract-selection-snapshot.mjs`](../../scripts/discovery-eval/extract-selection-snapshot.mjs),
which validates it through the same `parseSelectionSnapshot` that reads the committed
file, so a bad slice fails the job instead of uploading something plausible.
**A human commits it deliberately** — nothing here pushes.

### `unmeasured` — a case that exists but has not been run

A fixture case and its measurement move on different schedules. A dispatch can
only ever evaluate the **default branch's** fixture, so a case cannot be
measured until after it lands — and `npm test` requires every case to be
accounted for. `unmeasured` is how a case says "recorded on purpose as not yet
run":

```jsonc
{
  "unmeasured": ["expo-deep-link-route"],
  "cases": { "wf-checkout-layout": { "wireframe-design": 5 } },
}
```

What it must not do is borrow `{}`. An empty tally means _measured, and
discovery selected nothing_ — a real finding
on <!-- count:empty-tally-cases -->three<!-- /count --> cases in this file, one
of them a standing `MISS`. Reusing that spelling for "never run" would make the
two indistinguishable in the one file a human reads before committing.

The declaration **clears itself**: a re-record measures every case in the
fixture it ran, so `--emit-selection-snapshot` emits a document with no `unmeasured` key
at all. Nobody has to remember to delete it. Until then the report says
`declared unmeasured, awaiting the next re-record`, which is deliberately not
the wording an undeclared absence gets.

### `corpus` — the fingerprint of what a measurement ran against

A result is not durable across a changed **corpus** either, for the reason under
[Known limits](#known-limits): every installed skill goes into the workspace, so
a skill added — or an existing skill's `description`/`when_to_use` rewritten —
competes for the same selection whether or not the fixture names it. `corpus`
records one short digest per skill over exactly those two frontmatter fields, so
the report can tell "this is the discovery text I measured" from "it is not"
without storing 22,000 characters of prose in a file a human reads before
committing.

The digest covers `description` and `when_to_use` and nothing else, which is the
same premise that keeps `references/*.md` out of the head overlay: those two
fields are all discovery reads. Editing a skill's **body** therefore does not
invalidate a selection snapshot. A rename shows up as one removal plus one addition.

**Corpus drift marks; it does not suppress.** A model mismatch kills the whole
delta because it is rare and total. A corpus change is frequent and partial —
this repository ships skill edits weekly — so the report instead names the
drifted skills once, in three buckets, and tags each affected comparison
`(unattributable)`:

```text
Corpus drift — the selection snapshot was recorded against a different skill corpus.
  added         expo-app-development, next-app-development
  text-changed  professional-behavior
  note          professional-behavior is an expectAlways skill, tracked on every case,
                so its text change degrades every comparison, not some.

  hf-touch-targets: high-fidelity-ui-design 1/5 -> 3/5  (P 19.7% — consistent with no change)  (unattributable)
```

The reading and the drift mark are separate parentheses on purpose. One says
what the number means; the other says whether it can be attributed to anything
in this repository at all.

Every case is marked, not a subset: the whole corpus is installed for every
probe, so there is no case the drift provably could not have touched. A skill
recorded in `corpus` that no longer exists is reported as a removal rather than
failing the run — unlike the same name in a `cases` tally, which is a hard
error. **When the corpus matches, the report says nothing at all**; a notice
that fires on every run is one that gets skipped on the run that matters.

The field is **optional**, because the selection snapshot in this tree predates it and
re-recording costs a full run's worth of probes. A selection snapshot carrying no `corpus`
reports as "corpus not recorded" — honestly weaker than "no drift" — and its
delta still renders.
`--dry-run` prints the same comparison, computed from `.claude/skills` with no
model call; a real run fingerprints the workspace it assembles, so a
`--head-skills` evaluation records the head text it actually measured.

## Why `npm test` reads these files

It validates both files' referential integrity — every skill name resolves to a
real skill — and never invokes the runner or makes a model call. That is the
same class of deterministic check as the installed-copy gate.

The rot it prevents has already happened twice here: `react-component-development`
was added, and `loop-engineering`'s references were split and then removed. A
**fixture** label naming a skill that no longer exists silently stops asserting
anything — the case still runs and still reports. A **selection snapshot** entry naming
one is worse: every later delta is computed against a skill that can never
appear, so the report keeps claiming a regression that is really a rename.

It also checks that every fixture case is **accounted for** — measured, or named
in `unmeasured` — and that nothing in `unmeasured` names a case the fixture no
longer defines. The second half is the same rot one field over: a declaration
left behind by a renamed case is a promise to measure something that cannot be
measured, and it would quietly widen what the first half forgives.

## Known limits

- **One turn per run.** The measurement captures what discovery selects
  immediately, so `N` repeats give a distribution rather than a co-selection
  set. The coverage line exists because of this.
- **The fixture is a judgment product.** A wrong label produces a "finding" that
  is really a labelling error. That is what `rationale` is for.
- **The corpus is always installed whole.** Even though only the design trio is
  labelled, every installed skill goes into the workspace — otherwise a spurious
  trigger from any other skill would be structurally invisible.
- **The workspace carries no `CLAUDE.md`.** This repository's own working
  agreement mandates <!-- count:mandated-skills -->three<!-- /count --> skills in
  every session; evaluating inside this checkout would measure that agreement
  instead of discovery, and would do so silently.
- **Repeats are assumed independent, not measured.** Every `P` above treats a
  case's probes as independent draws from a fixed rate. They run sequentially in
  one workspace against a warm prompt cache, so they may not be.
  [`--determinism`](#--determinism) is what measures it, and until it has been
  run the band is a benchmark rather than a noise floor.
- **The band is per line.** Among the lines that can fire it, roughly one clean
  line in twenty reads `regression` or `moved` by chance alone. Nothing here
  corrects for multiple comparisons.
- **A two-repeat case cannot resolve much, by construction.** The reduction to
  `"repeats": 2` buys a cheaper run at the cost of resolution, and the
  resolvability floor makes the size of that cost visible: against a `2/2` prior
  at 2 repeats the floor is `10.000%`, so **no outcome at all** could have
  cleared the 5% band and every line reads `cannot resolve at 2 repeats`. At 3
  repeats the floor is `5.000%` — exactly on the band — and only at 4 does it
  drop to `2.857%`. This is accepted rather than bought back: restoring the
  probes would undo the saving [`repeats`](#repeats--spending-probes-where-the-answer-is-in-doubt)
  exists for.
- **The band ships dormant.** No `P` renders against the selection snapshot in this tree,
  because it records no `corpus`. It activates on the first re-record that
  fingerprints one.
- **The workspace does not bound what the CLI loads.** A managed environment
  injects skills no flag can strip without stripping the workspace's own, so
  some runs measure a corpus wider than the one installed. What could not be
  isolated is recorded in
  [`foreignSkills`](#foreignskills--the-skills-the-run-could-not-isolate), and a
  contaminated run cannot emit a selection snapshot — but a foreign skill that is itself
  `user-invocable: false` stays invisible to that record.
- **`expectAlways` is informational for now.** `professional-behavior` claims in
  its own `when_to_use` that it applies to every session. Whether that holds
  under a one-turn measurement is an open question, so a shortfall is reported
  but not counted as a finding. It has already fallen short once, and the
  recorded result is written up under [What this selection snapshot already
  records](#what-this-selection-snapshot-already-records).
