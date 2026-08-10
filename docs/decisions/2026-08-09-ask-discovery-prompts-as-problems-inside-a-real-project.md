---
status: accepted
---

# Ask discovery prompts as problems inside a real project

## Context

The skill discovery evaluation asked each prompt in a bare scratch workspace: no
project, no agent instructions, one turn, and only the tool that selects a
skill. That isolation was deliberate and its reasoning was sound. This
repository's own working agreement mandates three skills in every session, so a
probe run inside this checkout would measure that agreement rather than
discovery, and would do so silently — every case would pass for the wrong
reason.

What the reasoning does not establish is that an empty room is the only place
free of that contamination. A **mock project** names no skill in this library;
it states its conventions in its own words. A probe situated there is as free of
instruction-following as one situated nowhere, and it is in the situation a
skill is actually discovered in — someone working in a codebase, with every
other skill competing for the same selection.

Situating alone would not have been enough, and finding out why is what forced
this into a decision rather than a change. Most of the fixture's prompts carried
the answer inside them. One named the vendor SDK **and** the two operators to
choose between; another named the framework hook and the call it should make; a
third used the low-fidelity design capability's own vocabulary to ask for
low-fidelity design. In an empty room that was harmless, because the prompt was
all the information there was. Situated, it is circular: the model never has to
read the project, so the measurement records routing on vocabulary rather than
routing on a situation.

## The decision

**A prompt states the problem in the words of whoever has it, and the probe
reads the project to answer.**

No path, no directory, no symbol, no library, no framework, no vendor — one or
two sentences, in the voice of the person the problem belongs to. The probe is
given the file-reading and searching tools it needs to go and find the subject,
and a turn cap loose enough that it never binds.

A prompt takes one of two shapes, and the mock decides which:

- **Symptom**, where the defect is real — either the case's own **case patch**
  or a gap the mock genuinely has.
- **Want**, where the thing being asked for genuinely does not exist.

**No defect is planted to let a case take the symptom shape.** A case with
nothing wrong states a want instead. Inventing the gap is what the mock
principle already forbids, and a prompt describing a defect the model cannot
find measures confusion rather than discovery.

**The shell and the editing tools stay denied.** Discovery asks which skill a
model reaches for. A probe that starts doing the work is measuring the effect
axis at this axis's prices, and denying those tools also means a discovery
workspace never needs its dependencies installed.

## What was rejected

**Keeping the bare workspace.** It measures what a prompt routes to when there
is nothing to read, which is a real question but not the one worth the money: no
consumer of this library is ever in that situation. The bare probe survives for
the two jobs that need it — reading a pull request's own skill text, where the
prose comes from outside the repository, and the few cases whose subject
situating removes — and for nothing else.

**Situating the probes but keeping the prompts.** The cheapest option, and it
buys a workspace the model has no reason to open. Four prompts named the answer
outright; the rest named enough of it that the project was decoration.

**Naming the file or directory in the prompt, to bound how far the model
searches.** This is the tempting middle, and it is worse than either end. It
buys a cheaper probe by removing the thing being measured, and it strands every
prompt in the bare mode, where no such path exists.

## Consequences

**A probe costs more.** A model given no path explores before it answers, so the
per-probe cost moves from the one-turn rate toward the effect axis's measured
one. The projection is what admission refuses on, so the cost surfaces as a
refusal before a run rather than as a bill after one.

**A skill whose discovery depends on running a command is out of range.** Not
measured and found absent — out of range, which is a different result and must
not be reported as the first.

**A case whose subject is work in flight runs bare, and it is not a judgement
call.** **Mock materialization** refuses to leave anything uncommitted, so a
**probe workspace** is always a clean tree at its replayed history's tip; the
shell is denied above, so no probe can reach a diff by any route. A prompt
saying "review what I've changed", "this is being called ready", or "I'm about
to commit this" therefore has no referent no matter how much the model reads —
and a case that cannot separate "the description failed to route" from "there
was nothing there to route about" measures nothing. Six cases run bare for that
reason rather than three, which is a correction to how the criterion was
applied and not a loosening of it.

**A finding cannot be read without knowing what the probe did first.** A model
that fails to find the subject answers generically, and a generic answer records
as a miss, or reaches for a neighbouring skill and records as a spurious
selection. Neither is a statement about the **skill description**. Every probe
therefore carries a **signal extractor**'s reading of what it did — the turns it
took, how it terminated, and what it read before it chose — so a finding is
distinguishable from a failed search.
