---
type: Convention
title: Scenario Layout
description: Choose where an evaluation scenario keeps its patch and judgment scripts and how its patched file set matches the mock history.
---

# Scenario Layout

Keep a scenario's task, factors, private scripts and optional patch in
`tools/evaluation/scenarios/<id>/`. Use the [scenario registry](../operations/evaluation-scenarios.md)
to find an existing task and its mock. [Skill Evaluation](../specs/skill-evaluation.md)
defines what the declaration measures.

## Scenario patches

Use a natural gap in the mock when it supplies the starting state the task
needs. When the scenario introduces a defect, its unified diff MUST live
beside `scenario.json`. Set `patch` to the filename, or to `null` for a scenario
that needs no patch. Each patch belongs to one scenario. Putting its defect
in the shared mock would change the starting state for every scenario using
that project. The [mock catalog](../../tools/evaluation/mocks/README.md)
identifies existing gaps and fixture compromises.

A patch that adds, removes or renames a project file MUST update the mock's
`history.jsonc` in the same diff. Every project file in the patched tree must
appear in the history, and every file named in the history must exist. The
[materializer](../../tools/evaluation/src/mock-workspace.mjs) checks both
directions before replaying the commits. Edits to the contents of existing
files alone require no history change. Keep patch bytes outside the format
and lint globs by using a `.diff` extension. To regenerate a diff and verify
the replay, follow [Scenario Patches](../evaluation/scenario-patches.md).

## Judgment scripts

The [factor judge](../../tools/evaluation/src/factor-judgment.mjs) resolves
`judgment.script` relative to the scenario directory. Keep a script used by
one scenario in that scenario's `scripts/` directory and refer to it as
`scripts/<name>.mjs`. When several scenarios use a script, keep one copy in
`tools/evaluation/judgments/` and refer to it from each declaration as
`../../judgments/<name>.mjs`. The [schema](../../tools/evaluation/scenario.schema.json)
accepts relative paths with parent components. A reviewer checks for duplicate
copies across scenarios because both a private and a shared path can resolve.
