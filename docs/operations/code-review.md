# Code Review

Running `@claude review` — this repository's on-demand reviewer — on any pull
request, who it answers, and the one-time setup it needs before it will run at
all. [`REVIEW.md`](../../REVIEW.md) owns the review policy this reviewer runs;
this document covers only how to invoke it and how it is wired.

## Getting Findings on a Pull Request

Comment **`@claude review`** on a pull request to run this repository's review
policy — severity-tagged findings with `file:line` evidence and concrete
fixes, posted as inline comments by the CI reviewer
([`claude-review.yaml`](../../.github/workflows/claude-review.yaml)). Use it
for a pre-merge check on a hand-written change or a second opinion before
merging. It is the same reviewer the change loop relies on: the loop requests
it by posting that comment itself, so no review starts without one.

## Who It Answers

It answers **repository owners, members, and collaborators only**, gating on
the commenting author's association and skipping everyone else — so an
outside contributor's request looks like nothing happened at all.

## The One-Time Operator Setup

It is inert everywhere until a one-time setup is done: install the
[Claude GitHub App](https://github.com/apps/claude) and add a
`CLAUDE_CODE_OAUTH_TOKEN` repository secret (generate it with
`claude setup-token`), or set an `ANTHROPIC_API_KEY` secret for pay-as-you-go
billing. See the header of `claude-review.yaml` for details.

## Its Optional Telemetry Pair

A third pair of names is optional, and telemetry stays off until it is added.
Set the repository variable `CLAUDE_OTEL_EXPORTER_OTLP_ENDPOINT` and the
repository secret `CLAUDE_OTEL_EXPORTER_OTLP_HEADERS`, and every review
session exports its Claude Code metrics and events to that OTLP collector;
leave them unset and the workflow disables telemetry outright rather than
starting an exporter that fails, so the reviewer behaves exactly as it does
today. The `CLAUDE_` prefix is deliberate: a project cloning this workflow may
already keep `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS`
for its own application telemetry, and neither configuration should overwrite
the other. Scope the ingestion token to writing metrics and logs and nothing
else — the reviewer is allowed broad `Bash`, so it can read any value the job
holds.
