---
type: Convention
title: Decision Placement
description: How to choose the durable owner of a decision and record that destination in the plan.
---

# Decision Placement

A decision settled while a change is being built — in a session's
conversation, in the plan, or in a review round — that a later change or a
later step has to honour or deliberately overturn needs a home once the plan
that settled it closes, or it survives only in a step issue nobody reopens.
This document states this repository's own answer to where that home is. It
does not cover a decision a later reader can recover from the tree the change
itself produced; treating every choice made while building as one needing a
place to land would turn this into a record-everything obligation nobody could
sustain. Nor does it restate what
[living-project-documentation](../../skills/living-project-documentation/SKILL.md)
already owns — what each `docs/` body holds, and where a settled constraint
goes — or what
[loop-engineering](../../skills/loop-engineering/SKILL.md) owns — the plan, its
gates, and the amendment mechanism a decision settled inside one plan revision
now carries into another; both are named here rather than duplicated.

## The Obligation

A decision this document governs MUST reach a durable document before the plan
that settled it closes. A plan and the issue it lives in are the record of a
moment: once that issue closes, nothing points a later reader back to the
decision it made except whatever diff happened to result from it, and a later
step more often opens from the umbrella plan a lineage descends from than from
the step issue that closed underneath it.

## The Placement Test

Where a decision lands is decided by this test, applied in order, rather than
by whoever happens to be writing the plan.

1. **Beside the thing it governs.** A decision MUST land here first, ahead of
   the step below, when it is a standing fact about the project rather than an
   instruction for one lineage alone. Which document receives it, and in what
   form it is written there, is
   [living-project-documentation](../../skills/living-project-documentation/SKILL.md)'s
   rule rather than this one's; what this step adds is the ordering, and what
   this repository adds is the narrowing under "Which Document Receives It"
   below.
2. **Into the umbrella plan, by amendment.** Failing that, a decision MUST
   land in the umbrella plan a later step opens from, written in with the
   amendment mechanism
   [loop-engineering's plan-document reference](../../skills/loop-engineering/references/plan-document.md)
   states, when it is an inheritance for a later step of the same lineage
   rather than a standing fact the tree carries everywhere.

Keep a standing constraint and its rationale together. When a rejected
alternative is likely to recur, explain the constraint it violates where the
reader would try it. Git and the pull request preserve the original decision,
its alternatives and its approval.

A decision the test places nowhere MAY be one the plan closes on without a
durable home, and the plan MUST state that explicitly rather than leaving the
silence to be read as an oversight.

## Which Document Receives It

Choose the concept that governs the decision. Its type describes the reader’s
question. The established directories keep their paths so existing routes
continue to work.

**`docs/specs/` is written for machinery no skill owns, and never restates a
skill.** This library's deliverable is itself documentation, so the closest
reading of "how the product behaves" is what each skill already says. A spec
per skill is rejected on two independent grounds: it would give one rule two
sources of truth, which this repository's own review policy rates Major
precisely because the copies then diverge silently, and it would not travel,
since a skill installs into projects holding none of this corpus and one
leaning on an external spec would arrive incomplete. The evaluation instrument, by contrast, has observable behavior that no skill owns. A change proposing a new spec
therefore names the machinery it describes and shows that no skill owns it,
and that is a judgment call left as one: no check can decide it.

**Contributor conventions and operational procedures live under
`docs/conventions/` and `docs/operations/`.** Give each rule one owner
and a heading a reviewer can cite. The README introduces the library, explains
how to get started, lists the skills, and links contributors to these guides.
[Development Setup](../operations/development-setup.md) owns local setup and
the command reference.

The catalog gives each skill its own section rather than a row in a
per-category table. A table compares better — one line each, side by side, is
how a reader shortlists — and that is what this trades away: picking between two
skills means reading two sections instead of two adjacent rows. What it buys is
somewhere for an accompanying note to go. A table cell has no room for one,
whereas a section carries it in the same place the reader already finds the
skill's description; `loop-engineering`'s note on the two environment variables
worth setting for a long run still lives in its `README.md` section for that
reason.

The cost accepted is reach. A document under `conventions/` or `operations/`
does not fire the way a skill does — nothing loads it because a task matches a
trigger phrase — so it is reachable only as far as
[AGENTS.md](../../AGENTS.md)'s own routing table makes it, and a kind of change
that table does not yet name has no document pointing a session at it until
someone adds a row.

## The Plan-Recording Requirement

The plan for a change that settles a decision this document covers MUST name,
per decision it settles, the document that will carry it, and MUST carry that
naming as an acceptance criterion, so a reviewer checks it against the
finished pull request rather than trusting that it happened.

No check enforces any of this. The violation is an absence — a document
nowhere naming a decision that was in fact made — and a check would first have
to decide which sentences of a plan state a decision before it could notice
one had nowhere to land, which is not a judgment a script can make. The
missing gate is therefore a choice stated here, not an oversight left
unaddressed.
