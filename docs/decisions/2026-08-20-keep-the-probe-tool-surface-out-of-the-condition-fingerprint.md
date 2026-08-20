---
status: accepted
---

# Keep the probe tool surface out of the condition fingerprint

## Context

[#440](https://github.com/axross/skills/issues/440) found that
`tools/evaluation/src/probe-process.mjs` declared a tool surface neither
matching nor bounding what the `claude` CLI gives a probe, and fixing it meant
denying tools a probe could previously reach — the six `Task*` tools,
`Workflow`, `SendMessage`, and the rest. That narrows what every probe taken
after the fix can do, against every probe taken before it.

Which raised the question the fix could not avoid: does the tool surface a
probe ran under belong to what makes two measurements comparable? The
condition fingerprint answers that question for the project tree, the probe
model, every installed skill's digest, and each reasoning factor's judge,
prompt, and route. A tool surface is the same kind of fact about the
circumstances a probe ran under, and nothing in the model excluded it on
principle — it was simply never asked, because nobody knew the surface was
drifting.

Adding it was cheap at that moment and expensive later. `tools/evaluation/measurements/`
held only `.gitkeep`, so no stored measurement would have been invalidated;
but from then on every CLI release that surfaced or withdrew a tool would cut
the comparability chain, and a probe measured before that release would stop
being any measurement's comparable predecessor. The instrument would lose
predecessors to a fact about the CLI rather than to a fact about the skill
under test.

## The decision

**The tool surface stays out of the condition fingerprint, and is recorded
per probe instead.** The fingerprint keeps the four inputs
`docs/specs/skill-evaluation.md` already gives it. Each probe's own
`metadata.json` carries the surface the CLI reported, the declarations it was
compared against, and their disagreements, so a reader comparing two
measurements can see a surface difference by reading rather than by having the
instrument refuse the comparison.

The trade this accepts, deliberately: `fingerprintsMatch` reads a measurement
taken before the #440 fix and one taken after as comparable, though the second
ran with fewer tools reachable. That is a real loss of precision, taken
because the alternative loses more — a comparability chain that breaks on
every CLI release, for a difference that is usually irrelevant to what a
scenario measures.

The maintainer settled this at the plan gate, choosing between the two options
below.

## What was rejected

**Adding the surface to the fingerprint.** Put to the maintainer and not
chosen. It is the stricter reading and would have made the incomparability
explicit rather than leaving it to a reader — but it makes the #440 fix itself
the cut point for every future comparison, and hands the same power to every
later CLI release.

**Recording the surface without reporting on it.** Rejected while planning:
storing the reported `tools` array alone would make a drift discoverable but
not visible, which is the state #440 was filed about. The comparison and its
warning are what turn the drift into something the instrument says rather than
something a person finds.

## Consequences

**A surface difference between two measurements is found by reading, not by a
refused comparison.** Anyone reading a derived summary's
`comparablePredecessor` who cares whether the tool surface moved has to open
both measurements' `runtime.tools` and look. Nothing warns them.

**This holds only while a tool surface difference stays usually irrelevant.**
If a scenario is ever declared whose factors turn on a tool a probe can or
cannot reach, the reasoning above stops applying to it, and the question
should be re-argued from that scenario rather than inherited from here.
