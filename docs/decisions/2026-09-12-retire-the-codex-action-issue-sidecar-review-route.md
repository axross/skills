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

The route had also never run, for a reason worth recording before the file
carrying it disappears. Beyond the `CODEX_ACTION_REVIEW_ENABLED` and model
variables it was gated behind, and the live production qualification its own
documentation required and never received, the workflow file was **invalid**.
Its review job set `REVIEW_DIRECTORY: ${{ runner.temp }}/…` in a job-level
`env:` block, and GitHub Actions does not expose the `runner` context at job
scope. Every one of its 26 recorded runs therefore ended `failure` with zero
jobs started, annotated `Unrecognized named-value: 'runner'`. The route could
not have executed even with its variables set and its qualification done.

## Decision

Retire the workflow. It, its five trusted helpers, and the four test files
holding them to their contract are deleted.

What is retired is a workflow, not Codex as a reviewer. `@codex review` is a
different mechanism that shares only a vendor's name: the Codex GitHub
integration, answering as `chatgpt-codex-connector[bot]`, configured outside
this repository and needing nothing in it. It is in live use here and is what a
Codex or Amp session requests. Both routes survive, and a session still picks
between them by its host.

What the deleted route's existence had shaped elsewhere is
unwound with it: `REVIEW.md` loses its provider-specific output exception,
`github-delivery.md` loses the Codex authorization record, the marker exception
for a comment body that had to equal `/codex-action-review` exactly, and the
recovery procedure for correlating a trigger against a run against a mutable
summary. `REVIEW.md`'s exception described the Action's sanitized output, not
Codex's: the connector posts an ordinary review and needs no exception.

The deferred pre-flight handoff's two-record shape goes with it, and
`github-delivery.md` states what replaces it. It is named here only because the
shape looks like a deliberate safeguard being removed, and was not: it was a
consequence of this route, and it outlived nothing else.

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

What is given up is a review _shape_, not a second provider. The Action would
have produced a static, sanitized review — findings carrying a priority, a path
and line range, and a requirement identifier, with no quoted expectation and no
proposed fix — and, more to the point, a review that never handed the project's
requirements to the provider at all. That confidentiality posture is gone.
Carrying acceptance criteria on the pull request already gave it up: the
criteria are published in the repository now, so a reviewer reading the pull
request reads them. A project that later needs a reviewer it can withhold
requirements from will have to build that again, and this record is the account
of what the build was for.

Two external routes remain, so an unavailable route still leaves the
independent-review gate unmet with nothing to fall back to — the
no-automatic-fallback rule predates this change and is unaffected by it.
