---
status: accepted
---

# Move the delegation determination to Phase 1 and satisfy a conditional policy with a standing mandate

## Context

`loop-engineering` never delegated a Phase 1 planning read, and the cause was
structural rather than a run's judgment. The only floor-tier obligation that
made the harness-permission determination happen was anchored in `SKILL.md`'s
Phase 2, "before the first project-file edit" — an event that cannot occur
before Phase 2. Phase 1 carried no trigger at all. `subagent-delegation.md`
does state the general form — the determination runs "before the first action
the role's spawn licenses", covering every role the run may spawn, including
an investigator — but that text lives in a reference file whose own MUST-read
trigger is "before resolving who runs any delegated phase or role", and
nothing in Phase 1 made such a resolution happen. `context-ownership.md` had
the same shape: reachable only from a decision Phase 1 never asked the run to
make. So on any host whose policy conditions the spawn on the human's
request, the determination first fired after the planning context — the
single largest read the run performs — had already been carried into the main
actor's own context.

`2026-08-06-default-unreadable-delegation-policy-to-undetermined.md`
diagnosed one phase later exactly this shape of gap: the determination
"lived only as a prose clause in `implementation-worker.md` … while
`SKILL.md`'s Phase 2 … carried zero `**Guidelines:**` blocks at all," and its
fix was the floor-tier promotion into Phase 2. That promotion landed and
stopped there; Phase 1 was never covered. That record also settled a second,
independent question — the barred/undetermined boundary — deciding that an
unreadable policy defaults to **undetermined**, never **barred**, and that "a
policy that names the human's request as its own condition, in any wording,
is the canonical undetermined case and is never classified barred." Neither
half of that record's _reasoning_ is contradicted by what follows — the
mechanism it built stands, unchanged, and is restated below — but the second
half's own unconditional sentence no longer holds everywhere, which is why
that record is superseded by this one rather than left standing beside it.

Moving the trigger to Phase 1 alone would fix the routing and worsen the
timing: on an undetermined host, the run's first observable act would become
a human question asked before any plan, any context, or any reason the human
could weigh it against. `SKILL.md`'s Execution Model already carries the
remedy for an analogous case: a harness clause reading "do not create a pull
request unless the user explicitly asks" is satisfied because "the host
project's working agreement mandating a pull request for every change **is**
the standing explicit ask." A policy reading "do not call the subagent tool
unless the user requested it" has the identical shape, and the loop already
mandates delegating wherever a candidate qualifies — Executor Resolution
takes the first qualifying candidate and forbids ambiguity from forcing
fallback, and the pre-flight review stage "runs whenever a compatible review
worker resolves; the run does not choose to skip it." The mandate the
argument needs already existed; what was missing was the sentence saying it
satisfies such a clause.

## The decision

Two changes, made together because the second is what keeps the first from
trading a routing bug for an earlier, worse-timed question.

**The determination moves to Phase 1.** `SKILL.md`'s Phase 1 now carries a
`**Guidelines:**` obligation establishing the harness-permission determination
before the first Phase 1 investigation read a subagent could carry, on every
run, landing on permitted, barred, or undetermined exactly as before; where a
question is needed, the single per-run question covers every role the run may
spawn, the investigator included, so no later executor resolution re-asks it.
Phase 1's investigation bullet now routes a payload read only for one
conclusion to `context-ownership.md`, and the same `**Guidelines:**` block
carries the matching MUST-read — closing the second structural gap alongside
the first, since that reference was reachable only from a decision Phase 1
never asked the run to make either. Phase 2's existing obligation is restated
rather than duplicated: it reuses the determination Phase 1 already
established for a run that passed through Phase 1, and establishes it there
only for a run that reached Phase 2 without passing through Phase 1 — a
resume, or an open-pull-request target.

**A standing mandate satisfies a request-conditioned policy.**
`subagent-delegation.md`'s **Permitted** branch gains a fourth route: a
standing mandate in the host project's working agreement that adopts this
loop as its default change loop satisfies a policy conditioning the spawn on
the human's request, in any wording, because such a mandate **is** that
request — the identical argument the Execution Model already makes for the
pull-request clause, and `SKILL.md`'s Execution Model paragraph now states
the two side by side. **Undetermined** narrows to what that route cannot
reach: a policy conditioning the spawn on something a standing mandate cannot
supply — per-spawn approval, a cost ceiling, or an operator condition naming
something other than the human's request — or a request-conditioned policy no
such mandate exists to satisfy. Every determination still records what it
rests on; resting on the new route now requires quoting the mandate, the same
way the existing routes name their policy text or their no-restricting-policy
observation.

