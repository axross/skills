---
status: accepted
---

# Trade the load-bearing hoist for a conditional read obligation

## Context

`2026-08-17-keep-a-load-bearing-rule-in-skill-md-not-behind-a-reference-pointer.md`
and `2026-08-18-pilot-the-load-bearing-test-a-second-time-on-code-maintainability.md`
established and then extended a rule: a load-bearing rule's own statement — the
one an agent needs before the work starts, not once it already knows the
question exists — moves out of `references/` and into `SKILL.md`, the file a
host loads by default. Both records were explicit that the measurement behind
the move was thin. Issue #411 found `follows-the-taught-property-group-order`
false in every probe of a scenario targeting `react-component-styling`, and
the decisive fact was not the outcome — it was that no probe in three ever
opened `references/style-property-order.md` at all: two read `SKILL.md`, saw
a descriptive pointer, and never followed it. The 2026-08-17 record considered
and rejected "keeping the split and making the pointer imperative" for exactly
this reason: whether an imperative pointer gets followed is exactly as
unmeasured as whether a descriptive one does, so trading a known failure for
an unknown one settles nothing. It chose the hoist instead, because the hoist
needs no such measurement to work — a rule an agent's default context already
holds cannot be missed for want of a read that never happened.

That reasoning is not being contradicted here. What changed is the other side
of the ledger, which neither prior record weighed against it: a `SKILL.md`
that states every load-bearing rule directly cannot be tree-shaken by the
sessions that will never touch most of them. `node scripts/report-obligation-burden.mjs`,
re-run against this branch immediately before this change, put the library at
a floor of **247 obligations (~71,602 tokens, 340,824 bytes)** carried by
every session that loads any skill's `SKILL.md`, against a ceiling of
**5,332 obligations (~478,029 tokens)** if every reference were read too —
`code-maintainability` alone had risen from 2 obligations to 19 under the
pilot the second record above applied. The 2026-08-17 record's own count, at
the commit before its pilot, already showed the shape: 96% of this library's
rules were reachable only by opening a reference, and the hoist direction
moves that fraction the wrong way at every skill it touches. #411's problem is
about one probe missing one rule; this problem is about every session in this
library paying for rules almost none of them will use. Both are real, and the
prior records solved the first without weighing the second at all.

## The decision

The human weighed the two costs directly — a **measured** problem
(a reference nobody is told to read is a reference nobody reads) against an
**unmeasured** remedy whose price is certain (a `SKILL.md` that states every
rule directly does not shrink with the task) — and chose to accept the
unmeasured remedy's risk in exchange for the certain saving. This is not new
evidence: no scenario was dispatched against this change, and none is claimed
to have settled whether a conditional pointer gets followed any better than
the descriptive one #411 measured failing. It is a judgment call, made with
the same open question the 2026-08-17 record left open, weighed against a
cost that record did not have in front of it at the time.

The remedy: a load-bearing rule's own statement returns to the reference that
governs it. `SKILL.md` states no rule directly — except under the carve-out
below — and instead carries a `**Guidelines:**` block, placed after that
reference's routing list, with one RFC-2119 bullet per reference naming the
reference and the condition, narrow enough to be skippable, under which it
MUST be read. A reference nobody is told to read still never gets read, so
the obligation to read it is what stays in the file every host loads by
default; the rule's content stops being one of them.

**The carve-out.** A rule whose triggering condition is unconditional within
its own skill's scope keeps its statement in `SKILL.md`, because a pointer
that fires on every turn costs a read and shakes nothing a direct statement
would not already have shaken. `professional-behavior`'s Response Language
section is the case this exists for: it was added directly to `SKILL.md` by #437,
never hoisted from a reference, and governs every turn's output within
that skill's scope. It is the only exception applied in this change; every
other place in the library that stated a rule directly in `SKILL.md` for
placement reasons alone is converted here.

