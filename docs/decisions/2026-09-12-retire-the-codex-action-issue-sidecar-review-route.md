---
status: accepted
---

# Retire the Codex Action Issue-sidecar review route

## Context

The route existed to solve one problem: a static reviewer needs the change's
requirements, and those requirements lived in a tracking Issue whose prose the
reviewer's output must never republish. Everything the route was built from
followed from that. A trusted helper resolved the one closing Issue and wrote
its canonical body into a private directory under `$RUNNER_TEMP` with `0700`
and `0600` modes. The prompt carried procedure and paths but no Issue prose. A
validator rejected any publishable text reproducing eight consecutive tokens or
a sixty-code-point substring of the requirements, and only its base64-encoded
sanitized payload reached a separately permissioned publisher job holding no
Issue body and no model credential. `REVIEW.md` carried a provider-specific
output contract for it — P0–P3 in place of Important/Nit, a requirement
identifier in place of a quoted expectation, no proposed fix — because a
finding that quoted what it was checking against would have been rejected by
the validator protecting the Issue.

`2026-09-12`'s change to the delivery target removed the premise. A pull
request now carries the acceptance criteria a review is checked against,
quoted verbatim from the approved plan. A reviewer with the pull request has
the requirements, and the elaborate machinery for handing them over privately
is guarding text published two sections above the diff.

The route had also never run. It was gated behind `CODEX_ACTION_REVIEW_ENABLED`
and a model variable, neither set, and its own documentation required a live
production qualification — logs, canaries, fork and private-repository
behaviour, retention, spend, bot policy — that never happened.

## Decision

Retire it. The workflow, its five trusted helpers, and the four test files
holding them to their contract are deleted, and `@claude review` is the one
external review route. What the route's existence had shaped elsewhere is
unwound with it: `REVIEW.md` loses its provider-specific output exception,
`github-delivery.md` loses the Codex authorization record, the marker exception
for a comment body that had to equal `/codex-action-review` exactly, and the
recovery procedure for correlating a trigger against a run against a mutable
summary.

One consequence is worth naming on its own, because it is a simplification
rather than a deletion. The deferred pre-flight handoff was split in two — a
substantive record on the tracking Issue, a redacted projection on the pull
request — solely because the pull request was a surface the Issue's
requirements must not reach. With no such surface, the substantive record goes
on the pull request, where the human reading the change already is.

## Alternatives rejected

**Rebuild the route to read the pull request body.** The requirements are on
the pull request now, so the sidecar could have been replaced by a read of the
body. Rejected on cost against benefit: it is roughly 1,600 lines of trusted
helper and 1,700 lines of test to rewrite, in review-control infrastructure, to
re-enable a route that has never passed the qualification its own documentation
requires — and the confidentiality apparatus that made it expensive was the
part being made pointless.

**Keep it disabled and untouched.** Rejected because a disabled route is not
free. It kept a provider-specific output contract in `REVIEW.md`, a marker
exception and a recovery procedure in `github-delivery.md`, a route-selection
mechanism in `development-workflow.md`, and a stage progression in
`amp-execution.md` — all describing an arrangement no session can reach, and
all of which a reader must first understand in order to discover it does not
apply to them.

## Consequences accepted

There is one external reviewer, so an unavailable Claude route leaves the
independent-review gate unmet with nothing to fall back to. That was already
true — `development-workflow.md` forbade automatic fallback, and the Codex
route was never enabled — but the retirement removes the option of enabling one
without building it again.

A second provider's independent perspective is given up, along with the
static-analysis review shape the route would have produced. Reinstating either
means a new decision and a new build; this record is the account of what that
build was for.
