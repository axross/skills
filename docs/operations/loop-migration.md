---
type: Architecture
title: Development Loop Responsibilities
description: Which source owns change-loop decisions, how a host executes them and where GitHub stores recoverable state.
---

<a id="loop-migration"></a>

# Development Loop Responsibilities

When a review is pending, Loop determines what result satisfies the gate.
The session's host selects the reviewer, and GitHub holds the request and
response that a maintainer can inspect when resuming the change.

<a id="ownership-and-migration-status"></a>
<a id="source-topic-map"></a>
<a id="entry-and-planning"></a>
<a id="execution-and-materials"></a>
<a id="review-recovery-and-storage"></a>
<a id="combined-entry-integration"></a>

## Find the owner of a change

| Question                                                                                  | Governing source                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What makes a plan approved, and what evidence admits a transition?                        | [Loop Engineering](../../skills/loop-engineering/SKILL.md) defines the portable phase and handoff contracts. [Development Workflow](./development-workflow.md) selects the gates this repository uses.                                                                    |
| How does a contributor prepare a plan or ask for a decision?                              | [PRD Authoring](../../skills/product-requirement-document-authoring/SKILL.md) owns the plan's structure. [Professional Behavior](../../skills/professional-behavior/SKILL.md) covers how to ask the question and attribute the answer to the person who gave it.          |
| Which host tool can carry out the assignment with the required materials and permissions? | [Amp Execution](./amp-execution.md) and [Claude Code and Codex Execution](./claude-code-execution.md) map the assignment onto tools the session actually exposes. [Agent Skills](./agent-skills.md) covers installation and how to establish which skill the host loaded. |
| Which reviewer runs, and what must the published review cover?                            | [Code Review operations](./code-review.md) selects the route for the host. [Review Instructions](../../REVIEW.md) defines the repository's reporting requirements.                                                                                                        |

<a id="github-boundary-integration"></a>

## Follow the state from issue to pull request

The tracking issue owns the approved plan. After draft publication the pull
request carries current execution and review state. [GitHub Delivery](./github-delivery.md#hand-state-over-to-the-pull-request)
owns that handover and the location of review evidence.
[GitHub Operation](../../skills/github-operation/SKILL.md) owns target identity,
body fidelity and read-back for each write.

<a id="stage-rollout-and-recover-existing-work"></a>

## Resume interrupted work

Read the recorded plan revision, branch, pending operation and verified
effects together. If draft creation may have succeeded, look for the pull
request before retrying. [Loop recovery](../../skills/loop-engineering/references/resuming-and-handoff.md#reconstructing-state)
identifies the state to reconstruct. [GitHub recovery](../../skills/github-operation/references/publication-and-recovery.md#recover-partial-or-unknown-outcomes)
explains how to establish the result of an uncertain write.

<a id="safeguards-checked-against-the-baseline"></a>
<a id="verification-scope"></a>
<a id="github-boundary-walkthroughs"></a>
<a id="combined-acceptance-matrix"></a>

For the checks and walkthroughs performed during the migration, see the
[migration at its recorded revision](https://github.com/axross/skills/blob/69a254dd6b368732a6f8a153f5826784b7df6746/docs/operations/loop-migration.md#verification-scope).
