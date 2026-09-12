# Code Review

This repository's one external review route is the Claude pull-request
reviewer. [`REVIEW.md`](../../REVIEW.md) owns the review policy and the output
contract; this document owns invocation, setup, and failure handling.

## Run the Claude reviewer

Comment `@claude review` on a pull request to run
[`claude-review.yaml`](../../.github/workflows/claude-review.yaml). The target
is that pull request, and the reviewer reads `REVIEW.md` as its
highest-priority review policy. Completion consists of severity-tagged inline
findings with `file:line` evidence and concrete fixes, plus one summary comment.
The review is advisory and never posts an approval or request-changes verdict.

The workflow answers repository owners, members, and collaborators only. An
outside contributor's request is a no-op. The trigger uses phrase containment,
so a comment carrying the phrase alongside other text still fires it — which is
why the request is posted as a comment of its own.

The Claude route is inert until an operator installs the
[Claude GitHub App](https://github.com/apps/claude) and adds the
`CLAUDE_CODE_OAUTH_TOKEN` repository secret. Generate that token with
`claude setup-token`. Pay-as-you-go operation instead requires an
`ANTHROPIC_API_KEY` secret and the corresponding workflow input change.

Optional telemetry requires both the
`CLAUDE_OTEL_EXPORTER_OTLP_ENDPOINT` repository variable and the
`CLAUDE_OTEL_EXPORTER_OTLP_HEADERS` repository secret. If the endpoint is
unset, the workflow disables telemetry. Scope the ingestion token to writing
metrics and logs only because the reviewer has broad `Bash` access.

## Review changes to the review arrangement through the same route

A change to this document, to [`REVIEW.md`](../../REVIEW.md), to
[`claude-review.yaml`](../../.github/workflows/claude-review.yaml), or to the
skills it routes to is still reviewed through `@claude review`. A proposed
change cannot certify itself, and this route reviews a pull request's diff
rather than executing what that diff proposes, so it judges such a change from
outside it.

If the Claude route is unavailable, the independent-review gate remains unmet.
Do not relabel a local self-review as independent review.
