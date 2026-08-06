---
status: accepted
---

# Scope specs to machinery no skill owns

## Context

Adopting a product-specification corpus here ran into a problem no ordinary
project has: this library's deliverable is itself documentation. A spec
describes how the product behaves now, and for a skill library the closest
reading of "how the product behaves" is what each skill says — which is already
written, in the skill.

The corpus was adopted anyway, because two things it carries had nowhere to
live: the vocabulary the repository uses across its root documents, and the
reasoning behind constraints that a later change has to honour or deliberately
overturn. What had to be settled was how far the third document type reached.

## The decision

A spec in this corpus is written for **machinery no skill owns**, and never
restates a skill.

The evaluation is the case that forced the line: it is present-tense behaviour
that no skill describes, so nothing else in the corpus could hold it.

## What was rejected

**A spec per skill.** Rejected on two independent grounds. It would give a rule
two sources of truth, which this repository's review policy rates Major
precisely because the copies then diverge silently. And it would not travel: a
skill installs into projects that hold none of this corpus, so a skill leaning
on an external spec would arrive incomplete.

**No `specs/` at all.** This was the first position taken, and the reasoning
above is why it was attractive. It was rejected once the argument was tested
against machinery rather than skills, where none of it applies. Excluding
`specs/` outright would also have left one of the five bundled validators — the
one pairing a spec with its glossary heading — permanently checking nothing,
which is a **gate** that reads as coverage while providing none.

## Consequences accepted

A change proposing a new spec has to name the machinery it describes and show
that no skill owns it. That is a judgment call, and it is deliberately left as
one: no check can decide it, and the alternative was a rule with a bright line
in the wrong place.

The corpus has no `overview.md`. Its two subjects are the product's purpose,
audience, and boundary, which `README.md` carries for a wider readership, and a
cross-domain map, which too few specs make worth drawing.

The vocabulary a spec introduces still belongs to the glossary rather than to
the spec, so admitting one kind of spec does not move that boundary.
