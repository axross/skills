---
name: loop-engineering
description: Driving a code change or document update through an approved plan → execution → verification → independent review loop, including resuming or recovering an in-progress run. Owns phase progression, approval revision, evidence, finding state, and recovery meaning—not host execution APIs or delivery storage. Project policy chooses gates and branch rules; host instructions and tool usage conditions always prevail. Not for read-only questions, investigations, or reviews that change nothing.
user-invocable: false
---

# Loop Engineering

Drive one change from intake to ready through **plan → approve → execute → verify → independent review → address → ready**. This skill defines what each phase means and what evidence crosses its boundaries. It does not authorize tools, publication, scheduling, or delegation, and it does not prescribe where durable state is stored.

Host instructions and each tool's usage conditions outrank project mandates. Project policy owns which gates apply, reviewer independence, branch and delivery rules, and storage representations. Where policy is silent, use this skill's existing defaults: a human-approved plan before edits, required verification, mandatory independent review, append-only recovery, and a ready state only after convergence. A standing project mandate cannot itself authorize an operation the host conditions or forbids.

Read-only work that changes nothing does not enter change gates. For change work, the parent may implement directly; delegation is valid only through currently permitted tools. This never makes the parent its own independent reviewer. No actor ranking, named model, scheduler, shared checkout, or live-resume mechanism is required.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## Phase Progression

Every change advances against current evidence, never a claim inherited from an earlier phase.

**Guidelines:**

- MUST stop before implementation until every product, scope, privacy, security, platform, compatibility, persistence, and migration ambiguity is either resolved in the plan or put to the human, and the resulting plan revision is approved.
- MUST treat read-only work as outside the change gates unless it produces a project change.
- MUST select execution using only currently permitted capabilities and any project host guide; parent execution is valid and weakens no gate when delegation is unavailable, disallowed, or inappropriate.
- MUST distinguish plan approval, operation authorization, execution capability, and permitted tool use. Carry forward valid authorization within its original scope, but never infer a broader grant from tool availability, project policy, plan approval, or a previous operation.
- MUST invalidate stale approval, assignments, results, and reviews when the plan or target revision they identify changes.

See [phase-progression.md](./references/phase-progression.md) for:

- intake, default gates, available-next-action progression, and legitimate stops
- project policy, independent review, and blocked delivery

**Guidelines:**

- MUST read [phase-progression.md](./references/phase-progression.md) before entering a change phase or deciding its next transition.

See [plan-document.md](./references/plan-document.md) for:

- the canonical plan sections and approval target
- revision identity, amendment approval, and visual choices

**Guidelines:**

- MUST read [plan-document.md](./references/plan-document.md) before writing, approving, revising, or comparing a plan.

## Execution Handoffs

See [implementation-package.md](./references/implementation-package.md) for:

- the five prose-compatible contracts
- repository identity, material fidelity, authorization, and result states

**Guidelines:**

- MUST read [implementation-package.md](./references/implementation-package.md) before assigning work or accepting an execution or review result.

See [subagent-delegation.md](./references/subagent-delegation.md) for:

- direct and delegated execution selection
- preflight and child-completion boundaries

**Guidelines:**

- MUST read [subagent-delegation.md](./references/subagent-delegation.md) before selecting an executor or integrating a child's work.

See [writer-ownership-and-recovery.md](./references/writer-ownership-and-recovery.md) for:

- writing coordination, plan-change interruption, retries, and outcome-unknown recovery
- append-only history and completion-evidence comparison

**Guidelines:**

- MUST read [writer-ownership-and-recovery.md](./references/writer-ownership-and-recovery.md) before concurrent writing, retrying an effect, or recovering an interrupted run.

## Review and Readiness

See [pre-flight-review.md](./references/pre-flight-review.md) for:

- advisory review findings, terminal states, deferred human handoffs, dismissal authority, and durable parks
- the initial implementation plus three autonomous review/fix rounds

**Guidelines:**

- MUST read [pre-flight-review.md](./references/pre-flight-review.md) before running or recovering an advisory pre-flight review.

See [independent-review.md](./references/independent-review.md) for:

- mandatory external independence, fresh review rounds, and the four-round address cap
- conflict remediation, affected verification, timeout, and ready conditions

**Guidelines:**

- MUST read [independent-review.md](./references/independent-review.md) before requesting, addressing, or evaluating an independent review.

## Resume and Reporting

See [resuming-and-handoff.md](./references/resuming-and-handoff.md) for:

- reconstructing actual state and resuming one pending phase
- handling stale, partial, and unknown outcomes

**Guidelines:**

- MUST read [resuming-and-handoff.md](./references/resuming-and-handoff.md) before resuming or taking over a run.

See [run-state-and-reporting.md](./references/run-state-and-reporting.md) for:

- semantic run state independent of storage format
- scoped operation grants across phases and sessions
- evidence and ready-to-merge reporting

**Guidelines:**

- MUST read [run-state-and-reporting.md](./references/run-state-and-reporting.md) before evaluating or persisting an operation grant, persisting run state, or reporting completion.
