---
status: accepted
---

# Run the pre-flight review whenever a reader qualifies

## Context

`loop-engineering` treated its two kinds of delegated worker inconsistently
about whether running them is discretionary. For the implementer it is not:
Executor Resolution takes the first candidate that qualifies, ambiguity alone
must not force a fallback, and none of its five terminal outcomes is "a
candidate qualified and the run chose not to use it." For the review-only
worker the pre-flight stage spawns, it was: `SKILL.md`'s Phase 2 said a
qualifying reader `MAY` judge the diff, and `pre-flight-review.md` called the
whole stage "one optional stage." The reference already mandated _skipping_
the stage when no reader resolves — that half was never in question — but
nothing mandated _running_ it when one did.

The asymmetry left the loop's most reachable second opinion — cheap, seconds
to minutes, run before the pull request even opens — as something a run could
always choose to skip, with no rule forcing the choice either way once a
reader was available.

## The decision

Where implementation was delegated and a compatible review worker resolves,
the pre-flight review stage now runs. It stops being left to the run's
discretion once both conditions hold. Nothing else about the stage changes:
it stays advisory, is still never reported as the independent review, and the
existing rule that no reader means the stage is skipped — never performed by
the main actor in its place — is unchanged and remains the only route past
it. The round cap, retry budget, and dismissal-authority split the stage
already carried are untouched.

## What was rejected

**Dropping the "implementation was delegated" precondition.** Would let a
reader judge a single-agent diff too, which is exactly where the independence
argument for a second opinion is strongest. Not chosen: the precondition
stays by deliberate choice, which also keeps this change's diff small and
leaves the writer-lease reasoning the stage already carries untouched.

**Making the stage mandatory outright, reader or no reader.** Would turn an
unavailable review worker into a stall. Not chosen: `pre-flight-review.md`
already forbids the main actor from filling that gap, because self-review
presented as a pre-flight review is exactly what the stage must not become —
a stall would either violate that rule or block the loop on a worker the
harness never offered.

## Consequences accepted

A delegated run now enters a stage whose disclosed envelope is up to four
review workers and twelve implementation-worker spawns before the first human
question, whenever a reader resolves. That envelope itself is unchanged — the
round cap and retry budget are untouched — but the stage stops being
opt-out, which is a cost increase this record discloses rather than buries.

A project that has been skipping the pre-flight review because it was
optional will start running it once it refreshes this skill. This is an
intended behavior change, not a defect, but it is one worth a project
noticing on its next refresh.
