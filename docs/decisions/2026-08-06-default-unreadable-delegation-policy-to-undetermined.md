---
status: accepted
---

# Default an unreadable delegation policy to undetermined

## Context

Two consecutive change-delivering runs failed to delegate implementation
despite a qualifying worker and a question tool both being available. One run
skipped the harness-permission determination outright; the other ran it and
classified the harness's policy as **barred** by reading a clause that
conditioned the spawn on the human's request and discarding the word that made
it conditional. Both failures trace back to the same two structural gaps in
`loop-engineering`.

First, the determination lived only as a prose clause in
`implementation-worker.md` — a reference file loaded only once every
reference is read — while `SKILL.md`'s Phase 2, the phase that most needs it,
carried zero `**Guidelines:**` blocks at all. An earlier decision deliberately
traded that promotion away to keep the skill's floor-tier obligation count
low; the run that skipped the determination entirely is the counter-evidence
that the trade cost more than it saved.

Second, the barred/undetermined boundary had a default in one direction only.
The determination's **permitted** branch got several sentences establishing
that silence — no policy at all — resolves to permitted, so a run is not
forced to ask on every ordinary host. **Barred** got no equivalent
tie-breaker: nothing told a run what to do when a policy's wording could not
be read as unambiguously absolute, so the run that misread a conditional
policy had no rule pointing it away from that misreading. The two failure
modes are not symmetric in cost: a wrongly **permitted** run is corrected
loudly, because the harness itself refuses the spawn; a wrongly **barred**
run is silent, because the question that would have caught it never fires.

## The decision

An unreadable delegation policy now defaults to **undetermined**, not
**barred**. **Barred** is reserved for a policy the run can point to as
stopping the spawn outright, with no exception a request could satisfy — it
now requires that positive evidence rather than following from an unclear
reading. A policy that names the human's request as its own condition, in any
wording, is the canonical **undetermined** case and is never classified
barred. Every determination — whichever of the three results it lands on —
records the policy text it rests on, quoted, or the observation that no
restricting policy was found, so a `barred` or `undetermined` verdict is no
longer a conclusion with no evidence attached.

The mechanism that makes the new default binding is the floor-tier promotion
the earlier decision traded away: the determination is now a
`**Guidelines:**` obligation in `SKILL.md`'s Phase 2 itself, not only in the
reference file a delegating run happens to load. A run also weighs one more
thing before landing on barred: host or harness configuration that governs
_how_ delegation behaves, rather than _whether_ it is allowed at all, is
evidence against a barred classification — stated host-neutrally and naming
no vendor's variable.

## What was rejected

**Rejecting a determination-less status-block entry, and nothing more.** This
is the narrower fix originally proposed. Rejected as insufficient alone: it
would not have caught the second run's failure, whose status-block entry
named a result, was internally consistent, and was simply the wrong result.
It is kept as one measure among several — a genuinely undetermined-but-
unrecorded entry is still invalid — rather than treated as the fix.

**Leaving the determination as prose and strengthening it in place.** An
earlier decision already made that trade once, on the argument that a
determination stated clearly enough would not need to cost a floor-tier
obligation. Two runs then read the prose without being bound by it, which is
the direct evidence the trade does not hold in practice.

**Defaulting an unreadable policy to permitted instead of undetermined.**
Would remove the question entirely wherever a policy cannot be read cleanly.
Rejected because it decides on the human's behalf what only the human can
grant, and because the asymmetry above already favors the other direction —
a wrongly permitted run is corrected loudly by the harness, while a wrongly
barred run silently drops the question that would have caught it.

**Naming the vendor variable the provisioning evidence was drawn from, in the
portable rule.** Rejected because it is a vendor's undocumented internal: a
distributable skill that names it rots silently on every host that is not
that vendor's. The host-neutral generalization — configuration governing how
delegation behaves is evidence against barring it outright — carries the same
check without naming anything vendor-specific.

## Consequences accepted

`loop-engineering`'s obligation count moves at both tiers: the floor rises
with the new Phase 2 `**Guidelines:**` block, and the reference-file ceiling
rises with the new barred/undetermined and citation obligations in
`implementation-worker.md`. The exact delta is measured with
`report-obligation-load.mjs` rather than predicted, and stated wherever this
change is reported.

Nothing here measures the outcome the change exists to produce — that a later
run actually reaches the right determination. This repository has no
instrument for whether a rule inside a loaded skill is executed, and skills
are read at session start, so the effect is not observable from inside the
session that makes the change. The first evidence is the next
change-delivering run, read against the two failing runs above as the
negative baseline.
