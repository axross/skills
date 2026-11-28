---
type: Procedure
title: Evaluation Study Preparation
description: Choose an evaluation study and find its actor inputs, scorer controls and evidence limits.
---

# Evaluation Study Preparation

Choose the study by the decision you want to observe. Use its fixture and
natural request for the actor, and keep the scoring instructions in the
evaluator’s workspace. To run an existing instrument scenario, start with
[Evaluation Scenarios](./evaluation-scenarios.md).

## Documentation-only preparation

Use [Workshop Notes](../evaluation/studies/documentation-only.md) to observe
whether an actor recognizes the approval boundary for a documentation change.

- <a id="actor-visible-project-fixture"></a>[Prepare the project and the actor’s request](../evaluation/studies/documentation-only.md#actor-visible-project-fixture).
- <a id="scorer-only-phase-controls"></a>[Set up the approval, continuation and recovery controls](../evaluation/studies/documentation-only.md#scorer-only-phase-controls).
- <a id="scoring-observations-and-future-trials"></a>[Score first actions and freeze a separately approved live trial](../evaluation/studies/documentation-only.md#scoring-observations-and-future-trials).

## Late-verification preparation

Use [Shelf Navigation](../evaluation/studies/late-verification.md) to observe
how an actor responds to a failing check after implementing a label change.

- <a id="actor-visible-typescript-fixture"></a>[Prepare the TypeScript fixture and the tracked request](../evaluation/studies/late-verification.md#actor-visible-typescript-fixture).
- <a id="separate-simulated-control-harness"></a>[Configure each simulated service and failure control](../evaluation/studies/late-verification.md#separate-simulated-control-harness).
- <a id="late-decision-evidence-and-scoring"></a>[Distinguish premature stopping from a premature readiness claim](../evaluation/studies/late-verification.md#late-decision-evidence-and-scoring).

## Skill routing by actor and checkpoint

Use the [actor routing study](../evaluation/studies/actor-routing.md) to decide
whether a change to the skill catalog, entry instructions or skill body helps
the actor acquire the guidance needed at a particular checkpoint.

- <a id="tasks-to-give-the-actor"></a>[Choose the assignment and its input](../evaluation/studies/actor-routing.md#tasks-to-give-the-actor).
- <a id="scorer-observations"></a>[Assess material delivery and the resulting decision separately](../evaluation/studies/actor-routing.md#scorer-observations).
- <a id="cost-and-adoption-decision"></a>[Compare the costs and record the adoption decision](../evaluation/studies/actor-routing.md#cost-and-adoption-decision).

## Component and framework adoption

The component/framework adoption study prepares four responsibility categories:

- A small component style edit.
- A props-plus-style edit.
- Framework startup, routes or configuration wiring.
- An isolated pure calculation with no component or framework contract change.

Actual consumer fixtures and the live host, repetitions, cost/effect budget and
approval plan remain separate work.
