---
type: Procedure
title: Run Evaluation Probes
description: Preview the admitted matrix, run local probes and diagnose truncated records or tool warnings.
---

# Run Evaluation Probes

Run from the repository root. Choose the scenario from the [registry](../operations/evaluation-scenarios.md). A dry run needs no model credential. For a paid run, install the `claude` CLI on `PATH` and authenticate it with `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`.

## Preview the matrix

To preview exactly one probe, name one scenario, its condition and its repetition index, and cap the total at one.

```bash
node tools/evaluation/probe.mjs --scenario <id> --condition skill-present --repetition 1 --limit 1 --dry-run
node tools/evaluation/probe.mjs --help
```

The default run selects all declared scenarios, both conditions and three repetitions per condition. Omitting `--scenario` with the singular pair selects one probe for **each** declared scenario. Preview the exact count before removing `--dry-run` to start the probes. If it exceeds `--limit`, the command reports both numbers and stops before the first spawn. Reduce the selected scenarios, conditions or repetitions, or set a limit that covers the intended run. The limit bounds probe count. Token usage and spend depend on what each probe does.

| Flag                    | Does                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `--scenario <id>`       | Only this scenario (default: every scenario under `tools/evaluation/scenarios/`)                                                 |
| `--conditions <list>`   | Comma-separated, from `skill-present`, `skill-absent` (default: both)                                                            |
| `--repetitions <n>`     | Repetitions per condition (default: 3)                                                                                           |
| `--condition <c>`       | With `--repetition`, select this condition and index once per selected scenario. Incompatible with the plural flags.             |
| `--repetition <n>`      | With `--condition`, the 1-based repetition index for each selected scenario                                                      |
| `--measurement-id <id>` | Set the suffix of `<scenario-id>-<id>`. Reusing it shares a measurement directory only within the same scenario and output root. |
| `--limit <n>`           | Refuses the run before anything starts if the exact probe count exceeds this                                                     |
| `--out <dir>`           | Measurement root to write under (default: `tools/evaluation/measurements`)                                                       |
| `--dry-run`             | Reports the probe matrix and the admission outcome; spawns nothing                                                               |
| `--emit-matrix`         | Prints the probe matrix and the judgment matrix as one JSON document; spawns nothing                                             |

## Locate the record and diagnose truncation

The instrument materializes a fresh Git workspace and installs the skills for the selected condition. It tells the model that no human is available to answer questions. By default, each probe writes `metadata.json`, `transcript.jsonl`, `changes.patch` and `invocations.json` inside `tools/evaluation/measurements/<scenario-id>-<id>/<condition>-<repetition>/`. Local runs leave committing those files to the operator. The [credential filter](../../tools/evaluation/src/credentials.mjs) removes other secret-like variables from the child environment and redacts credential values from the stored transcript.

Inspect `metadata.json` when a probe ends early. The [process monitor](../../tools/evaluation/src/probe-process.mjs) stops the child at <!-- count:probe-turn-cap -->100<!-- /count --> streamed assistant events by default. Either that stop or the CLI's `error_max_turns` result sets `truncated`. The separate `turns` field comes from the CLI result's `num_turns`; it can be null if the stream ended before the result. Read a probe that hit the cap as unfinished: it may have completed the edit and been stopped during verification. Scaffolding or retries alone cannot establish a skill defect. An empty patch or a nonzero exit code remains part of the observation. To judge the surviving records, follow [Measurement Results](./results.md).

In one recorded run, a probe hit the cap at 100 assistant events while reporting 61 turns. Across the five probes in that measurement, the event count was 1.54 to 1.71 times the reported turns. These are observations from that run. [Original measurement analysis](https://github.com/axross/skills/blob/7d00dde90814c30cac3c8489f4a428c4513ec884/docs/decisions/2026-08-20-read-a-truncated-probe-as-an-unfinished-measurement.md#context)

## Inspect the tool surface

`tools/evaluation/src/probe-process.mjs` passes both `--allowed-tools` and
`--disallowed-tools`, and only the second of them bounds anything. The first
is **additive**: naming a tool the CLI defers surfaces it, naming one the
CLI does not have does nothing at all, and a name appearing in both lists is
denied. So `ALLOWED_TOOLS` — `Bash`, `Edit`, `Glob`, `Grep`, `Read`,
`Skill`, `Write` — is passed for one real effect, putting `Glob` and `Grep`
in front of a probe, and MUST NOT be read as the set of tools a probe holds.

`DISALLOWED_TOOLS` is the bound. A tool is denied when it delegates the
probe's work to another agent, when it reaches outside the probe workspace,
when it blocks waiting for a human the probe's own system prompt has
already said is not there, or — `NotebookEdit`'s own case — when no mock
ships anything for it to touch. `ToolSearch` is deliberately left reachable.

Everything else the CLI exposes is reachable by a probe and named by
neither list, which is the state a reader has to keep in mind: the
declarations state intent, and the record below states fact.

**Every probe records what the CLI reported, and the run says where the two
disagree.** `parseTranscript` reads the `system`/`init` event's own `tools`
array — the CLI's report of what that session held — and
`tools/evaluation/src/tool-surface.mjs` compares it against both
declarations. The result lands under `metadata.json`'s
`runtime.tools`, alongside the two declarations it was compared against, and
any non-empty disagreement is written to the run's standard error as a
warning naming the tools:

- an allowance the CLI did not surface, so the probe cannot use that tool;
- a denial the CLI surfaced anyway — a bound that did not take;
- a surfaced tool neither list names.

A disagreement is reported, never enforced: it is a fact about the CLI a
probe ran under, and a probe that hits one still writes all four of its
files. A transcript carrying no `tools` array at all — an older CLI —
records `null` for both the reported surface and the comparison, which is
deliberately distinct from reporting an empty one.
