---
status: accepted
---

# Cover every skill with at most two discovery cases

## Context

The skill discovery fixture was first written as a **pilot**. It deliberately
concentrated on three competing skills — the low-fidelity design capability, the
high-fidelity one, and the styling one — because each disclaims the other two in
its own **skill description**, so a prompt any of them could answer splits the
distribution and is the most informative thing a probe can measure.

Rebuilding the instrument re-expressed every case: each prompt rewritten to the
problem-owner's words, each label re-decided against the **mock project** that
hosts it. What that pass did not do was re-ask whether the pilot's concentration
still earned its place once the fixture covered the whole **skill corpus**. It
did not. Those three skills carried 18 of 59 cases and 31% of the probes, for 3
of 29 skills, while 16 skills had a single case each — one near-binary answer
about whether that skill is reachable at all.

The imbalance was visible only once the cases were counted per skill, which is
what the repository owner asked for on reading the rebuilt fixture.

## The decision

**Every skill is named by at least one case, and by no more than two.**

A second case exists only where it measures a competitor boundary the first does
not — a different set of skills that would be the wrong answer. Where several
cases shared an identical include/exclude signature and asked the same question
of the same competitor in the same shape, they became one.

Where such a group had to lose members, the survivor is chosen in this order:

1. the case carrying a real defect — its own **case patch**, or a gap the mock
   genuinely has, since a probe that can confirm the symptom is worth more than
   one that cannot;
2. the case measuring the sharper boundary — more competitors excluded, or a
   boundary no other case covers;
3. the case whose subject is most central to the skill.

That ordering settles most of it and not all of it. Three groups came down to a
judgement no rule made for us, and they are recorded because the next person to
trim a fixture will face the same kind of call: the styling skill keeps the case
excluding **both** design competitors over one excluding only the low-fidelity
capability; the high-fidelity skill keeps the hand-off from low fidelity to high
itself over a third subject measured against that same competitor; and the
low-fidelity skill keeps the case that breadboards a **flow** over a third that
sketches an absent **screen**, which the kept case already covers.

59 cases became 40 and 118 probes became 80. No skill lost coverage.

## What was rejected

**Keeping the pilot's weighting.** It buys depth on the boundaries most likely
to break, which is a real good. It was rejected because the fixture is no longer
a pilot: it is the corpus-wide instrument, and a headline drawn from it would
have described three skills in detail and twenty-six in outline.

**Trimming by probe budget rather than by coverage.** Cutting until the
projection fit a number would have removed whichever cases happened to sit at
the end of the file. Coverage is the property worth holding; the cost falling
from a projected $39.50 to $26.20 is a consequence, not the goal. (A later
round moved three cases to the bare mode for a reason of its own, taking the
projection to $24.40.)

**Levelling to exactly one case per skill.** Cheaper still, and it would have
discarded the boundary pressure that makes a competing pair informative at all.
Two is the smallest number that can hold both a skill's own reachability and one
boundary against a competitor.

## Consequences

**The mocks are used unevenly, and that is expected.** The Expo mock hosts five
cases where it hosted nine, because four of its cases measured one skill against
one competitor. Its theme layer, built for those cases, now serves one. A mock
is a genuine project rather than a per-case fixture, so substrate outliving the
case that motivated it is the ordinary state rather than waste.

**One case patch was deleted with the case that declared it**, since a patch
belongs to a case and a patch nothing declares is dead weight the offline check
would not catch.

**A number embedded in prose goes stale when the fixture moves.** Trimming broke
two assertions that had pinned a dollar total derived from the fixture's size,
and left stale figures in three documents. Both are now derived from the
committed fixture rather than restated beside it — which is the same discipline
the **marked count** already applies to a number in prose.
