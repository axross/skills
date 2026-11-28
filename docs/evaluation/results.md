---
type: Procedure
title: Measurement Results
description: Reconstruct and judge a stored probe, derive its summary and diagnose a missing factor or predecessor.
---

# Measurement Results

Start with one scenario measurement directory and a checkout matching the run's instrument, scenario, mock, skills and judgment scripts. Check the instrument commit in the probe's `metadata.json` where recorded. For a dispatch, first consult the [artifact admission report](./artifacts.md) for absent planned probes. A local command can only see directories that reached disk.

## Judge the measured files

```bash
node tools/evaluation/evaluate.mjs <measurement-dir>
node tools/evaluation/evaluate.mjs --help
```

Each probe directory must contain `metadata.json`, `invocations.json`, `changes.patch` and `transcript.jsonl`. If a file is missing, the command names it and stops. Recover the measured bytes from the original artifact before retrying. If the patch fails to apply, check the fixture and checkout revision. An empty patch is valid. [Workspace reconstruction](../../tools/evaluation/src/reconstruct.mjs) materializes the matching fixture and condition in a temporary workspace and applies the stored diff.

The evaluator runs script judgments against the reconstructed workspace. Reasoning judgments use the phase's permitted evidence: discovery reads recorded skill invocations, outcome reads the diff and task, and transcript reads the stream. The reasoning judge runs through the pinned model route with tools disabled. It needs the `claude` CLI and `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`. A missing credential produces a factor error carrying its reason. Other factors can still complete.

Inspect each probe's `factors.json` for its verdict and evidence. Re-running the command writes that file again. For an independent judgment or a changed judge, copy the measurement to a separate root first to preserve the original factors and summary. See [Skill Evaluation](../specs/skill-evaluation.md#the-factor) for the difference between a negative finding and an error.

## Derive and check the summary

```bash
node tools/evaluation/derive.mjs <measurement-dir>
node tools/evaluation/derive.mjs <measurement-dir> --check
node tools/evaluation/derive.mjs --help
```

Derivation reads the scenario declarations, `metadata.json` and `factors.json`. It writes `summary.json` with factor differentials, counts, actual spend and a comparable predecessor when one qualifies. A missing or errored judgment can leave a differential unavailable. A missing probe cost makes total spend unknown. An unreadable required file prevents derivation.

Use `--check` to recompute the bytes and detect drift. If it fails, inspect the measured directory, judgment files, declarations and sibling measurements used for [predecessor selection](../specs/skill-evaluation.md#what-makes-two-measurements-comparable). In a dispatch, only scenarios marked complete by artifact admission are eligible for a summary. For an intentional change in treatment material, use the [offline comparison procedure](./comparison.md).
