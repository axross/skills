---
status: accepted
---

# Rebuild skill evaluation around scenarios and factors

## Context

The skill discovery evaluation and the skill effect evaluation asked two
separate questions with two separate instruments: did a prompt surface the
skill, and did holding the skill change what the agent produced. The second
of those never worked, for three reasons its own committed data establishes.

**The generic differential does not discriminate.**
`tools/evaluation/data/effect/README.md` carried a section titled "Whether a
probe produced a diff does not discriminate between the conditions",
recording that `changedPaths` — the most prominent field on a probe's
summary, and the first thing a reader reached for — agreed between
skill-present and skill-absent in 20 of 22 measurements. The two exceptions
ran in opposite directions: `remove-config-options-the-test-runner-ignores`
produced a diff in 3 of 3 skill-present probes against 2 of 3 skill-absent,
and `fix-a-minified-production-stack-trace` the reverse. Equal counts were
not evidence the skill had no effect; they were evidence that reading —
whether a probe touched the filesystem at all — could not see whichever
effect a skill had.

**The judgment layer meant to carry the real signal was never built.**
`reading` was declared on 1 of the fixture's 21 cases, and `extractArtifact`,
the function that would have wired a declared reading into the derived
summary, "stays unwired from `summarize.mjs`'s derivation on purpose" — so
declaring a `reading` cost nothing against what any measurement actually
reported. `prediction`, required on every case, was prose that "none of them
read by `evaluate.mjs` or `summarize.mjs`" — a reviewer's promise, never a
computation.

**The control was not a control.** `skill-absent` installed no skills at
all, so every measurement compared "this skill plus the rest of the
library" against "no skills at all" rather than against "the rest of the
library alone." A difference between the two conditions was as likely to be
the library's other skills as the one under test.

Two further findings sharpened what those three failures meant for the
measurements already on disk. `loadedSkills` — whether the CLI announced a
skill as loaded before the first turn — never contained a case's own
declared skill in any probe committed under the pinned runtime, claude-code
`2.1.220`, including three skill-present probes of
`remove-config-options-the-test-runner-ignores` that invoked `vitest-testing`
by exact name as their second tool call. #364 established this as the
pinned runtime's own behavior rather than evidence the skill never reached
the workspace — a scratch run under `2.1.228` reported a marker skill in
`loadedSkills` under the same settings. That left every skill-present probe
with an empty `skillsInvoked` ambiguous rather than measured: "the skill was
there and went unused" and "the skill never reached the model" read
identically in every field the instrument could check, on four of the 22
measurements committed as of this pass, including the fixture's own negative
control.

One design choice from that instrument survived its own failures and is
carried into this one. Its predecessor stored extracted signals and threw
the raw stream away, on the reasoning that a later question would be a
threshold over the signal already extracted. It was not: reading six
recovered session logs later answered three questions the stored records
could not — which tools each run used, the per-message token usage, and the
model each message reported. Every question the extractor had not
anticipated had cost a paid re-run; a question over an already-stored
verbatim transcript costs a new reading of a file already on disk. That is
the evidence for keeping the probe transcript verbatim rather than
extracting from it, and it holds regardless of which instrument reads the
transcript afterward.

## The decision

**Replace both instruments with one, built around an evaluation scenario
judged by factors.** A scenario runs under two conditions built to isolate
the skill under test — the fix for the control that measured the whole
library instead — and every factor's judgment resolves to `true`, `false`,
or an error, never a float, rather than the generic, non-discriminating
signal the old instrument reported. `docs/specs/skill-evaluation.md` states
the model in full; this record states why it was chosen.

Three decisions particular to this rebuild are worth stating beside it,
because none is recoverable from the model alone. **A reasoning judge is
accepted, at its cost.** The failed judgment layer left the effect
evaluation with no way to check anything but the shallowest deterministic
signal; admitting a model to judge a factor is what the case-specific
layer needed and never got, and its model and its full prompt are recorded
on every result it produces, so re-judging with a different judge is a new
measurement rather than an update to an old one — never a silent
comparison across instruments that were not the same instrument.
**Three repetitions per condition is the default**, the same number the old
fixtures declared. It fixes the resolution of every differential: a pass
rate over three runs can only be 0, 1/3, 2/3, or 1, so a differential can
only be a multiple of 1/3, and a run scoring 0.333 is not distinguishable
from chance at that resolution. **The existing 68 measurements are
deleted rather than migrated.** They carry no factor judgments — the layer
that would have produced one was never wired — and their control condition
means something else than the one this record adopts, so nothing in them is
a measurement of what the new model measures.

This record also supersedes
`2026-08-10-cover-every-skill-with-at-most-two-discovery-cases.md` and
`2026-08-10-cover-every-in-range-skill-with-one-effect-case.md`. Both
constrained how many cases a fixture could carry per skill under the
discovery/effect split; a scenario now carries its own declared peer set and
its own declared phases, so neither constraint has anything left to bind
the moment that split stops being the unit.

## What was rejected

**Consolidating the existing model, as the plan this replaces intended.**
Rejected: there was no working outcome measurement to consolidate, and the
generic signal that plan would have consolidated is exactly what the
20-of-22 finding shows does not discriminate.

**Keeping the population split** — the field marking the cases whose skill
a mock's own instructions already named, so discovery never had to surface
them. It is not migrated as a field; a scenario's harness now carries that
fact on its own, as a property of what the harness names, rather than as a
classification a scenario declares about itself.

**Estimating cost before a dispatch**, as the deleted instrument's
`unmeasuredProbeCostCeilingUsd` did. It was declared `6` per bare probe from
a $40 cap divided across six planned probes — never a cost observation — and
the pilot measured $0.25 per probe against it. An estimate that has been
wrong this often is not a limit; a dispatch is bounded by an exact probe
count instead, refused before any probe runs, with actual spend recorded
after rather than projected before.

## Consequences

**The 68 deleted measurements are recorded rather than reproduced.** Their
own analysis — the three failures above, with their figures — is what this
record exists to keep durable once the files that reported them are gone;
nothing about the measurements themselves survives, because nothing in them
answers a question the new model asks.

**A skill-present probe with no invocation stays ambiguous on the runtime
pinned for those 68 measurements, and the new instrument inherits that
fact rather than resolving it.** `loadedSkills` not reporting a declared
skill is a property of claude-code `2.1.220`, not of any one probe; a future
measurement taken under a runtime that does report it will read
differently, and that difference belongs to the runtime column of what
makes two measurements comparable, not to the skill.

**The discovery-side evidence behind this same deletion is recorded
separately**, in
`2026-08-15-record-the-discovery-vocabulary-cost-before-its-artifact-expires.md`.
It does not bear on why the effect side was rebuilt, which is what this
record states; it bears on how a scenario's discovery-phase task should be
worded, which is a constraint on work still ahead rather than evidence for
work already decided here.
