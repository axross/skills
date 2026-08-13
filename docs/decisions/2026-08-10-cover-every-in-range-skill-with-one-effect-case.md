---
status: accepted
---

# Cover every in-range skill with one effect case, plus a negative control

## Context

The skill effect fixture held one case — `unit-testing` against `tsuzuri` —
which [#290](https://github.com/axross/skills/pull/290) landed as a pilot. The
epic that depends on this axis defers adopting an LLM judge until the
**residue** has been measured: the part of a skill's effect a deterministic
reading of the transcript and diff cannot reach. One case cannot size that
residue, and it is the worst possible sample for trying: `unit-testing` is the
corpus's most mechanically-readable skill, so a reading built to catch its
effect looks complete for exactly the wrong reason.

The discovery axis solved the identical problem the same way, and the
reasoning transfers directly.
`2026-08-10-cover-every-skill-with-at-most-two-discovery-cases.md`
records that its own fixture started as a pilot concentrated on three
competing skills, that rebuilding it re-expressed every case without
re-asking the coverage question, and that the imbalance was only visible once
cases were counted per skill. The effect fixture was in that same pre-rebuild
state, at n=1.

The effect axis carries a bound the discovery axis does not.
`docs/specs/skill-evaluation.md`'s "The effect
axis cannot observe every skill" names three groups a mock-and-task probe has
nothing to measure: a skill whose surface is not the working tree, a skill
whose effect is a judgement rather than an artifact, and a skill needing a
stack no mock installs. "Cover every skill" is therefore the wrong target
here — an out-of-range skill's two conditions agree by construction, which
reads exactly like a skill that changed nothing, and the correct reading is
that the question was never put rather than settled.

## The decision

**One case per in-range skill, and one negative control.**
`tools/evaluation/data/effect/coverage.md` enumerates the out-of-range skills under the spec's three groups; every other installed skill gets exactly one case in `tools/evaluation/data/effect/fixture.json`, and one more case beyond that is a declared negative control — bringing the fixture to <!-- count:effect-eval-case-count -->twenty-one<!-- /count --> cases in total.

The case set is written to span the spectrum a residue-sizing measurement
needs, not just to name every skill once. The mechanical end — `unit-testing`,
`tanstack-query-development`, an `invalidateQueries` call that either appears
in a diff or does not — is where a deterministic reading is expected to catch
nearly everything. The judgeable end — `code-maintainability`,
`technical-document-authoring`, whether a rollback runbook actually reads
clearly at 2am — is where it is expected to catch almost nothing. Every case
carries a written `prediction` stating which end it sits nearer, in prose,
because that is what lets a later measurement falsify the claim rather than
merely illustrate it.

**The control is drawn from the not-the-working-tree group, not the other
two.** Its skill is `github-operation`, hosted on an ordinary in-tree task on
`tsuzuri` with nothing GitHub-shaped about it. A materialized mock has no
remote, no issue, and no pull request, so installing the skill hands the model
nothing extra to act on and the two conditions are expected to be
indistinguishable — which is the axis's only measurement of its own noise
floor: how large a difference between two runs has to be before it can be
attributed to a skill at all, rather than to ordinary run-to-run variance. Not
the judgement-rather-than-artifact group: a null result there is exactly the
result the LLM judge decision would exist to overturn, so treating it as a
known-null control would assume the answer this fixture is trying to leave
open. Not the contingent stack group either: a skill out of range only for
want of a mock stops being out of range the moment somebody adds one, which
would make the control's own premise expire out from under it.

**A case whose prompt is symptom-shaped and whose mock ships that part sound
declares a patch.** Three do:
`fix-a-minified-production-stack-trace`
flips a `sourcemap` option the same way the discovery fixture's own patch of
the same shape does;
`remove-config-options-the-test-runner-ignores`
adds a `deps.optimizer` block Vitest 4 no longer reads; and
`migrate-a-card-id-helper-to-an-esm-only-package`
switches `recall`'s hand-rolled card-id generator for an ESM-only package,
which is the one patch here that also touches `package.json` and
`package-lock.json` rather than only source and config — the honest cost of
reproducing "a dependency that breaks the suite's transform" without
inventing a defect the project would not otherwise have. Every other case uses
a gap the mock genuinely has, several of them already named in
`tools/evaluation/mocks/README.md`'s own "choices made for coverage"
lists; no mock is modified by this change.

## What was rejected

**Bundling several skills into one case**, to cut the probe count. Rejected:
a case installing more than one skill attributes its effect to the set, and
the residue reading this fixture exists to enable gets harder rather than
cheaper to do.

**Sampling only the mechanical and judgeable ends and recording the middle as
"in range, not yet covered."** Rejected: it contradicts the criterion that
every installed skill is either named by a case or recorded out of range, and
it invents a fourth category whose only content is a budget running out.

**A machine-readable reach band beside the prose prediction**, so "the set
spans both ends" could be checked mechanically. Rejected as a second thing to
keep true rather than one; the residual risk is recorded below rather than
solved by adding structure nothing yet needs.

**The enumeration as structured data inside `fixture.json`**, rather than the
standalone `coverage.md` it is. Rejected in favor of the Markdown file: the
completeness check still has teeth, because it parses the Markdown rather than
trusting it.

**Wiring `extractArtifact` into the derived layer as part of this change.**
Rejected: it would move `tools/evaluation/data/effect/summary.json`, and there is no case
yet whose reading it would improve — of the whole fixture, only one case is
"add tests to a module". `extractArtifact`'s two defaults are gone and both inputs
are now required rather than assumed, but connecting it to what
`summarize.mjs` derives is the judge decision's business, once there is data
saying a per-case extractor buys something a common reading does not.

**Adding the cases without touching `extractArtifact`'s defaults**, letting
every new case inherit the unit-testing reading. Rejected: it would report
import specifiers and assertion counts for a case about naming or layout,
which is a wrong signal rather than a weak one, and a wrong signal hides the
residue where a missing one at least shows it.

**Waiting for the judge decision, then building the cases it needs.**
Rejected as circular: that decision's stated precondition is this
measurement, so building the cases afterwards means deciding without them.

**Measuring the noise floor by repeating the existing `unit-testing` case.**
Rejected: running a skill against itself measures variance where a real
effect is also present, and the two cannot be told apart.

**Skipping the negative control and arguing the null from the spec's own
prose instead.** Rejected by the maintainer on the filed issue: the argument
costs nothing to write and leaves the axis with no measured floor at all.

## What it costs

No dollar total is stated here on purpose — `node tools/evaluation/effect/evaluate.mjs
--dry-run` prints the current per-case and whole-fixture projection over the
committed fixture, and that command is the number to trust rather than a
figure that could go stale beside it. Every case's `capUsd` and
`unmeasuredProbeCostCeilingUsd` admit that case on its own before any of it is
measured; nothing here is dispatched or billed by this change.

## Consequences

**A future re-measurement of the existing `unit-testing` case records a `task`
of a different shape from [#290](https://github.com/axross/skills/pull/290)'s.**
That measurement recorded `{ prompt, targetModule }`; a case with no
case-specific `reading` now declares `task: { prompt }` alone, and the module
a unit-testing case targets moved under its own `reading` block. Nothing in
the instrument compares `task` across measurements — `runComparabilityChecks`
compares only within one case's own probes — but a human comparing the two
records side by side will see the difference, which is why it is stated here
rather than left to be rediscovered.

**Nothing mechanically holds the case set to actually spanning both ends of
the spectrum.** The prediction is prose, by the decision recorded at the
plan-approval interview, and no check reads it for content. A later edit that
quietly removed every judgeable-end case would leave the fixture measuring
what the filed issue called "the one case selected, by construction, to make a
deterministic reading look sufficient" all over again, and nothing here would
fail. Holding that property is a reviewer's job when a case is added or
removed, not a checker's.

**The mocks are used unevenly, and that is expected**, the same way the
discovery fixture's rebuild found. `inkwell` carries the widest stack of the
three mocks — a Vite SPA, a Hono API, Drizzle, TanStack Query, Sentry,
Amplitude, Vitest — and hosts the most cases of the three for exactly that
reason; `recall`'s narrower Expo stack hosts the fewest. A mock is a genuine
project rather than a per-case fixture, so one stack carrying more of the
fixture than another is the ordinary state rather than an imbalance to
correct.
