# Development Workflow

How a maintainer carries a change through this repository's required gates.
[Loop Engineering](../../skills/loop-engineering/SKILL.md) owns phase meaning
and evidence contracts; this document records the repository's choices and
the configured actors. Host instructions and tool usage conditions govern
execution, not the names of those actors.

## The Change Loop

Every change MUST retain the repository's issue, recorded plan, human plan
approval, verified implementation, draft pull request, independent review,
addressing, and ready gates. A read-only question, investigation, or review
does not enter them. Name an issue, a pull request, or a free-form change to
start; resume at the recorded pending phase rather than starting again.

These gates apply to every change, without a size threshold or self-approval
shortcut, including headless sessions. If authorization or a permitted route
is missing, record the unmet gate rather than waiving it. At completion, MUST
identify the tracking issue, pull request when one exists, and independent
review outcome; an absent PR or review is an unmet gate, not a clean result.

The [migration map](./loop-migration.md) records topic ownership, rollout and
combined verification. [AGENTS.md](../../AGENTS.md) routes sessions to the
common capabilities and conditional host guides. Routing is not proof that
every host path has been exercised.
The rationale replaces the old standing-mandate interpretation in
[the authority decision](../decisions/2026-09-07-separate-loop-contracts-from-host-authority.md).

Changes to review/CI infrastructure, skill discovery and cross-skill routing,
secret handling, dependency/supply-chain surfaces, and large cross-skill
refactors SHOULD receive human review in addition to independent review.

## Configured Actors

The Claude Code definitions remain under `.claude/agents/`:

- `implementer.md` supplies the implementation-capable actor and its declared
  model and effort. Local results return to the parent; publication is not
  delegated merely by choosing this actor.
- `reviewer.md` supplies the advisory pre-flight reader. Its tool denial
  covers editing tools and nested spawning, not every possible shell write.
- `investigator.md` supplies a reader for bounded investigation questions.
  It is not required for an exact local lookup or when the host prohibits
  that delegation purpose.

The pinning rationale remains in
[the model decision](../decisions/2026-08-20-pin-the-investigator-at-sonnet-medium-and-step-implementer-and-reviewer-to-high.md).
These are configured candidates, not a portable ranking or permission grant.
A session MUST check actual permitted capabilities before using one. Parent
implementation is valid when delegation is inappropriate or unavailable;
mandatory verification and external review remain unchanged.

The project's advisory review applies after every verified initial
implementation, whether the parent or a child implemented it, before the first
branch push and draft pull request. A compatible fresh reader must be permitted
and available; its findings and round limits follow
[the pre-flight contract](../../skills/loop-engineering/references/pre-flight-review.md).
If no reader qualifies, record the exact unavailable or prohibited reason and
the resulting delivery restriction. This outcome is not a clean review, does
not waive external review, and does not authorize publication. A separately
authorized draft may proceed with the advisory gap recorded and remains draft.

Recovery before the first push resumes the pending pre-flight checkpoint. Once
the draft pull request exists, later fixes follow the external addressing and
fresh-review loop; resuming that loop does not replay the initial checkpoint.

## Select the external review route

[Code Review](./code-review.md) owns the two configured external routes. The
retained Claude route reviews ordinary and review-control changes through
`@claude review`. The disabled Codex Action route reviews only static,
non-control changes through the exact `/codex-action-review` command after its
production qualification and enablement.

Before requesting review, the current state MUST record the selected route,
its scope, and when that selection expires. A host switch MUST recover that
selection rather than replacing it with the new host's default. A failed or
blocked Codex run grants no automatic fallback to Claude. If the selected route
is unavailable and no human explicitly replaces it, record the unmet
independent-review gate.

Codex blocks any change to its control graph before model execution. Such a
change, including the initial workflow bootstrap, MUST use the existing Claude
route. If Claude is unavailable, self-review and local checks do not satisfy
the independent-review gate.

## GitHub Delivery During Migration

When storing or publishing change-loop records, follow
[GitHub Delivery](./github-delivery.md). It owns this repository's plan location,
state-block representation, issue-to-PR handover, marker selection, and evidence
destinations. [GitHub Operation](../../skills/github-operation/SKILL.md) owns
portable access and outcome verification. This section's anchor remains for
earlier migration references; it does not duplicate delivery mechanics.

## Working Without an Agent

Working without an agent does not lower the bar: branch, implement, run
[README's checks](../../README.md#commands), open a pull request following the
template, and obtain review before merge. Agents likewise MUST use a branch
outside the default branch, preserve pushed history, and leave merging to the
human. `claude/` is the namespace observed by the sweep below; a namespace
never authorizes a push.

## The Branch-Governance Sweep

[`branch-governance-audit.yaml`](../../.github/workflows/branch-governance-audit.yaml)
sweeps hourly and flags a `claude/` branch ahead of the default branch with no
open pull request. It is scheduled rather than push-triggered because
implementation legitimately pushes before opening its pull request; a grace
window skips a branch whose latest commit is still fresh.
