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
| Authorization        | Operation targets, route/lifetime, human evidence, limits and exclusions                                                                      |
| Execution            | Assignment scope and revision, execution mode/status, attempt count, self-review status and permitted evidence locator, latest result locator |
| Actual material      | Commit/revision, uncommitted files or retrievable diff, evidence locators                                                                     |
| Verification         | Commands and outcomes, skipped checks and residual risk, CI/check locators                                                                    |
| Review               | Round, route, trigger/run/result identities and permitted durable findings                                                                    |
| Waiting              | Waiting state, unresolved question or authorization, next action                                                                              |
| Recovery             | Partial effects and object IDs, unknown effects, remaining processes and retrievable materials                                                |

Keep `Approval` and `Authorization` separate. Each authorization record is a
compact prose entry, not a new schema: name the repository, branch and PR;
permitted operations; human-evidence locator; provider route and lifetime;
limits; and exclusions. Compare all of those fields before using a recovered
grant. A session or phase change does not expire a matching grant, while a
changed PR, route, lifetime, limit or operation requires authorization only for
the difference. Do not add an exact-head field: reviewed-snapshot and material
currency evidence stays separate from authorization scope.

For a Codex Action request, the authorization record MUST name the exact trigger
and its Issue-body context access, API-billed model execution and sanitized bot
publication. Its limit says either one request or the remaining requests through
Loop's four-round external cap. That work-item grant does not include secret or
variable creation, workflow enablement, bot allowlisting, fork/private policy,
spend or retention settings, production qualification, ready transition, merge,
release, deployment or scheduling unless the human separately names the effect.

The `Review` entry records only safe correlation metadata: trigger comment ID
and actor, workflow run ID and attempt, reviewed snapshot, sanitized result
locator and the last observed stage. Put partial or unknown effects in
`Recovery`. Neither entry carries Issue text, a sidecar path as a durable
retrieval promise, credentials, raw API/model output or rejected output.
These field-specific least-data constraints do not remove other substantive
material from a permitted internal plan or handoff that Loop requires.

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
criteria or a replacement for fresh advisory or external-review input.

## Publish deferred pre-flight handoffs

An informed decline produces a substantive terminal handoff as well as a safe
delivery projection. They remain separate because the draft pull request (PR)
is one of the Codex Action design's restricted surfaces, while the Action reads
the tracking Issue body rather than its comments.

**Guidelines:**

- MUST publish one `<!-- ai-agent -->` tracking-Issue comment for each informed decline when that effect is authorized. Identify it as deferred pre-flight handoff evidence, not canonical requirements or review input.
- MUST retain in that comment the advisory round and reviewed material identity; each finding's ID, severity, code citation, substance, suggested fix and `deferred` disposition; the decision reason and supporting evidence; and locators for the human decision and canonical Issue.
- MUST preserve corrections to a substantive handoff in later marked comments rather than overwriting the evidence the human received.
- MUST put only the publication-safe projection in the draft PR's **Risks and breaking changes** section and compact handoff status and locators in its state block. For each finding, retain the ID, severity, code citation, code-observed risk, `deferred` state, valid requirement identifier or locator, substantive-record locator and human-decision locator.
- MUST build the projection only from code observations, process facts and valid locators. Never quote, summarize or paraphrase Issue text or expected behavior; when the safe fields cannot convey the risk or a valid locator is unavailable, publish only the available locators and limitation rather than inventing a safe paraphrase.
- MUST NOT use the Codex Action result marker or impersonate its bot for this handoff, feed the tracking-Issue comment to a fresh advisory assignment, or treat the comment as replacement Action input. Public readability does not imply reviewer invisibility.
- MUST treat the Issue comment and PR updates as separate effects under the recovered operation grant. Without authorization, retain the full ledger in the current permitted internal handoff, report its substance and the exact blocked effects to the human, and keep delivery incomplete; an orb-local artifact is not a durable substitute.
- MUST route missing substantive handoff evidence through Loop's [Deferred Handoff](../../skills/loop-engineering/references/pre-flight-review.md#deferred-handoff) recovery contract; Delivery adds only verified GitHub process and decision locators and blocked publication effects.

### Extract the state block without reading the whole body

For a status-only read, extract from the first opening token through its closing
token and stop; do not bring the plan and archive into context merely to read
the state. A missing or truncated block requires a faithful read, not an
assumption that no run exists.

The extraction has to be **non-greedy and newline-crossing**, and it has to take
the _first_ match. Because `loop-engineering` is also a skill name, the token
recurs legitimately in the prose of any body whose plan discusses the loop — so
it is the block's first-element position, not the token alone, that identifies
it. Where the established byte-faithful route is a command line built on jq's
`match` filter, the form that holds is
`match("(?s)<!-- loop-engineering.*?-->")`, with `(?s)` written as an inline
group inside the pattern rather than passed as a separate flag argument. That
spelling is jq's; an engine expressing the same mode as a flag on the pattern,
such as JavaScript's `s`, needs it there instead.

**Guidelines:**

- MUST NOT extract the block with a line-range selection such as `sed -n '/<!-- loop-engineering/,/-->/p'`. A range does not close on the line that opened it, so a single-line block runs the selection on to the next `-->` elsewhere in the body and returns unrelated text with no error raised. It works for exactly as long as the block stays multi-line, and fails silently the first time it does not.
- MUST fall back to the full stored body when a narrowed read returns nothing, rather than concluding from that alone that the body carries no state — the body may predate the token, or the route may have degraded.
- MUST read the whole stored body, never the narrowed block, on a turn that will write the body back and cannot compose the new body from text the run itself authored. A body write replaces the body entire, and a narrowed read cannot reconstruct what it never read. Bounded extraction serves only the read-only case, such as a resume recovering phase and waiting state.
- MUST use the full-body procedure in [GitHub Operation's body-integrity reference](../../skills/github-operation/references/body-integrity.md) for any replacement; bounded extraction is never the input for a whole-body write.

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
| Substantive deferred pre-flight handoff                           | Marked tracking-Issue comment                                                   |
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

## Recover Codex Action review effects

Before posting another exact Codex command, correlate the authenticated trigger
comment, workflow run and attempt, reviewed snapshot, and bot-owned sanitized
result using [Code Review](./code-review.md)'s provider identities. Keep the
stages distinct: a stored trigger with no started run is not completion, a
failed run can have no result comment, and a mutable summary tied to an older
run does not complete the current request. A publisher failure also leaves the
model result and published-result stages different.

Discovery and correlation establish what happened; they do not authorize a
retry. Post another trigger only when the intended effect is confirmed absent,
the prior outcome is no longer unknown, and the recovered authorization still
covers another request within its limit. Otherwise continue from the correlated
object or report the exact failed, partial, outcome-unknown, or
authorization-waiting state.

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