**The 2026-08-06 record is superseded by this one, not narrowed in place.**
That record's unreadable-policy mechanism carries forward unchanged: a policy
the run cannot read as unambiguously absolute still defaults to
**undetermined**, never **barred**, and **barred** still requires positive
evidence no request could lift — both restated above, in
[subagent-delegation.md](../../skills/loop-engineering/references/subagent-delegation.md)
as edited by this decision, and here in this record's own text, so the
constraint survives the record that first stated it being superseded. What
the standing-mandate route falsifies is one sentence of that record's own
text: "a policy that names the human's request as its own condition, in any
wording, is the canonical undetermined case and is never classified barred."
That sentence is unconditional as written, and the standing-mandate route
makes it false for every request-conditioned policy the route reaches — a
project whose working agreement adopts this loop as its default change loop
now resolves that same policy to **permitted**. Leaving the 2026-08-06 record
`accepted`, with only this record's prose noting the narrowing, would leave a
reader who opens that record on its own — with no reason to also find this
one — still reading that sentence as a live, unconditional rule. A pre-flight
review of an earlier revision of this plan raised exactly that: the plan had
assumed the record could stay `accepted` on this reasoning, which is what
this record now rejects.
[decision-records.md](../../skills/living-project-documentation/references/decision-records.md)
gives `status` exactly two values, `accepted` or `superseded`, and defines no
third state for a record that is narrower than written — so narrowing it in
place is not an option the convention offers. The 2026-08-06 record is
therefore superseded: its `status` is flipped to `superseded` and its
`superseded_by` names this file, and nothing else in it changes. Its
reasoning stays exactly as written, including for the case it remains
correct about — a project with no standing delegation mandate still lands
exactly where that record put it — because a superseded record is replaced,
never edited for substance.

## What was rejected

- **Move the trigger to Phase 1 and keep the question.** Fixes the routing
  and makes an undetermined host ask before any plan exists — a question with
  nothing behind it, asked as the run's first act. Rejected: it pays down one
  cost by incurring a worse one of the same kind.
- **Exempt read-only roles (an investigator) from the question.** Narrow
  enough to fix exactly the reported symptom, but it reads a policy saying
  "do not call the subagent tool" as applying to only half that tool's uses —
  an interpretation the harness did not offer, made by the skill on the
  harness's behalf. Rejected as a misreading of the policy rather than a fix
  to the timing.
- **Default an unreadable policy to permitted.** Already rejected by the
  2026-08-06 record and not revisited here: it decides on the human's behalf
  what only the human can grant. The route added here is different in kind —
  it does not reinterpret an unreadable policy; it observes that a readable
  conditional policy's own stated condition is already met by a mandate the
  project holds.
- **Restate the rule as a repository-local routing line in `AGENTS.md` or
  `CLAUDE.md`.** Issue #245's parked proposal. A portable fix inside the
  distributable skill reaches every installing project; an entry-point line
  reaches only this one repository.
- **Leave the 2026-08-06 record `accepted` and narrow it in prose only.** An
  earlier revision of this plan assumed this route, on the reasoning that
  nothing in that record is wrong for the case it was written against.
  Rejected once a pre-flight review pointed out the record's own sentence is
  unconditional as written: a reader who opens it alone still reads a claim
  the standing-mandate route now makes false wherever that route reaches, and
  [decision-records.md](../../skills/living-project-documentation/references/decision-records.md)
  offers no status between `accepted` and `superseded` for a record that is
  merely narrower than written.

## Consequences accepted

`loop-engineering`'s obligation count moves by two at both tiers, and from
one source: the two new Phase 1 `**Guidelines:**` bullets. Everything else
this change writes widened prose that was already counted — Phase 2's
obligation is restated rather than duplicated, and
`subagent-delegation.md`'s standing-mandate recording requirement folded into
a bullet that already existed, so the reference file's own obligation count
did not move at all. It shows up in the ceiling's token growth and nowhere
else. The exact delta is measured with
`node scripts/report-obligation-burden.mjs` against the pre-change baseline
(floor 34 obligations / 33,891 bytes, ceiling 236 obligations / 149,866
bytes) and stated wherever this change is reported, not predicted here.

Nothing here measures the outcome the change exists to produce — that a
later run actually reaches the determination at Phase 1 and delegates a
planning read. This repository has no instrument for whether a rule inside a
loaded skill is executed, and skills load at session start, so the effect is
not observable from inside the session that makes the change. The first
evidence is the next change-delivering run, read against this one as the
negative baseline — the same limit the 2026-08-06 record recorded for its own
fix.
