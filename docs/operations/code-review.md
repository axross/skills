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

The [Codex GitHub documentation](https://developers.openai.com/codex/integrations/github/)
identifies `## Code Review Rules` in `AGENTS.md` as its repository-rules hook.
The root [`AGENTS.md`](../../AGENTS.md) uses that heading to route to
[`REVIEW.md`](../../REVIEW.md) and the existing methodology, rather than copy
their checks. A resolvable route is not evidence that the connector traversed
it. The provider documents a native P0/P1-only report. That filter conflicts
with this repository's all-findings contract, independently of custom labels
and format. Keep the contract gate unmet unless permitted provider evidence
demonstrates lower-priority reporting and the retained report shape. A quiet
review alone cannot qualify a capability that could suppress required findings;
historical P2/P3 output likewise does not establish the current filter setting.

## Qualify Codex policy delivery

Qualification separates four observations:

- The source is available.
- The provider loaded the input, when observable.
- Execution completed.
- The published result conforms.

None implies the next. A finding citing a rule proves awareness of that rule,
not traversal of every required reference or check.

For a representative authorized draft review, maintainers MUST:

1. Identify the source material:
   - The actual repository.
   - Base/head commits.
   - Applicable guidance revisions.

   Preserve the exact PR-body snapshot before the request, with its capture time
   and content identity. It proves the stored body at capture time, not the
   body version or full input the provider consumed. Keep the body stable during
   the run where practical; record intervening edits rather than guess fetch time.

2. Follow [GitHub Delivery](./github-delivery.md) for authorization, trigger
   isolation and evidence handling. Use its review-state fields to correlate
   the returned review and comments with the request and reviewed commit.
   Preserve each run stage observable on GitHub. A previous run's output,
   successful CI or trigger reaction alone is not a completed review.
3. Inspect original output against every required REVIEW.md check and
   posted-report rule, following its methodology references. Record conformance
   for each requirement separately; do not translate priorities or manufacture
   a compliant tally.
4. Record actual provider input and configuration only when exposed by permitted
   read-only provider evidence. Distinguish assembled input from references
   actually loaded, including the policy revision used. Mark inaccessible fields
   unknown. Protect sensitive input; restrict public evidence to Delivery's
   correlation metadata.
5. Keep failed output conformance or unavailable required propagation evidence
   as an unmet gate on the draft. Return the specific missing evidence or policy
   decision to the Owner before changing policy or the external control plane.
   Neither a completed run nor another work item's human acceptance
   supplies a permanent exception.

Use discriminating evidence when safe and authorized:

- A real consequential hard-rule miss or opposing applicable guidance tests
  rule selection.
- An unmet, missing or no-line PR criterion tests criterion coverage and placement.
- A no-findings round tests the required empty report.

Inspect each against the retained contract, not merely the presence of a review
or a thumbs-up. Mark cases unexecuted/unqualified when the necessary evidence
cannot be obtained within authorization. Do not introduce production defects or
fabricate findings. Extra test PRs and review effects need their own authorization.

Static heading/link checks, including a missing-target case that must fail,
establish only source routing. They MUST NOT be reported as provider traversal
or live report-conformance checks.

## Review a change to the review arrangement through the session's own route

A change to this document, to [`REVIEW.md`](../../REVIEW.md), to
[`claude-review.yaml`](../../.github/workflows/claude-review.yaml), or to the
skills either route reads is reviewed the same way anything else is: through
whichever route the session's host selects. Neither reviewer executes what the
diff proposes — each reads a pull request — so a proposed change to the review
arrangement is judged from outside itself either way, and no route needs to
stand aside for a change that governs it.

That review does not by itself establish that proposed routing took effect.
Record the available base/head policy revisions and qualify the revision
actually consumed only when observable; otherwise leave it unknown.
