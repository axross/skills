---
status: accepted
---

# Bundle plan-amendment approval under three conditions

## Context

A plan that amends another issue's already-approved plan has been approved
two ways in this repository, and nothing in `loop-engineering` said which one
governs. Issue #395 re-approved its amendment to issue #392 on the amended
plan's own re-derived digest, as a separate act from the amending plan's own
approval. Issue #397, and #399 following it, instead bundled the amendment's
approval into the amending plan's own approval — quoting every replacement
block verbatim and naming the resulting digest in advance, rather than asking
the human to re-read the amended plan a second time.

Both are defensible on their own terms, and having two undocumented
conventions for one act works against the reason the revision-digest practice
exists in the first place: making the scope of an approval unambiguous. #399's
own plan noted this directly — a plan whose own open question is that an
approval's scope must be unambiguous should not itself demonstrate two
different ways of getting there.

## The decision

The amending plan's own approval carries the amendment's approval under the
conditions stated in
[plan-document.md](../../skills/loop-engineering/references/plan-document.md)'s
Plan Amendment section, rather than always requiring a second, separate
approval. Failing any one of those conditions, the amendment takes its own
approval against the amended plan's own revision identity instead — #395's
shape, kept as the fallback rather than discarded.

Conditioned bundling was taken over always requiring a separate approval
because, under those conditions, the human approving reads the same bytes
they would read at a separate gate — the conditions are what carry the
unambiguity #395's separate act bought by construction, at the cost of a
second approval gate on every amendment. #397 and #399 already paid that
lower cost without formalizing what makes it safe; this decision is choosing,
going forward, to make that safety a checked property of the plan rather than
a habit a particular run happened to follow.

## What was rejected

- **Always taking a separate approval, as #395 did.** This is the most
  unambiguous shape available — one approval, one plan, one identity — and it
  is what a reader who has not seen #397 or #399 would reach for by default.
  It was rejected because it costs a second gate on every amendment even
  where the amending plan already met every condition the default now
  states — that is, even where the human approving has already read exactly
  what the separate gate would show them a second time. What it bought was
  never in question; the cost of buying it unconditionally, on every
  amendment regardless of how completely the amending plan already disclosed
  the change, is what this decision declines to keep paying.
- **Always bundling, with no conditions.** Rejected because it would let an
  amendment through on a summary of what will change rather than the exact
  text, which is the very ambiguity the revision-digest practice exists to
  prevent.

## Consequences

A plan that amends another issue's already-approved plan now has one
documented disposition instead of two undocumented habits, stated in
[plan-document.md](../../skills/loop-engineering/references/plan-document.md).
Neither #392, #395, #397, nor #399 is reopened, amended, or re-approved by
this decision — it governs practice going forward, and each of those issues
remains readable exactly as it stood when it was approved.

This record supersedes nothing.
