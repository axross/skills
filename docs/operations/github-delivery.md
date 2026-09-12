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

Refine the issue title to name the concrete deliverable in the same write that
records the plan. The title a free-form request or an early investigation
arrived under rarely survives planning intact, and it is what every later
reader of a list, a link, or a notification sees instead of the plan body.

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

For an external review request, the authorization record MUST name the exact
trigger and its limit — either one request or the remaining requests through
Loop's four-round external cap. That work-item grant does not include secret or
variable creation, workflow enablement, bot allowlisting, fork/private policy,
spend or retention settings, ready transition, merge, release, deployment or
scheduling unless the human separately names the effect.

The `Review` entry records only safe correlation metadata: trigger comment ID
and actor, workflow run ID and attempt, reviewed snapshot, sanitized result
locator and the last observed stage. Put partial or unknown effects in
`Recovery`. Neither entry carries Issue text, credentials, raw API/model output
or rejected output.
These field-specific least-data constraints do not remove other substantive
material from a permitted internal plan or handoff that Loop requires.

Loop owns the conditions under which finding details persist, including
[advisory-review parks](../../skills/loop-engineering/references/pre-flight-review.md).
This representation MUST NOT expand that ledger's durability or replace
lost evidence with a claim of success. Record only process information needed
for recovery, without credentials or transient worker handles.

Keep the substantive executor self-review outcome, unresolved findings and
limitations in a permitted internal handoff, and link the delivery target to
that record. What lands on the delivery target is recovery evidence, not a
replacement for fresh advisory or external-review input; the acceptance criteria
the review is checked against are the projection this document routes to the
PR's **Acceptance criteria** section, which is a different thing from a
self-review handoff.

## Publish deferred pre-flight handoffs

An informed decline ends an advisory round with risks still open, and Loop's
[Deferred Handoff](../../skills/loop-engineering/references/pre-flight-review.md#deferred-handoff)
contract requires that record to reach the human. It goes on the delivery
target. This repository used to split it in two — a substantive record on the
tracking Issue and a redacted projection on the pull request — because the
review route then under consideration read the Issue and treated the pull
request as a surface its requirements must not reach. No route here imposes
that now, and one record the human can read beats two neither is complete.

**Guidelines:**

- MUST publish one `<!-- ai-agent -->` PR comment for each informed decline when that effect is authorized, identifying it as deferred pre-flight handoff evidence rather than canonical requirements or review input.
- MUST retain in that comment the advisory round and reviewed material identity; each finding's ID, severity, citation, substance, suggested fix and `deferred` disposition; the decision reason and supporting evidence; and locators for the human decision and the tracking Issue.
- MUST preserve corrections in later marked comments rather than overwriting the evidence the human already received.
- MUST keep compact handoff status and locators in the PR's state block, so a resumed run finds the record without reading every comment.
- MUST treat publication as an effect under the recovered operation grant. Without authorization, retain the full ledger in the current permitted internal handoff, report its substance and the exact blocked effect to the human, and keep delivery incomplete; an orb-local artifact is not a durable substitute.
- MUST NOT feed the comment to a fresh advisory assignment or treat it as replacement input for mandatory external review; public readability does not imply reviewer invisibility.
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
   Put `Closes #<issue-number>` in its **Related issues** section, and the
   approved plan's diff-verifiable acceptance criteria, quoted verbatim with
   their status and the plan revision they were copied from, in its
   **Acceptance criteria** section. Reviewers here work from the PR alone, so a
   criterion missing from that section is a criterion nobody checks, and a
   projection naming a superseded revision is stale rather than approved.
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

| Content or operation                      | Destination                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Plan, plan questions, amendments          | Tracking issue                                                           |
| Current run state                         | Issue before PR creation; PR afterward                                   |
| Substantive deferred pre-flight handoff   | Marked PR comment; locators in the state block                           |
| Acceptance criteria and their status      | PR **Acceptance criteria**, quoted verbatim, naming the plan revision    |
| Manual checks and before/after visuals    | PR **Acceptance criteria**, beside the criteria they bear on             |
| Skipped required checks and residual risk | PR **Risks and breaking changes**                                        |
| Verification commands and their outcomes  | The session report; the state block keeps the evidence locators          |
| Independent review request                | Dedicated marked PR comment carrying the trigger phrase and nothing else |
| Fix evidence and finding reply            | The finding's PR review thread                                           |
| Draft/ready status and PR metadata        | The PR, never the tracking issue                                         |

[Code Review](./code-review.md) owns both configured reviewers, each one's exact
invocation, eligibility, and setup — one of them runs here in CI and the other
does not. [REVIEW.md](../../REVIEW.md) owns severity and output
policy. Delivery MUST use that invocation only when the review request is
authorized; preparing its comment does not publish it.

Finding replies MUST identify the fixing commit with `Resolved in <short-hash>`
(link the commit), normally followed by one sentence. Resolve the corresponding
thread after posting the reply. Keep fuller reasoning only for a fix whose hash
alone would leave the commenter unable to tell what happened — the fix diverges
from what the comment proposed, the finding was addressed only in part, or the
fix landed away from the line the comment anchors to. That extra room MUST NOT
be spent restating the finding, re-explaining why it mattered, or recounting
verification the pull request already records. The finding thread, not an
unrelated issue comment, is the evidence target.
A finding the reviewer raises in its summary rather than on a diff line has no
thread to reply on; record its fix or explicit dismissal in the current review
state and use the next review's summary as rerun evidence.

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

When external writes are not authorized or no permitted route can perform them,
return prepared content and the exact blocked operation to the human. Do not
silently store required issue/PR state only in an orb-local file and call the
delivery gate satisfied.
