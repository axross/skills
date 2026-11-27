---
type: Procedure
title: Development Workflow
description: Required change and review gates from issue intake to a mergeable topic branch.
---

# Development Workflow

How a maintainer carries a change through this repository's required gates.
[Loop Engineering](../../skills/loop-engineering/SKILL.md) owns phase meaning
and evidence contracts; this document records the repository's choices and
the configured actors. Naming an actor here does not make it available or
permitted — a session qualifies each against what it actually exposes, through
[Claude Code Execution](./claude-code-execution.md) or
[Amp Execution](./amp-execution.md). How an injected instruction interacts with
a gate below is stated in
[Injected Instructions and Gates](../../skills/loop-engineering/references/phase-progression.md#injected-instructions-and-gates).

## The Change Loop

Every change MUST retain the repository's issue, recorded plan, human plan
approval, verified implementation, pre-push review, draft pull request,
post-push review, addressing, and ready gates. A read-only question,
investigation, or review does not enter them. At intake, follow the
[project entry](../../AGENTS.md#response-approach) for checkout selection and
Loop acquisition. Loop Engineering's
[intake](../../skills/loop-engineering/references/phase-progression.md#intake-and-defaults)
owns the first progress update, recovery of the pending phase, the match
against the canonical plan and approval, added scope on a named issue, and the
[operation grants](../../skills/loop-engineering/references/run-state-and-reporting.md#scoped-operation-grants)
an effect needs. [GitHub Delivery](./github-delivery.md) owns where the plan and
delivery state are stored.

These gates apply to every change, without a size threshold or self-approval
shortcut, including headless sessions. If authorization or a permitted route
is missing, record the unmet gate rather than waiving it. At completion, MUST
identify the tracking issue, pull request when one exists, and post-push
review outcome; an absent PR or review is an unmet gate, not a clean result.

[Development Loop Responsibilities](./loop-migration.md) identifies the owner
of each gate, host operation and GitHub record. [AGENTS.md](../../AGENTS.md) routes sessions to the
common capabilities and conditional host guides. Routing is not proof that
every host path has been exercised.

Changes to review/CI infrastructure, skill discovery and cross-skill routing,
secret handling, dependency/supply-chain surfaces, and large cross-skill
refactors SHOULD receive human review in addition to post-push review.

## Configured Actors

The Claude Code definitions remain under `.claude/agents/`:

- `implementer.md` supplies the implementation-capable actor and its declared
  model and effort. Local results return to the parent; publication is not
  delegated merely by choosing this actor.
- `reviewer.md` supplies the plan reviewer and the pre-push reviewer. It
  supplies the post-push reviewer only on the fallback route, which the per-host
  overrides in [`AGENTS.md`](../../AGENTS.md#code-review-rules) leave unused
  here, as [Select the post-push review route](#select-the-post-push-review-route)
  records. Its tool denial covers editing tools and nested spawning, not every
  possible shell write.
- `investigator.md` supplies a reader for bounded investigation questions.
  It is not required for an exact local lookup or when the host prohibits
  that delegation purpose.

Each of these exists to keep some context out of the main actor's own: the
implementer so it does not inherit the planning phase's accumulated context,
the reviewer so it does not inherit the implementer's reasoning state, and the
investigator so a large payload never enters the main actor's context at all.
Pinning a cheaper model or effort through a definition is a secondary benefit
rather than the reason — context separation holds by construction whatever
model a subagent runs, while a cost saving depends on a counterfactual no
single run can observe. Nothing here reports what delegation saved, or how
many findings post-push review caught that pre-push review missed;
neither figure is computable from what a run can see, and a rule requiring one
would report a compliance it never had.

All three definitions pin Sonnet. `implementer.md` and `investigator.md` run at
`effort: high`, and `reviewer.md` at `effort: xhigh`. The investigator pins Sonnet
rather than a smaller model, because being handed large payloads is the whole of
its role and a narrower context window would bind hardest at exactly the case the
role exists for. These values are `declared`, taken against no measurement either
way, and are reported as declared rather than as measured or verified; whether
`xhigh` takes effect for the Sonnet alias is likewise declared, not verified.

These definitions align once with axross/claude-loop-template at `df39a8b`. There
is no automatic sync, so a later change to the template reaches this repository
only through a deliberate change here.

These are configured candidates, not a portable ranking or permission grant.
A Claude Code session uses the matching configured actor when that assignment
qualifies under its actual permitted capabilities; parent implementation is the
fallback when delegation is unavailable or disallowed. Amp roles and invocation
conditions follow [Amp Execution](./amp-execution.md), not these Claude
definitions. Apply Loop's [checkpoint qualification](../../skills/loop-engineering/references/subagent-delegation.md#checkpoint-qualification)
separately to implementation delegation, plan review, and pre-push
review; mandatory verification and post-push review remain unchanged.

Pre-push review applies after every verified initial
implementation, whether the parent or a child implemented it, before the first
branch push and draft pull request. Who implemented does not select it —
fresh review is worth the same after a direct implementation as after a
delegated one — and the one condition that does is whether a reader qualifies,
because a stage conditional on a reader that may be prohibited or absent
would either stall the run or invite self-review under another name. A
compatible fresh reader must be permitted and available; its findings and round limits follow
[the pre-push review contract](../../skills/loop-engineering/references/pre-push-review.md).
If no reader qualifies, record the exact unavailable or prohibited reason and
the resulting delivery restriction. This outcome is not a clean review, does
not waive post-push review, and does not authorize publication. A separately
authorized draft may proceed with the pre-push review gap recorded and remains
draft. That exception covers only pre-push review, not plan review or
post-push review.

Recovery before the first push resumes the pending pre-push review checkpoint.
Once the draft pull request exists, later fixes follow the post-push addressing
and fresh-review loop; resuming that loop does not replay pre-push review.

## Select the post-push review route

[AGENTS.md](../../AGENTS.md#code-review-rules) states this repository's
post-push review route for each host. [Code Review](./code-review.md) owns each
provider's setup and invocation. An unavailable route leaves the gate unmet, as
[Review Terms](../../skills/loop-engineering/references/review-workflow.md#review-terms)
defines.

<a id="github-delivery-during-migration"></a>

## GitHub delivery

When storing or publishing change-loop records, follow
[GitHub Delivery](./github-delivery.md). It owns this repository's plan location,
state-block representation, issue-to-PR handover, marker usage, and evidence
destinations. [GitHub Operation](../../skills/github-operation/SKILL.md) owns
portable access and outcome verification.

## Working Without an Agent

Working without an agent does not lower the bar: branch, implement, run
[Development Setup's checks](./development-setup.md#commands), open a pull request following the
template, and obtain review before merge. Agents follow
[AGENTS.md](../../AGENTS.md#project-overview)'s default-branch and merging line
and preserve pushed history ([GitHub Operation](../../skills/github-operation/SKILL.md)).
`claude/` is the namespace observed by the sweep below; a namespace
never authorizes a push.

## Keep the Topic Branch Mergeable

When the base branch moves and a topic branch conflicts, merge the current base
into the topic branch and record any resolution in a new commit. Do not rebase,
amend, reset away, or force-push published history as conflict recovery.

After the merge, follow Loop Engineering's
[mergeability and conflict-remediation contract](../../skills/loop-engineering/references/post-push-review.md#mergeability-and-conflict-remediation)
for judgment escalation, affected verification and, where a resolution changes
content, a fresh post-push round. Code Review
owns the selected provider's snapshot semantics.

## The Branch-Governance Sweep

[`branch-governance-audit.yaml`](../../.github/workflows/branch-governance-audit.yaml)
sweeps hourly and flags a `claude/` branch ahead of the default branch with no
open pull request. It is scheduled rather than push-triggered because
implementation legitimately pushes before opening its pull request; a grace
window skips a branch whose latest commit is still fresh.
