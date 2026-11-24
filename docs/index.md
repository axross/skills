---
okf_version: "0.3"
title: Skills engineering documentation
description: Engineering decisions and operating procedures for maintaining and evaluating this skill library.
---

# Documentation

Start with the [glossary](./glossary.md) for repository terminology. To make a
change, follow [Development Workflow](./operations/development-workflow.md).
For evaluation results, start with [Skill Evaluation](./specs/skill-evaluation.md).

The headings below preserve the repository’s topic routes. Each page’s `type`
identifies the decision it supports, independently of its directory. Normative
terms follow [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## Specifications

- [Treatment comparison](./specs/treatment-comparison.md) — when comparison results qualify and how the report represents missing observations.
- [Skill Evaluation](./specs/skill-evaluation.md) — what it means to
  measure whether a skill works, and the evaluation scenario it describes,
  run under two conditions and checked across three phases.

## Conventions

- [Directory Structure](./conventions/directory-structure.md)
  — where a skill's files live, the two skill tiers, where a validator or an
  agent definition belongs, and the layout of the evaluation subsystem under
  `tools/evaluation/`.
- [Verification Gates](./conventions/verification-gates.md) —
  what makes a check a gate, a report, or a scheduled audit, and the traps
  each can fall into.
- [Marked Counts](./conventions/marked-counts.md) — the
  `count:` marker that ties a number in prose to the file it describes.
- [Skill Portability](./conventions/skill-portability.md) —
  what a distributable skill may not contain here, and the dependencies whose
  docs are consulted before a change.
- [Decision Placement](./conventions/decision-placement.md) —
  where a decision settled while a change is being built has to reach a
  durable document, the ordered test for which one, and which body receives
  what.

## Operations

- [Evaluation scenarios](./operations/evaluation-scenarios.md) — select an existing task by target skill and mock.
- [Evaluation study preparation](./operations/evaluation-study-preparation.md) — prepare proposed fixtures and their scoring controls.
- [Development Workflow](./operations/development-workflow.md)
  — how a change gets from a stated intent to a merged pull request.
- [Development Setup](./operations/development-setup.md) — local
  setup, the toolchain, and the repository's commands and validators.
- [GitHub Delivery](./operations/github-delivery.md) — plan and
  state storage, issue-to-PR handover, comment markers, and evidence routing.
- [Amp Execution](./operations/amp-execution.md) — qualifying Amp
  executors, transferring materials, waiting, and recovering uncertain effects.
- [Claude Code Execution](./operations/claude-code-execution.md) —
  Claude Code's question tool, the CI-and-review wait and its teardown, the
  worktree rule for a shared working tree, the investigator actor, and how model
  and effort certainty is read here.
- [Loop Migration](./operations/loop-migration.md) — the portable
  loop's topic ownership, preserved safeguards, combined acceptance matrix,
  and staged entry rollout and recovery.
- [Agent Skills](./operations/agent-skills.md) — installing and
  refreshing a skill, checking discovery in Claude Code and Codex, and verifying
  active source and content or diagnosing loading failures in Amp.
- [Agent Sessions](./operations/agent-sessions.md) — how a
  session's Amp orb is provisioned, how the session starts, its hooks, its
  telemetry tagging, and the environment variables recommended for cutting a
  session's cost.
- [Code Review](./operations/code-review.md) — hosted Codex and
  Claude reviews, Amp review threads, host selection, cleanup, and
  policy-delivery/output qualification.
- [CI Actions](./operations/ci-actions.md) — selecting trusted action
  version tags or SHA pins, updating workflow references, and separating static
  evidence from live CI and downstream dependency trust.
- [Evaluation Dispatch](./operations/evaluation-dispatch.md) —
  running the evaluation instrument, by hand or through its one dispatch
  workflow, against this repository's declared scenarios.

For what this library is, how to install a skill, and its skill catalog, see
[`README.md`](https://github.com/axross/skills/blob/main/README.md).
