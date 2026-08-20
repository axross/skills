---
status: accepted
---

# Trade unverifiable savings claims for a context-separation rationale

## Context

`subagent-delegation.md`'s "Why the Loop Delegates" section stated one reason
the loop spawns a subagent at all: a project can pin, through that subagent's
own definition, a cheaper model and reasoning effort than the main actor
runs at. Two reporting rules followed that framing to its conclusion —
`run-state-and-reporting.md` required the completion summary to state
"whether the intended implementation-model saving was actually achieved," and
required reporting, once the independent review landed, how many of its
findings the pre-flight stage had missed, "the second figure is what answers
whether the stage earns its cost."

Neither figure is one a run can actually produce. Model and effort certainty
is classified as `verified`, `declared`, or `unknown` elsewhere in this same
reference precisely because a harness commonly exposes only a _declared_
value — confirming a saving was "actually achieved" would need the
counterfactual cost of the same work at the main actor's own model, which no
single execution observes. And `pre-flight-review.md`'s own comparison table
already states that one of the five properties pre-flight review is meant to
recover — absence visibility — is not recovered at all, "because the
reviewed party holds the report": the same asymmetry makes a clean count of
"findings the external review caught that pre-flight missed" depend on the
main actor's own judgment about which finding in a later, possibly different
diff corresponds to which finding in an earlier one. Both rules asked the run
to report a number nothing in the loop's own design lets it compute
honestly.

Separately, one real Claude Code session was measured directly from its own
transcript: 47 API responses, read-heavy, with no subagents spawned at any
point. 84% of its cost was context re-supply — 48% cache writes and 36% cache
reads — against 16% output, and a single skill body ingested for one lookup
cost roughly 7% of the session by being carried for the rest of the run after
that lookup was done. **This is one investigation-shaped session, not a
delivery run, and no subagent-attribution claim rests on it** — the session
spawned no subagent, so it measures the cost of one actor carrying
accumulated context forward, not the saving a second, separate actor
recovers. It is evidence for the mechanism behind delegation, not a
measurement of delegation itself.

## The decision

Two changes land together, because both replace an unverifiable framing with
one the loop can actually stand behind.

`subagent-delegation.md`'s stated reason for delegating becomes **context
separation**: an implementation worker so it does not inherit Phase 1's
accumulated planning context, a pre-flight review reader so it does not
inherit the implementer's reasoning state, and — via the same change's new
`context-ownership.md` and its investigator role — a payload kept out of the
main actor's context entirely rather than read and then discarded. Pinning a
cheaper model and effort through a subagent's own definition stays stated,
but as a secondary benefit rather than the reason itself. The calibration
above is why: it is a real measurement of what carrying context costs inside
one actor, and every role the loop spawns exists to keep some context out of
the main actor — that holds regardless of what model a subagent runs at,
where a savings claim depends on a counterfactual the loop cannot observe.
The calibration itself is not carried into the skill; only the judgment it
informed is.

The two reporting rules nothing could satisfy are deleted from
`run-state-and-reporting.md`: the implementation-model-saving clause, and the
whole pre-flight finding-count report. `pre-flight-review.md` was checked for
prose whose truth depended on the deleted report and carries none — the
sentence explaining why the figure mattered lived beside the rule itself, in
`run-state-and-reporting.md`, and was deleted with it.

## What was rejected

- **Keep model-cost pinning as the primary stated reason.** Rejected: it is
  real, but it is a claim the loop cannot verify a run actually collected on,
  while context separation holds by construction — a subagent is a distinct
  actor with its own context whether or not its model differs from the main
  actor's.
- **Weaken the two reporting rules to SHOULD instead of deleting them.**
  Rejected for the reason the plan gave: nothing can satisfy either as
  stated, and a SHOULD nothing can satisfy is a rule that reports compliance
  it never had — softening the keyword does not make the figure computable.
- **Treat the one-session calibration as sufficient evidence that delegation
  saves cost.** Rejected. The session spawned no subagent; it measures
  what one actor's own accumulated context costs to keep re-supplying, which
  motivates separating context across actors but does not measure the
  saving delegation itself produces on any real delivery run.
- **Dispatch a measurement of whether context separation or the pre-flight
  stage actually works before adopting either.** Available, and not taken
  here — out of scope for this change, and left to whichever future issue
  takes it up.

## Consequences

**What this does not license.** It does not license citing this record as
evidence that delegation saves cost on any particular run, or that the
one measured session generalizes to a delivery run with subagents. It does
not retroactively validate the deleted implementation-model-saving claim for
any run that reported it before this change; those reports stood on a
`declared`, not `verified`, model value, exactly as `subagent-delegation.md`'s
Model and Effort Certainty section already required them to be read.

**What is accepted deliberately.** After this change, nothing in
`loop-engineering` indicates whether the pre-flight stage repays its cost —
no run reports how many findings it caught against how many the independent
review caught that it missed. That visibility is traded away because the
rule that produced it asked for a number the loop's own design cannot
compute honestly, not because the question stopped mattering; a future
change that wants that answer needs a different instrument than a
self-reported count, most plausibly the kind of dispatched evaluation
`docs/specs/skill-evaluation.md` already describes for a skill's own effect.
