# Code Review

This repository has two external review routes, and a session picks between
them by the host it runs in rather than by the change in front of it. Both
reviewers work from the pull request, so neither is narrower in what it may
review. [`REVIEW.md`](../../REVIEW.md) owns the review policy and the output
contract; this document owns invocation, setup, and failure handling.

| Session host | Trigger          | Answers as                     | Runs from                                                               |
| ------------ | ---------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Claude Code  | `@claude review` | `claude[bot]`                  | [`claude-review.yaml`](../../.github/workflows/claude-review.yaml) here |
| Codex, Amp   | `@codex review`  | `chatgpt-codex-connector[bot]` | The Codex GitHub integration, configured outside this repository        |

A route that fails or is unavailable grants no automatic fallback to the other.
If the route the session's host selects cannot be obtained and no human
explicitly replaces it, record the unmet independent-review gate.

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

## Run the Codex reviewer

Comment `@codex review` on a pull request. The Codex GitHub integration answers
as `chatgpt-codex-connector[bot]`, posting a summary comment carrying the
`<!-- codex-pull-request-review-summary -->` marker, with its findings as an
ordinary pull-request review.

Nothing in this repository runs it. The route is added to the organization or
repository from Codex's own settings, which means enabling, disabling, or
reconfiguring it is not a change to this tree and leaves no trace in it. A
review that never arrives is a question for those settings before it is a
question for anything here.

Codex's documented hook for repository-specific review rules is a
`## Code Review Rules` section in the `AGENTS.md` nearest the code. This
repository carries no such section, so the Codex reviewer reaches
[`REVIEW.md`](../../REVIEW.md) through
[`AGENTS.md`](../../AGENTS.md)'s ordinary review routing instead of through
that hook. That is a known gap rather than an oversight: it is worth revisiting
if a Codex review is ever observed missing a rule `REVIEW.md` states.

## Review a change to the review arrangement through the session's own route

A change to this document, to [`REVIEW.md`](../../REVIEW.md), to
[`claude-review.yaml`](../../.github/workflows/claude-review.yaml), or to the
skills either route reads is reviewed the same way anything else is: through
whichever route the session's host selects. Neither reviewer executes what the
diff proposes — each reads a pull request — so a proposed change to the review
arrangement is judged from outside itself either way, and no route needs to
stand aside for a change that governs it.