**What moved.** `agent-skill-authoring`'s `SKILL.md` and
`references/progressive-disclosure.md` now teach the conditional form as the
convention, with the carve-out stated as a named rule rather than applied
silently. `code-maintainability`'s Cohesion, Default Vocabulary, and
Self-Explanatory Implementation return to their references at their
`origin/main` wording, keeping the four content refinements the 2026-08-18
pilot record added — `isProcessing` in the `is<Adjective>` row, the
non-linear cohesion scale, the precision-or-intuition test, and the
shallow-interface diagnostic — none of which were ever about placement.
`react-component-styling`'s Style Property Order returns to
`references/style-property-order.md` exactly as it read before #418.
`professional-behavior` keeps Response Language in place under the carve-out
and gains the conditional form for every other reference it routes to.

**Re-run after the change.** The same report, re-run against this branch
after every skill above was converted, puts the library at a floor of
**230 obligations (~69,938 tokens, 332,907 bytes)** against a ceiling of
**5,346 obligations (~478,657 tokens, 2,278,407 bytes)**. The floor drops by
17 — `code-maintainability` and `react-component-styling` each lose more
obligations from their `SKILL.md` bodies than the two skills together gain
back from their own new read-obligation bullets, and `professional-behavior`
gains six read-obligation bullets where it previously stated none outside
Response Language. The ceiling rises by 14 — the read-obligation bullets
themselves, which count once whether or not their reference is ever opened,
and which is the entire price this trade asks a full read to pay. Neither
figure is close to the pre-hoist library figures the 2026-08-17 record
measured (211 floor, 5,321 ceiling, at a commit before either pilot); this
change converts the places that diverged from the new convention — the
convention document itself and the three skills that had stated a rule in
`SKILL.md` for placement reasons — and leaves every other skill's routing
sections untouched.

## What was rejected

- **Leaving the hoist as it stood.** Rejected on the token cost above; the
  floor a `SKILL.md`-only session pays does not shrink with the task while
  rules that will never apply sit in it directly.
- **Splitting the difference with a rule digest in `SKILL.md` and the full
  rule in the reference.** Already rejected by the 2026-08-17 record: a
  digest that drifts from what it summarizes is a second failure mode the
  no-duplication convention did not previously have, and nothing about
  weighing token cost against reachability changes that.
- **A carve-out wider than Response Language.** Considered and left to a
  reviewer to overturn at the plan gate rather than applied broadly by
  default; extending it further trades away more of the tree-shaking this
  change exists to buy back, for savings this change did not need to claim.
- **Measuring the conditional pointer before adopting it.** Available, and
  not taken. Dispatching an evaluation here would answer the open question
  both prior records left standing, but this change does not claim to have
  answered it — see below.

## Consequences

**This is a judgment call, not a finding.** No evaluation instrument ran
against this change, and none is claimed to have run. Whether a conditional
`MUST read` bullet gets followed any better than the descriptive pointer #411
measured failing is exactly as open now as it was when the 2026-08-17
record declined to adopt that same shape for that same reason. This record
does not close that question; it records that the
human chose to accept the risk that it stays open, in exchange for the
measured token cost the hoist direction was certain to keep paying.

**What this does not license.** It does not license treating the conditional
read obligation as measured to work — the next reader who cites this record
for that claim is citing it for something it does not say. It does not
license converting any other skill's routing sections in this same change;
every skill this change did not name above remains exactly as it was,
tracked instead by the follow-up issues this change's own pull request
opens, one per skill so each stays attributable. It does not license a
carve-out beyond `professional-behavior`'s Response Language without stating,
in the change that adds one, why that rule's condition is unconditional
within its own skill's scope rather than merely broad. And it does not
retroactively validate or invalidate #411's own measurement, which stands as
recorded: a reference nobody is told to read is a reference nobody reads,
observed directly and not reasoned into.

This record supersedes both
`2026-08-17-keep-a-load-bearing-rule-in-skill-md-not-behind-a-reference-pointer.md`
and `2026-08-18-pilot-the-load-bearing-test-a-second-time-on-code-maintainability.md`
by name. Neither is edited beyond the frontmatter this supersession requires;
both stay readable exactly as written, because the reasoning they carried —
including the reasoning against this exact remedy — is what makes this
record's own trade-off legible.
