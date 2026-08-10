---
status: accepted
---

# Compare a measurement against its predecessor, not a baseline

## Context

The skill discovery evaluation kept a committed file of recorded counts that
every later run was compared against, so a report read as a change rather than
as a bare score. Keeping it cost a ritual. Re-recording was a deliberate act
with its own dispatch input, its own artifact, its own refusals, and its own
section of prose explaining when to perform it; a case that had never been
measured needed a declaration saying so, and that declaration had to clear
itself; and because the file was fixture-wide, measuring one case could not
produce one at all.

The rebuild's first plan proposed deleting that file and treating the derived
summary on the default branch as the thing a run is compared against. That was
the same object under a new name. It kept every property that made the original
expensive, and it made a derived file the thing another derived file is judged
against — which is what the drift check exists to prevent one level down.

The observation that resolved it came from the other axis. Its measurements
already accumulate: a **case measurement** directory carries a random suffix
precisely so that measuring the same case again lands beside the last one rather
than over it. Nothing about that shape is specific to the effect axis.

## The decision

**There is no baseline. Measurements accumulate, and a result is a change
because the previous measurement is still on disk.**

A new **case measurement** is compared against its **comparable predecessor** —
the most recent earlier measurement of the same case whose conditions match:
same prompt, same model, same project tree, and the same **skill corpus
fingerprint** for the skills that case tracks. Where no such predecessor exists,
the report names the condition that failed rather than suppressing the
comparison or leaving it blank.

The derived summary survives as a derivation and nothing else. Deleting it and
re-deriving reproduces it byte for byte from the measurements alone, which is
the property that distinguishes it from what it replaced — and which the
instrument's own tests assert.

This also splits a check that used to be one. Probes **inside** one measurement
disagreeing means the measurement cannot be read at all, so it is refused before
it is committed. A measurement differing from its **predecessor** is ordinary
and informative: it is recorded, and the comparison carries the reason it is not
attributable.

## What was rejected

**Keeping a baseline under a new name.** Written into the first plan and
withdrawn at the design round. A baseline is a stored conclusion about which
measurement counts as current; the principle both axes are built on is that an
instrument stores what it measured and not what it concluded.

**Pruning old measurements on a schedule, or keeping the last few per case.** A
full fixture measurement is projected at two to three megabytes of transcript.
Bounding that automatically buys a smaller tree at the cost of a deletion nobody
reviews, and it re-introduces a maintenance act to replace the one this decision
removed. Measurements are kept; if the tree ever becomes a real problem, a
**superseded record** is already the vocabulary for dropping one deliberately.

## Consequences

**Five things delete themselves.** The re-record ritual, the separate baseline
artifact, the declaration for a case that has never been measured, the dispatch
input that emitted a proposed baseline, and both of that input's refusals. None
of them was load-bearing once the comparison stopped needing a document.

**Partial measurement becomes ordinary.** Measuring one case is one more
measurement of that case, so the single-case dispatch that prices a fresh
fixture produces a committed record rather than a log line.

**A comparison can be attributed more finely than before.** A baseline is one
document, so any change to the corpus degraded every case at once. A predecessor
is per case, so editing one skill's **skill description** leaves every case that
does not track it comparable.

**The tree grows with every measurement**, which is the cost this accepts.
