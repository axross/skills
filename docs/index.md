---
okf_version: "0.3"
title: Skills engineering documentation
description: Engineering decisions and operating procedures for maintaining and evaluating this skill library.
---

# Documentation

To measure a skill, diagnose a missing result or prepare a scenario, start with
[Evaluation](./evaluation/index.md). To contribute a change, follow
[Development Workflow](./operations/development-workflow.md). The
[glossary](./glossary.md) defines the terms used across these guides.
Normative requirements follow [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## Specifications

- [Skill Evaluation](./specs/skill-evaluation.md) defines what a measurement
  stores and when an ordinary measurement has a comparable predecessor.
- [Treatment Comparison](./specs/treatment-comparison.md) defines how to
  interpret a declared comparison, including missing observations and effects
  the report can support.

## Conventions

- [Directory Structure](./conventions/directory-structure.md) locates skill
  sources, installed copies, validators and agent definitions. For a new
  evaluation patch or judgment, use [scenario layout](./conventions/scenario-layout.md).
- [Verification Gates](./conventions/verification-gates.md) explains which
  checks block a merge and which produce advisory reports or scheduled audits.
- [Marked Counts](./conventions/marked-counts.md) explains how to keep a number
  in prose synchronized with its source.
- [Skill Portability](./conventions/skill-portability.md) defines the boundaries
  of a distributable skill.
- [Decision Placement](./conventions/decision-placement.md) explains where to
  record a decision made during implementation.

## Operations

- **Run an evaluation.** [Evaluation](./evaluation/index.md) covers dispatch,
  artifact recovery, local probes, judgment, comparison and study preparation.
- **Make and verify a change.** Start with [Development Setup](./operations/development-setup.md)
  for the toolchain and commands, then [Development Workflow](./operations/development-workflow.md)
  for the change loop. [GitHub Delivery](./operations/github-delivery.md) covers
  tracking issues, pull requests and review evidence.
- **Start or troubleshoot an agent session.** [Agent Sessions](./operations/agent-sessions.md)
  covers provisioning, startup and telemetry. For a skipped edit repair or
  blocking Stop check, use [quality hooks](./operations/quality-hooks.md).
  [Agent Skills](./operations/agent-skills.md) covers installation, discovery,
  loading failures and adopted exceptions.
- **Choose a host operation or recover interrupted work.** Use
  [Development Loop Responsibilities](./operations/loop-migration.md) for the
  decision owner and recovery route, [Amp Execution](./operations/amp-execution.md)
  for Amp, or [Claude Code Execution](./operations/claude-code-execution.md)
  for Claude Code and Codex.
- **Run a review or update CI.** [Code Review](./operations/code-review.md)
  covers provider setup, review threads and report requirements.
  [CI Actions](./operations/ci-actions.md) covers action pins, trusted tags
  and verification of an update.

For installation and the skill catalog, see the [repository README](../README.md).
