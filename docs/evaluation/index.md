# Evaluation

Choose the procedure that matches what you have in hand.

| Task                                                           | Start here                                                                                                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choose a task and dispatch it on GitHub                        | Select an [evaluation scenario](../operations/evaluation-scenarios.md), then [launch the dispatch](../operations/evaluation-dispatch.md).                                                                 |
| Recover a missing measurement or investigate a rejected bundle | [Admit dispatch artifacts](./artifacts.md) explains the expected bundles, partial results and recovery.                                                                                                   |
| Preview the probe count or run a scenario locally              | [Run probes](./probes.md) covers admission, available tools and how to read a truncated run.                                                                                                              |
| Judge stored probes or check a regenerated summary             | [Judge and derive results](./results.md) covers the matching checkout, required files and independent reruns. [Skill Evaluation](../specs/skill-evaluation.md) explains the differential and predecessor. |
| Compare two declared treatments                                | [Run an offline comparison](./comparison.md) from a declaration and observations. [Treatment Comparison](../specs/treatment-comparison.md) defines what qualifies and when an effect stays unknown.       |
| Prepare a study or score its observations                      | [Evaluation Study Preparation](../operations/evaluation-study-preparation.md) separates what the actor receives from what the scorer needs.                                                               |
| Add a scenario or repair its patch                             | Use [scenario layout](../conventions/scenario-layout.md) to place a patch or judgment and [scenario patches](./scenario-patches.md) to regenerate and verify the diff.                                    |

## Study fixtures and scoring

- [Documentation change](./studies/documentation-only.md) uses Workshop Notes to test approval, continuation and recovery decisions.
- [Late verification](./studies/late-verification.md) uses Shelf Navigation to test what happens when a required check fails after an edit.
- [Actor and checkpoint routing](./studies/actor-routing.md) pairs each proposed task with observations of the guidance delivered to its actor.
