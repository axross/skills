# Direct and Delegated Execution

Apply this reference when choosing who or what executes an assignment. The loop specifies contracts and phase meaning; the host supplies execution mechanisms and their permission boundaries.

## Executor Selection

Direct parent execution is a first-class path. Delegation is useful only when a permitted current capability improves isolation or focus without losing required material fidelity.

**Guidelines:**

- MUST use only execution capabilities permitted by current host instructions and tool usage conditions, consulting a project host guide when one exists.
- MUST execute in the parent when delegation is disallowed, inappropriate, or unavailable; this weakens no approval, verification, or review gate.
- MUST NOT require a universal actor ranking, role name, model, tool, separate checkout, live conversation, or resumable child.
- MUST report missing capability as `unavailable` and missing authorization as `authorization-waiting`.

## Compatibility Preflight

An executor should fail before effects, not after them. Preflight checks the assignment's required reads, writes, commands, return path, and material fidelity against actual permitted capabilities.

**Guidelines:**

- MUST confirm access to every required material at its declared fidelity before execution; visual access means the image is actually rendered to the actor.
- MUST return a non-complete result before editing when source, revision, uncommitted diff, required material, permission, or return path does not match the assignment.

## Integration Boundary

A child's `complete` result closes only its assignment. The parent still owns phase progression and integrated evidence.

**Guidelines:**

- MUST compare the result with actual changed files, uncommitted state, commits, checks, processes, and the approved revision before accepting it.
- MUST inspect the integrated result rather than treating a receipt as proof that the whole change is ready.
- MUST issue a fresh assignment after a plan revision; a clarification that does not change the plan may continue under the current assignment.
