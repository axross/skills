# Decision Placement

A decision settled while a change is being built — in a session's conversation, in the plan, or in a review round — that a later change or a later step has to honour or deliberately overturn needs a home once the plan that settled it closes, or it survives only in a step issue nobody reopens. This document states this repository's own answer to where that home is. It does not cover a decision a later reader can recover from the tree the change itself produced; treating every choice made while building as one needing a place to land would turn this into a record-everything obligation nobody could sustain. Nor does it restate what
[living-project-documentation](../../skills/living-project-documentation/SKILL.md)
already owns — what each `docs/` body holds, and the two conditions a decision
record must meet — or what
[loop-engineering](../../skills/loop-engineering/SKILL.md) owns — the plan, its
gates, and the amendment mechanism a decision settled inside one plan revision
now carries into another; both are named here rather than duplicated.

## The Obligation

A decision this document governs MUST reach a durable document before the plan
that settled it closes. A plan and the issue it lives in are the record of a
moment: once that issue closes, nothing points a later reader back to the
decision it made except whatever diff happened to result from it, and a later
step more often opens from the umbrella plan a lineage descends from than from
the step issue that closed underneath it.

## The Placement Test

Where a decision lands is decided by this test, applied in order, rather than
by whoever happens to be writing the plan.

1. **Beside the thing it governs.** A decision MUST land here first, ahead of
   either step below, when it is a standing fact about the project rather than
   an instruction for one lineage alone — in the spec, convention, or
   operations document a later reader of that thing already opens.
2. **Into the umbrella plan, by amendment.** Failing that, a decision MUST
   land in the umbrella plan a later step opens from, written in with the
   amendment mechanism
   [loop-engineering's plan-document reference](../../skills/loop-engineering/references/plan-document.md)
   states, when it is an inheritance for a later step of the same lineage
   rather than a standing fact the tree carries everywhere.
3. **`docs/decisions/`.** Failing both, a decision MUST land in a new decision
   record there, under that capability's own filename and structure rules,
   when it meets the existence test
   [living-project-documentation's decision-record guidance](../../skills/living-project-documentation/references/decision-records.md)
   states — those two conditions, and no third condition invented here.

A decision the test places nowhere MAY be one the plan closes on without a
durable home, and the plan MUST state that explicitly rather than leaving the
silence to be read as an oversight.

## The Plan-Recording Requirement

The plan for a change that settles a decision this document covers MUST name,
per decision it settles, the document that will carry it, and MUST carry that
naming as an acceptance criterion, so a reviewer checks it against the
finished pull request rather than trusting that it happened.

No check enforces any of this. The violation is an absence — a document
nowhere naming a decision that was in fact made — and a check would first have
to decide which sentences of a plan state a decision before it could notice
one had nowhere to land, which is not a judgment a script can make. The
missing gate is therefore a choice stated here, not an oversight left
unaddressed.
