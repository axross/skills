---
type: Procedure
title: Evaluation Dispatch
description: Select a scenario, launch the evaluation workflow and trace an absent result to the job that owns it.
---

# Evaluation Dispatch

Use the [evaluation workflow](../../.github/workflows/evaluation-dispatch.yaml) when you want to acquire measurements and land the results together. You need repository write access to dispatch it. The workflow must exist on the default branch for the manual trigger to be available. GitHub runs the version on the ref you select.

## The Declared Scenario Set

Choose a task, target skill and mock project in [Evaluation Scenarios](./evaluation-scenarios.md). Leaving the scenario blank selects the entire registry.

## The Dispatch Workflow

1. In GitHub Actions, select the evaluation workflow, choose **Run workflow** and check the ref. Set `scenario` and `repetitions` for the desired run. Set `probe-limit` to the largest probe count you intend to admit. Blank repetitions use the instrument default; a blank limit admits any count.
2. Preview with `dry-run` enabled. The `plan` job expands both matrices and assigns one measurement directory per scenario. If the count exceeds the limit, it reports both numbers and stops. Each admitted `probe` cell previews its part of the matrix. A dry run writes no measurements, incurs no model charges and skips `evaluate` and `land`.
3. To acquire the measurement, run the intended inputs with `dry-run` disabled and the repository's `CLAUDE_CODE_OAUTH_TOKEN` secret configured. Each probe job runs one scenario, condition and repetition. Each evaluate job judges one scenario's surviving material. Both matrices use `fail-fast: false` and upload independently, preserving completed work when a sibling fails. Model jobs have empty repository permissions. The reasoning judge uses the pinned Claude Code CLI with the same OAuth credential as the probe.
4. Inspect the measurement pull request and its admission report. Only `land` has permission to write repository contents and pull requests. It runs without a model credential, validates bundles, derives summaries for complete scenarios, runs `npm run check` and publishes under `github-actions[bot]`. Missing files, factor errors and failed derivations appear in the report. A failed project check stops publication. [Verification Gates](../conventions/verification-gates.md) explains why these checks run during landing and how to interpret evaluation findings.

## Follow a result through the instrument

<a id="artifact-admission-artifactsmjs"></a>

**A job uploaded a bundle but the measurement or summary is missing.** Inspect the [artifact admission report and recovery procedure](../evaluation/artifacts.md). If only landing failed, retry that job while its artifacts remain available.

<a id="taking-a-measurement-probemjs"></a>
<a id="admission-binds-before-any-probe-starts"></a>

**Preview or run one probe locally.** [Run Evaluation Probes](../evaluation/probes.md#preview-the-matrix) gives the flags, cost boundary and pre-spawn refusal conditions.

<a id="what-bounds-a-probes-tool-surface"></a>

**The probe ran with an unexpected tool.** [Inspect the tool surface](../evaluation/probes.md#inspect-the-tool-surface) in the recorded initialization event and metadata.

<a id="judging-a-measurement-evaluatemjs"></a>

**A stored probe lacks a judgment.** [Judge the measured files](../evaluation/results.md#judge-the-measured-files) from a matching checkout and distinguish missing inputs from factor errors.

<a id="deriving-the-summary-derivemjs"></a>

**A summary is missing or has drifted.** [Derive and check the summary](../evaluation/results.md#derive-and-check-the-summary) against the recorded probes, factors and sibling measurements.

<a id="comparing-declared-treatments-comparemjs"></a>
<a id="input-contract"></a>

**Compare two declared treatments offline.** Supply the [declaration and observations](../evaluation/comparison.md#input-contract) to the standalone comparison command. This procedure can be run independently of a dispatch.

<a id="reading-the-report"></a>

**A comparison has no reported effect.** [Read the report](../evaluation/comparison.md#reading-the-report) to trace the deficit to its cell, opportunity or guard control.

<a id="natural-task-preparation"></a>

## Prepare a study

Start with [Evaluation Study Preparation](./evaluation-study-preparation.md) to choose a study and keep actor material separate from scoring controls.

<a id="documentation-only-preparation"></a>
<a id="actor-visible-project-fixture"></a>
<a id="scorer-only-phase-controls"></a>
<a id="scoring-observations-and-future-trials"></a>

For the [documentation-only study](../evaluation/studies/documentation-only.md), prepare the [project fixture](../evaluation/studies/documentation-only.md#actor-visible-project-fixture), withhold the [phase controls](../evaluation/studies/documentation-only.md#scorer-only-phase-controls), and record the [scoring observations](../evaluation/studies/documentation-only.md#scoring-observations-and-future-trials).

<a id="late-verification-preparation"></a>
<a id="actor-visible-typescript-fixture"></a>
<a id="separate-simulated-control-harness"></a>
<a id="late-decision-evidence-and-scoring"></a>

For the [late-verification study](../evaluation/studies/late-verification.md), prepare the [TypeScript fixture](../evaluation/studies/late-verification.md#actor-visible-typescript-fixture) and [control harness](../evaluation/studies/late-verification.md#separate-simulated-control-harness), then collect the [late-decision evidence](../evaluation/studies/late-verification.md#late-decision-evidence-and-scoring).
