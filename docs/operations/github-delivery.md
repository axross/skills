# GitHub Delivery

This procedure tells maintainers how to store and publish this repository's
change-loop records. It assumes a tracked change and the applicable gates in
[Development Workflow](./development-workflow.md). It does not choose a host
tool, grant authorization, or define the meaning of a phase.

Before a GitHub operation, apply [GitHub Operation](../../skills/github-operation/SKILL.md)
for channel qualification, identity, target validation, body fidelity, and
read-back. Host guidance refers to that capability rather than copying API
rules. Before evaluating a transition, apply
[Loop Engineering](../../skills/loop-engineering/SKILL.md); the storage below
encodes its contracts without replacing them.

## Store the plan on the issue

The tracking issue body MUST hold the canonical plan. Plan clarification,
amendment, and approval activity stays on that issue even after a pull request
(PR) exists. Store the plan revision and a locator for the actual human approval
in the state block; a conversation approval can be linked rather than reposted
as though the agent were the human.

When replacing an original description with a plan, preserve that description
verbatim inline or in a marked archival comment. An inline archive SHOULD use a
collapsed `<details>` section after the plan; an archival comment MUST be
verified before removing the original from the body, with its URL retained in
the issue. Archive and state placement follow
[Loop's plan-identity boundary](../../skills/loop-engineering/references/plan-document.md).

## Encode recoverable state in the body

The current delivery target MUST begin with a `<!-- loop-engineering` HTML
comment ending in `-->`: the issue before a PR exists, the PR afterward. Keep
status in this block and in the conversation, not in separate attention
comments. Ephemeral worker handles stay in the session, not in GitHub.

The block carries ordinary labeled text, not a new machine schema. Map the
[semantic run state](../../skills/loop-engineering/references/run-state-and-reporting.md)
into these fields, including conditional evidence only when relevant:

| Contract information | Stored representation                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Target and phase     | Issue/PR locators, branch, phase                                                                                                              |
| Approval             | Canonical plan locator, revision identity, approval evidence                                                                                  |
| Execution            | Assignment scope and revision, execution mode/status, attempt count, self-review status and permitted evidence locator, latest result locator |
| Actual material      | Commit/revision, uncommitted files or retrievable diff, evidence locators                                                                     |
| Verification         | Commands and outcomes, skipped checks and residual risk, CI/check locators                                                                    |
| Review               | Round, result locator, open finding IDs/severities/citations when durable storage is permitted                                                |
| Waiting              | Waiting state, unresolved question or authorization, next action                                                                              |
| Recovery             | Partial effects and object IDs, unknown effects, remaining processes and retrievable materials                                                |

Loop owns the conditions under which finding details persist, including
[advisory-review parks](../../skills/loop-engineering/references/pre-flight-review.md).
This representation MUST NOT expand that ledger's durability or replace
lost evidence with a claim of success. Record only process information needed
for recovery, without credentials or transient worker handles.

Keep the substantive executor self-review outcome, unresolved findings and
limitations in a permitted internal handoff. When the selected reviewer contract
restricts Issue-derived text on the current delivery surface, project only code
or process observations and requirement identifiers or locators onto that
surface. Do not quote, summarize or paraphrase Issue requirements. Link to the
permitted substantive record when one exists, and report when the projection
cannot carry enough context. The projection is recovery evidence, not canonical
criteria or input to an advisory or external reviewer.

For a status-only read, extract from the first opening token through its closing
token and stop; do not bring the plan and archive into context merely to read
the state. A missing or truncated block requires a faithful read, not an
assumption that no run exists. For any replacement, use the full-body procedure
in [GitHub Operation's body-integrity reference](../../skills/github-operation/references/body-integrity.md).
Bounded extraction is never the input for a whole-body write.

## Hand state over to the pull request

Once publication is authorized, use this order to avoid leaving two competing
records or recreating an existing PR after interruption:

1. Check for an existing PR for the branch and tracking issue. Recover that
   target if found rather than creating another.
2. Prepare the PR with the current state block, a pointer to the issue's plan
   and approved revision, and [the repository's PR template](../../.github/pull_request_template.md).
   Put `Closes #<issue-number>` in its **Related issues** section.
3. Publish the PR in draft and verify its actual body, head branch/revision,
   linked issue, and draft status through the qualified route.
4. Point the issue's state block at the verified PR. From that point, update
   current run state on the PR; the issue remains the plan's owner.

If publication succeeds but the issue pointer update fails, the PR is still
the delivery target. Record the partial result and recover from its verified
object ID or URL. A stale issue-side block MUST NOT restart planning or replace
PR-side state. Use GitHub Operation's outcome checks to establish uncertain
writes before continuing this handover.

## Route evidence and review activity

Use the following destinations after resolving the target under GitHub Operation:

| Content or operation                                              | Destination                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Plan, plan questions, amendments                                  | Tracking issue                                                                  |
| Current run state                                                 | Issue before PR creation; PR afterward                                          |
| Verification commands, outcomes, acceptance status, residual risk | PR **Verification** and applicable risk sections; state block links to evidence |
| Independent review request                                        | Dedicated marked comment, except the exact Codex command described below        |
| Fix evidence and finding reply                                    | The finding's PR review thread                                                  |
| Draft/ready status and PR metadata                                | The PR, never the tracking issue                                                |

[Code Review](./code-review.md) owns the configured CI reviewer, exact invocation,
eligibility, and setup. [REVIEW.md](../../REVIEW.md) owns severity and output
policy. Delivery MUST use that invocation only when the review request is
authorized; preparing its comment does not publish it.

Finding replies MUST identify the fixing commit with `Resolved in <short-hash>`
(link the commit), normally followed by one sentence. Resolve the corresponding
thread after posting the reply. Keep fuller reasoning only where the fix needs
it; the finding thread, not an unrelated issue comment, is the evidence target.
The Codex Action summary has no inline finding threads, so record each
observation's fix or explicit dismissal in the current review state and use the
next correlated summary as rerun evidence.

The PR stays draft until Loop's
[readiness evaluation](../../skills/loop-engineering/references/independent-review.md)
succeeds. Publish an authorized ready transition only with that evidence, and
leave merging to the human under Development Workflow. If a policy-compliant
independent review cannot be established, record the actual unmet gate on the
PR and keep it draft. An unrelated review defect is neither a new acceptance
criterion nor permission to weaken review policy.

## Use the repository's comment marker

This repository's fixed marker for new agent comments is `<!-- ai-agent -->`.
Recognize the retired `<!-- claude-code -->` marker as agent output on historical
issues and PRs, but never use it for a new comment. GitHub Operation owns the
attribution test and trigger-isolation rule; these are the repository's marker
values, not a second attribution policy.

The sole exception is the Codex Action command channel. Its entire comment body
MUST equal `/codex-action-review`, so the request intentionally carries no
agent marker. Attribute that request through its GitHub comment ID, actor,
workflow run ID, and run attempt. The publisher's separate result comment MUST
use `<!-- codex-action-issue-sidecar-review -->` and MUST be owned by
`github-actions[bot]`. This exception does not apply to status comments, other
automation commands, or ordinary agent output.

When external writes are not authorized or no permitted route can perform them,
return prepared content and the exact blocked operation to the human. Do not
silently store required issue/PR state only in an orb-local file and call the
delivery gate satisfied.
