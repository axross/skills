---
status: accepted
---

# Place runtime precedence in the host entry file, not in a skill

## Context

`2026-09-07-separate-loop-contracts-from-host-authority.md` replaced the
portable loop's standing-mandate interpretation with a precedence claim stated
inside the skill: host instructions and each tool's usage conditions outrank
project mandates, and a standing project mandate cannot itself authorize an
operation the host conditions or forbids. That fixed the real defect it named —
a project mandate cannot be read as satisfying a condition the host never
permitted — but it stated the fix in the wrong document, and a before/after
audit of the whole restructuring found the consequence.

Two problems followed from the placement. The claim is broad enough to swallow
any document that states a gate, including the host entry file a project would
use to say that an injected task framing does not lower one: that file is
itself a project mandate. So a maintainer who wrote the exception where it
belongs still read the skill as overriding it. And the claim travels with a
distributable skill into projects whose host the skill cannot see, asserting a
ranking about instructions it has no way to inspect.

The forms actually at issue are Claude Code's own injected task framings —
"make the requested changes, commit, and push", "do not create a pull request
unless the user explicitly asks", "do not spawn subagents unless the user
requested it". Each is a convenience default about how an ordinary session is
expected to behave. None is a tool usage condition, and treating the two as one
class is what made the claim overreach.

## The decision

The precedence between an injected instruction and this project's gates is
stated once, in the entry file of the host doing the injecting — for Claude
Code, `CLAUDE.md` — which is the only document positioned to see both sides.
Every precedence claim is removed from the distributable skills and from the
project documents that restated it. The skills state the gates and the evidence
each phase needs, and say nothing about which instruction wins.

**What stays in the skills.** Only the precedence claims moved. The change
loop's own capability and authorization vocabulary is not a precedence claim
and is untouched: the distinction between plan approval, operation
authorization, execution capability and permitted tool use; scoped operation
grants; the seven result states; and the split between a missing capability
reported `unavailable` and a missing permission reported
`authorization-waiting`. Deleting those alongside the claim would have removed
machinery landed only days earlier, for no gain.

**The boundary the entry file draws.** A framing that says how to shape the work
is subordinate to the working agreement. A condition saying an operation is not
permitted, or that a tool may not be used for a particular purpose, is a
boundary the agreement does not reach past, and an operation it forbids is
reported as unavailable rather than performed. Where the two are genuinely hard
to tell apart, the agreement requires treating it as a boundary and surfacing
it rather than deciding silently.

This record supersedes `2026-09-07-separate-loop-contracts-from-host-authority.md`
by name. That record itself superseded
`2026-08-20-move-the-delegation-determination-to-phase-1-and-satisfy-a-conditional-policy-with-a-standing-mandate.md`,
and **this supersession does not revive it**: the standing-mandate
interpretation is not restored, because the entry file now states the exception
narrowly and against named injected forms rather than as a general licence for
any project mandate to satisfy any host condition.

## What was rejected

**Leaving the claim in the skill and adding the exception beside it.** This
keeps the distributable skill asserting a ranking about a host it cannot
inspect, and leaves a reader to resolve a claim against its own exception.

**Stating the exception in `AGENTS.md`.** Host-neutral and project-owned, so it
reads better at first — but `AGENTS.md` is a project mandate too, so the
original claim would still swallow it, and the injected forms it answers are one
host's, which a host-neutral file should not enumerate.

**Removing the capability and authorization vocabulary along with the claim.**
Considered because both arrived in the same restructuring. Rejected: those are
result states and grant scoping, not statements about whose instruction wins,
and they are what lets a blocked operation be reported honestly instead of
performed.

## Consequences

**A downstream project receives no precedence statement at all.** Consuming
projects install `skills/` and not this repository's entry files, so an
installed change loop now states its gates and says nothing about a runtime
that frames the task more loosely. That is the intended shape — a skill should
not assert a ranking it cannot check — but it is a real loss of guidance, so
`README.md` tells an installing project that the statement is theirs to write
in their own host entry file, and
[Skill Portability](../conventions/skill-portability.md) records what no longer
travels.

**Only Claude Code's forms are enumerated.** `CLAUDE.md` names the three
injected framings observed here. A host whose runtime injects something else
needs its own entry file to name its own forms; nothing here derives them, and
the list is not a closed set.

**This settles placement, not the underlying open question.** Whether an agent
actually follows the entry file's precedence section over an injected framing is
unmeasured, exactly as it was under the previous record. Nothing here dispatched
an evaluation, and no claim is made that the relocation changes behaviour rather
than only making the instruction coherent to read.
