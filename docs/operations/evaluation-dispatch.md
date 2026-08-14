# Evaluation Dispatch

Running the two evaluation instruments —
[skill discovery evaluation and skill effect evaluation](../specs/skill-evaluation.md) —
against this repository, and what each dispatch does before it spends
anything. [Verification Gates](../conventions/verification-gates.md) covers
why neither is a merge gate; this document covers how to run them.

## Dispatching the Discovery Evaluation

Run it in CI from the Actions tab by dispatching
[`discovery-eval.yaml`](../../.github/workflows/discovery-eval.yaml) — the
only workflow allowed to invoke it, and manual dispatch is its only trigger,
so nothing a pull request does can start it or spend money. Five inputs, all
optional:

| Input          | Does                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `case`         | Runs one case rather than the whole fixture                                                          |
| `repeats`      | Overrides what a case declares                                                                       |
| `pull_request` | Evaluates that pull request's changed skills in the bare probe mode, posts a report there            |
| `prompt`       | Overrides `case`'s declared prompt, evaluated exactly as declared, uploads an artifact. Needs `case` |
| `dry_run`      | Rehearses every step with no probe spawned                                                           |

A dispatch that names a pull request **records nothing** — it reports, because
what it measured is routing on the prompt alone, and that is not comparable
with a situated measurement. A dispatch that names a `prompt` **records
nothing either** — see "Overriding a Case's Prompt" below. `pull_request` and
`prompt` are refused together, before any probe spawns: they are two
different threat models (untrusted head text vs. a maintainer's own text) and
two different workspaces (forced bare vs. exactly what the case declares).
Every other dispatch lands its result through a pull request of its own.

## Overriding a Case's Prompt

`prompt` reruns a declared case against different wording, without declaring
a second case for it — the case's `mock`, `patch`,
`mustInclude`/`mustExclude`/`mayInclude` tiers, repeat count and corpus stay
exactly what the fixture declares, so the prompt is the only variable. It
exists because declaring a near-duplicate case to test a wording collides
with the coverage invariant in
[`tools/evaluation/data/discovery/README.md`](../../tools/evaluation/data/discovery/README.md) — no
skill named by more than two cases — and a twin case is exactly the
near-duplicate shape that invariant removes.

**It overrides one case, and a dispatch that names no `case` is refused.**
Every case's tiers belong to a different skill, so substituting one wording
into all of them measures nothing — it would just fan a single reworded
question across the whole corpus at full price. Admission is the only place
that can catch this, because it is the only place the matrix widens, and it
refuses before any probe spawns.

It never records. `evaluate.mjs --prompt` refuses `--out` outright, the same
way `--head-skills` does (see
[`tools/evaluation/readings/discovery/README.md`](../../tools/evaluation/readings/discovery/README.md)),
and the dispatch uploads what it measured as an artifact — every probe's
`metadata.json` and `transcript.jsonl`, retained 30 days rather than the head
report's 1, because this is the only copy either file will ever have. It
opens no pull request and cannot reach the landing job.

**The use rule, stated before the mechanism existed so it binds before the
first dispatch:**

> A declared prompt may be revised to remove accidental ambiguity, phrasing no
> real person would use, or a mismatch with the mock it runs against. It may
> **not** be revised to move it toward a skill's `description` wording. A
> prompt override exists to find out which of those a case suffers from — not
> to make a case pass.

**The comparability brake.** A case's prompt is part of the cross-measurement
comparability key — `findComparablePredecessor`'s `predecessorMismatches` in
[`tools/evaluation/readings/discovery/src/summary.mjs`](../../tools/evaluation/readings/discovery/src/summary.mjs)
compares `case.prompt` between a new measurement and its most recent
predecessor — so revising a _committed_ prompt orphans every measurement that
case already has: none of them shares the new prompt, so none of them is a
comparable predecessor any longer. Prompt churn costs measurement history,
and that cost is why revising a committed prompt stays rare regardless of
what an override run finds. A positive result from an override — wording
closer to a skill's `description` genuinely changes the outcome — is
knowledge about the model's routing; it is not, by itself, authorization to
edit the fixture. Any prompt worth keeping becomes a declared prompt through
an ordinary reviewed change, and is measured normally after that.

Admission binds an override run exactly as it binds any other: projecting
from the case's committed measurements where they exist, and from the
fixture's declared per-mode ceiling where they do not — the same projection
any case's first run gets, override or not.

`npm test` re-derives every committed summary under `tools/evaluation/data/discovery/` and
fails on a mismatch, confirms every skill the fixture names still exists, and
applies every declared case patch against its mock offline — deterministic
checks that never invoke the runner, so a fixture naming a renamed skill, or a
patch that stopped fitting its mock, rots in CI rather than only being
discovered mid-dispatch. See
[`tools/evaluation/readings/discovery/README.md`](../../tools/evaluation/readings/discovery/README.md) for
the two probe modes and how a verdict is reached, and
[`tools/evaluation/data/discovery/README.md`](../../tools/evaluation/data/discovery/README.md) for
what a measurement holds.

## Dispatching the Effect Evaluation

Run it in CI from the Actions tab by dispatching
[`effect-eval.yaml`](../../.github/workflows/effect-eval.yaml) — manual
dispatch is likewise its only trigger. It takes one required input, `case`
(the evaluation case id), and two optional ones: `dry-run` rehearses the whole
dispatch with no model spawned and nothing billed, and `cap_usd` lowers that
case's declared budget cap for this dispatch only — it cannot raise it, since
raising a cap is a spending decision that belongs to a human editing the
reviewed fixture rather than to a dispatch input.

A dispatch runs one case as a two-dimensional matrix — every condition times
every repetition — admits, probes, and lands the result through a pull
request in one pass. See
[`tools/evaluation/readings/effect/README.md`](../../tools/evaluation/readings/effect/README.md) for the
three entry points behind that (`setup.mjs`, `evaluate.mjs`, `summarize.mjs`)
and what makes two measurements comparable.

## Admission Binds Before the Fan-Out

Both instruments bind their spending by refusal rather than by exhaustion.
Admission runs once, before any probe, and projects the dispatch's cost from
committed measurements where they exist and from the fixture's declared
per-probe ceiling where they do not — a ceiling per probe mode on the
discovery side, since a situated probe and a bare one cost about an order of
magnitude apart. A projection over the cap refuses the run and nothing
downstream runs, so a dispatch that does not fit its cap costs nothing. Until
a case has been measured its projection rests on the ceiling, which is meant
to be declared above what a probe should cost, so an early dispatch is priced
pessimistically on purpose.

**That is the direction a ceiling is declared in, not a property admission can
enforce.** Nothing checks a declared ceiling against reality until a
measurement arrives to supersede it, so a ceiling set too low prices an early
dispatch optimistically and admits a run that should have been refused. The
discovery fixture's bare ceiling was in exactly that state for the whole run
that first measured it — `0.05` declared against $0.0770 measured, recorded
in [`tools/evaluation/data/discovery/README.md`](../../tools/evaluation/data/discovery/README.md).
Read a ceiling as an unverified declaration by whoever wrote it, and check it
against the first measurement that supersedes it.

## The Measurement Pull Request Is Checked by the Dispatch, Not by `merge-checks.yaml`

Both workflows open their landing pull request with `GITHUB_TOKEN`, which
GitHub does not fire other workflows on — so `merge-checks.yaml` never runs on
what a dispatch opens, by an explicit `paths-ignore` on
`tools/evaluation/data/*/measurements/**` and
`tools/evaluation/data/*/summary.json` rather than by that platform accident
alone. Nothing is left unchecked by this: the dispatch itself runs the drift check, the
comparability checks, and `npm run check` before it commits, and the ordinary
gates run again against the merged tree once the measurement pull request
merges — so measurement data is exempt from blocking a pull request, not from
being checked.
