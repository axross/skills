# Implementation Worker

Apply this reference after the plan-approval gate clears and before the first Phase 2 edit, when deciding **who** implements the approved plan. Delegation is optional: it happens only when the harness already exposes a worker that qualifies, and the single-agent path stays a fully supported outcome rather than a failure.

The main actor remains the only long-lived actor. A worker is a bounded execution actor for one phase of one plan revision — never a second loop driver.

## Executor Resolution

A worker qualifies by what its configuration says it does, not by what its name suggests. Resolution runs once per phase, after approval and before any project-file edit.

Resolve in this order, taking the first that qualifies:

1. an implementation worker the project or host instructions name explicitly
2. a custom agent whose declared configuration or description explicitly covers implementation, verification, diff self-check, and cohesive local commits
3. a harness-built-in worker explicitly documented for execution, implementation, or production work
4. the main actor, in single-agent fallback

**Guidelines:**

- MUST resolve the executor after the plan-approval gate clears and before the first Phase 2 project-file edit, never earlier and never as an afterthought once editing has begun.
- MUST NOT select an agent from a name substring, or because it merely holds file-editing tools. A general-purpose, default, exploratory, planning, research, or review-only agent does not qualify, because nothing portable guarantees it uses an implementation-appropriate model and effort, owns verification and diff self-check, creates cohesive commits, or honors the decision and escalation boundaries.
- MUST fall back to single-agent mode when two or more non-explicit candidates remain ambiguous, rather than asking the human to choose on every run or launching competing workers.
- MUST treat an agent catalog that cannot be enumerated at all as no qualifying candidate, and fall back the same way — a harness that will not say what it exposes has not said that a worker qualifies.
- MUST treat single-agent fallback as a normal outcome that weakens no gate — planning, verification, review, and reporting are unchanged by it.

## Compatibility Preflight

A worker that cannot finish is worse than no worker, because it fails after editing. Establish capability before granting the writer lease, and prefer metadata the harness already exposes over a spawn spent discovering it.

Before granting writer ownership, establish that the worker is resolvable under the current harness, can be spawned under current policy, can read the checkout, edit project files, run the required commands, inspect Git state, create local commits, and report completion or escalation to the parent — and that it is not already running as a conflicting writer.

**Guidelines:**

- MUST establish every capability above before granting the writer lease, using trustworthy harness role and tool metadata where it exists instead of spending a model turn on preflight.
- MUST begin the task with a no-edit workspace-and-artifact validation stage where runtime availability cannot be established without spawning, and fall back before any edit if that stage fails.
- MUST establish, where the artifact manifest carries a `visual` entry, that a tool returns the artifact as an image the model itself views; a tool returning a textual description of a visual artifact does not satisfy this, and the run falls back before spawning rather than discovering the gap at read time.

## Model and Effort Certainty

Whether a worker is _capable_ and which model it _runs_ are separate questions, and a harness may answer the second only partially. Reporting a configured value as a confirmed one turns an unverified assumption into a claim the human cannot audit.

Classify model and effort independently as:

- `verified` — runtime, transcript, or telemetry confirms the actual value
- `declared` — configuration or spawn input states the value, but runtime execution could not be independently confirmed
- `unknown` — the host exposes too little to say

**Guidelines:**

- MUST classify model and effort with one of the three values above and MUST NOT report a declared value as verified.
- MUST NOT require runtime-verified model and effort before delegating; that stricter policy belongs to a project or host that wants it, not to the portable loop.
- SHOULD honor host or project configuration that selects an implementation model and reasoning effort, without hard-coding any model identifier into the loop's own rules.
