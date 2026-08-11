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
so nothing a pull request does can start it or spend money. Four inputs, all
optional:

| Input          | Does                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------- |
| `case`         | Runs one case rather than the whole fixture                                               |
| `repeats`      | Overrides what a case declares                                                            |
| `pull_request` | Evaluates that pull request's changed skills in the bare probe mode, posts a report there |
| `dry_run`      | Rehearses every step with no probe spawned                                                |

A dispatch that names a pull request **records nothing** — it reports, because
what it measured is routing on the prompt alone, and that is not comparable
with a situated measurement. Every other dispatch lands its result through a
pull request of its own.

`npm test` re-derives every committed summary under `data/discovery-eval/` and
fails on a mismatch, confirms every skill the fixture names still exists, and
applies every declared case patch against its mock offline — deterministic
checks that never invoke the runner, so a fixture naming a renamed skill, or a
patch that stopped fitting its mock, rots in CI rather than only being
discovered mid-dispatch. See
[`tools/discovery-eval/README.md`](../../tools/discovery-eval/README.md) for
the two probe modes and how a verdict is reached, and
[`data/discovery-eval/README.md`](../../data/discovery-eval/README.md) for
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
[`tools/effect-eval/README.md`](../../tools/effect-eval/README.md) for the
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
a case has been measured its projection rests on the ceiling, which is
deliberately above what a probe should cost, so an early dispatch is priced
pessimistically on purpose.

## The Measurement Pull Request Is Checked by the Dispatch, Not by `merge-checks.yaml`

Both workflows open their landing pull request with `GITHUB_TOKEN`, which
GitHub does not fire other workflows on — so `merge-checks.yaml` never runs on
what a dispatch opens, by an explicit `paths-ignore` on `data/*/measurements/**`
and `data/*/summary.json` rather than by that platform accident alone. Nothing
is left unchecked by this: the dispatch itself runs the drift check, the
comparability checks, and `npm run check` before it commits, and the ordinary
gates run again against the merged tree once the measurement pull request
merges — so measurement data is exempt from blocking a pull request, not from
being checked.
