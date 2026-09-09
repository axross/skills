---
status: accepted
---

# Select pre-flight by review need, not implementation actor

## Context

The earlier decision in
`2026-08-06-run-pre-flight-review-whenever-a-reader-qualifies.md` required
pre-flight only after delegated implementation. Delegation was then the normal
implementation path, so the actor condition rarely changed whether a second
reader examined the work. Amp later made direct parent implementation a normal
path. The same condition then allowed otherwise identical work to bypass the
advisory checkpoint solely because of who wrote it.

That result conflicted with the reason for a fresh advisory context. A reader
without the implementer's accumulated reasoning is useful after direct work as
well as delegated work. At the same time, making an unavailable reader a hard
stall would invite either a false self-review substitute or an unnecessary stop
before draft delivery.

## The decision

We removed the implementation-actor condition because fresh review has the same
value after direct and delegated implementation. We retained the
reader-qualification condition because forcing review through an unavailable or
prohibited route would create a capability-dependent stall and encourage
relabeling self-review.

The host continues to select and qualify the actual reader mechanism. The
portable loop and project policy define the checkpoint and evidence, not a
universal tool or a requirement to delegate implementation.

## What was rejected

- **Keep the delegated-only condition.** This makes review coverage depend on
  an implementation routing choice rather than on the value of fresh review.
- **Require pre-flight when no reader qualifies.** This turns an advisory stage
  into a capability-dependent stall and encourages a parent to relabel its own
  self-review.
- **Replay pre-flight before every later push.** This merges the initial
  advisory checkpoint with the post-delivery external addressing loop and
  confuses their separate evidence and round budgets.
- **Mandate one reviewer tool.** Host permissions and tool purposes differ; a
  portable decision cannot make an unavailable or prohibited mechanism valid.

## Consequences accepted

Direct implementations now incur the same potential advisory review cost as
delegated implementations. The existing severity vocabulary, finding
dispositions, fresh-round rules, review/fix cap and external-review requirement
remain unchanged. The superseded decision stays as the record of why the actor
condition was previously retained.
