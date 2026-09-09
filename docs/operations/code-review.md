# Code Review

This repository retains the Claude pull-request reviewer and includes a
disabled Codex Action Issue-sidecar reviewer. [`REVIEW.md`](../../REVIEW.md)
owns their shared review policy and provider-specific output contracts. This
document owns invocation, trusted execution, setup, and failure handling.

## Choose the configured review route

The two external review routes have different contracts:

| Route        | Use                                                        | Invocation                             | Completion evidence                                                                             |
| ------------ | ---------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Claude       | Ordinary and control-plane pull-request review             | Comment `@claude review`               | Inline comments and one summary comment from the configured CI reviewer                         |
| Codex Action | Static Issue-sidecar review after production qualification | Comment exactly `/codex-action-review` | One bot-owned summary tied to the trigger comment, workflow run, attempt, and reviewed snapshot |

An explicit route selection MUST record its scope and lifetime in the current
change-loop state. A host switch MUST preserve that selection until its stated
lifetime ends or a human replaces it. A blocked or failed Codex run MUST NOT
fall back to Claude automatically.

## Run the retained Claude reviewer

Comment `@claude review` on a pull request to run
[`claude-review.yaml`](../../.github/workflows/claude-review.yaml). The target
is that pull request, and the reviewer reads `REVIEW.md` as its
highest-priority review policy. Completion consists of severity-tagged inline
findings with `file:line` evidence and concrete fixes, plus one summary comment.
The review is advisory and never posts an approval or request-changes verdict.

The workflow answers repository owners, members, and collaborators only. An
outside contributor's request is a no-op. The trigger uses phrase containment,
not the Codex route's exact-command rule.

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

## Keep the Codex route disabled until qualification

[`codex-action-review.yaml`](../../.github/workflows/codex-action-review.yaml)
does not run model work unless `CODEX_ACTION_REVIEW_ENABLED` equals `true` and
`CODEX_ACTION_REVIEW_MODEL` is nonempty. Production setup also requires an
`OPENAI_API_KEY` repository secret. `CODEX_ACTION_REVIEW_ALLOWED_BOT` MAY name
one exact bot identity; an empty value authorizes no bot.

Enabling the route requires explicit infrastructure authorization and prior
live qualification. Qualification MUST cover Action and command-line logs,
compliant and violating canaries, fork and private-repository behavior, data
retention, spend limits, and the approved bot and priority policies. Adding a
secret or variable does not itself supply that authorization or evidence.

## Invoke the Codex route exactly

Create a pull-request comment whose entire body is
`/codex-action-review`. Leading or trailing text, an agent marker, and an
ordinary Issue comment are no-ops. The workflow admits repository owners,
members, and collaborators. It excludes all bots unless the actor exactly
matches the configured bot variable.

Requests for one pull request run serially and do not cancel an in-flight
request. The workflow run remains discoverable for denied execution and other
failures even when no review summary is published.

## Understand the Codex trust boundary

The review job constructs static inputs before starting Codex:

1. It checks out trusted controls from the default branch and the pull
   request's merge snapshot into separate directories without persisted Git
   credentials.
2. A trusted helper derives the changed-path list and static patch from the
   same merge snapshot and its base parent. Any review-control change, missing
   merge snapshot, or malformed identity stops before Issue-body or model
   access.
3. The helper records line bounds from the snapshot or base tree only for
   bounded regular UTF-8 text files. A non-addressable changed file requires a
   `blocked` result. The helper then deletes the pull-request checkout before
   Codex starts.
4. The helper resolves exactly one open, native, same-repository closing Issue
   through GitHub's relationship API. It writes the canonical body and minimal
   identity metadata to a unique private directory under `$RUNNER_TEMP` with
   `0700` directory and `0600` file modes.
5. The prompt directs the pinned Codex Action to inspect only trusted policy
   files, the static patch, the Issue sidecar, and trusted context metadata.
   The Action uses the pinned read-only permission profile, removes sudo, and
   starts an ephemeral session.
6. A trusted validator checks identity, schema and status consistency,
   paths, line bounds, requirement references, output bounds, disclosure, and
   Markdown encoding. Only its base64-encoded sanitized payload enters the
   separately permissioned publisher job.
7. An always-running cleanup step removes the private directory on a
   best-effort basis. The workflow uploads no sidecar, raw result, cache, or
   step summary.

The prompt contains procedure, numeric target metadata, and private paths. It
does not contain Issue prose. The Issue body is the sole product-requirements
input; pull-request text and comments never replace it.

The model job has no GitHub write token. The publisher has no Issue body, raw
model result, or OpenAI credential. It creates or updates the sole summary
whose `<!-- codex-action-issue-sidecar-review -->` marker is owned by
`github-actions[bot]`, then reads the stored bytes back.

## Treat confidentiality controls as bounded

The sidecar is ephemeral transport, but the Issue body necessarily reaches
OpenAI. Repository operators MUST evaluate the provider's retention and data
controls before enabling the route.

The validator rejects normalized copies of eight consecutive tokens and
substrings of 60 Unicode code points across all publishable free text. Those
checks do not prove that a semantic paraphrase contains no requirement
information. If stronger confidentiality is required, keep this route disabled
until the output contract is replaced with fixed codes only.

A downstream validator also cannot retract text that the Action or Codex
command has already written to a workflow log. Local tests establish the
validator boundary but not upstream log behavior. Production qualification
MUST audit logs and failure paths for the pinned Action and Codex versions
before claiming that Issue content cannot be published.

## Interpret Codex outcomes

The Codex result and workflow outcome remain distinct:

- `clean` means the static reviewer returned zero findings for the supplied
  snapshot.
- `findings` means the summary contains one or more P0–P3 observations with a
  changed path, line range, and validated requirement identifier or sidecar
  locator.
- `blocked` means the model lacked semantic static context and selected one of
  the fixed blocked reasons.
- A preparation, model, validation, or publication failure is a failed
  workflow run, not a `blocked` model result. Invalid or disclosing raw output
  is withheld.
- An unauthorized, malformed, disabled, or non-pull-request trigger is a no-op
  with no summary.

Until an approved priority threshold replaces the conservative policy, every
`findings` or `blocked` result is non-clean and cannot satisfy readiness.
Address or explicitly dismiss every observation in change-loop state, then
request a new review after fixes. A `clean` result qualifies only when this
route is both enabled and independently production-qualified.

## Read snapshot evidence narrowly

The Codex summary names the reviewed merge-snapshot commit. It does not claim
coverage of the pull request's current head. The workflow deliberately has no
start/end head-equality check, head-change invalidation, or Issue/head composite
approval identity.

Concurrent updates can race a review to completion. Serialize requests
operationally and request another review after material changes. Record the
actual snapshot as evidence rather than rewriting it as exact-current-head
coverage.

## Review control-plane changes through Claude

The Codex route blocks changes to its workflow, trusted helpers, review policy,
routed skills, verification controls, nested agent instructions, and the
retained Claude control route before model execution. Review those
control-plane changes through the existing `@claude review` route. The initial
Codex bootstrap follows the same rule because a proposed workflow cannot
certify itself.

If the Claude route is unavailable, the independent-review gate remains unmet.
Do not relabel a local self-review as independent review and do not treat the
blocked Codex run as permission to switch providers.
