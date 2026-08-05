# Implementation Worker

Apply this reference after the plan-approval gate clears and before the first Phase 2 edit, when deciding **who** implements the approved plan. Delegation is optional: it happens only when the harness already exposes a worker that qualifies, and the single-agent path stays a fully supported outcome rather than a failure.

The main actor remains the only long-lived actor. A worker is a bounded execution actor for one phase of one plan revision — never a second loop driver.

## Executor Resolution

A worker qualifies by what it can do — not by what its name suggests, and not by what its definition declares itself responsible for. Resolution runs once per phase, after approval and before any project-file edit.

Resolve in this order, taking the first that qualifies:

1. an implementation worker the project or host instructions name explicitly
2. a custom agent that can implement and whose declared purpose does not exclude implementing
3. a harness-built-in worker that can implement and whose declared purpose does not exclude implementing
4. the main actor, in single-agent fallback

Screen only for what the implementation package cannot supply. The package carries the decision boundary, the verification obligation, the commit discipline, and the writer lease — that boundary is owned by the main actor and delivered per run, never expected from the worker. What the package cannot supply is execution capability and the model the worker runs. Capability is therefore what resolution checks, and a generic implementation-capable worker qualifies without a definition restating the contract it is about to be handed.

**Guidelines:**

- MUST resolve the executor after the plan-approval gate clears and before the first Phase 2 project-file edit, never earlier and never as an afterthought once editing has begun.
- MUST NOT require an agent definition to declare implementation responsibilities, and MUST NOT select an agent from a name substring.
- MUST exclude an agent only where it cannot implement — no file editing, no command execution, no commit creation, no way to report back — or where its own definition forbids implementing, as a read-only, review-only, or explicitly non-editing agent does. Failing to declare implementation is not grounds for exclusion.
- MUST break the tie rather than abandon delegation where more than one candidate qualifies: prefer the declared purpose closest to implementation, then the harness's documented default implementation worker, then single-agent fallback. Ambiguity alone must not force fallback, because the qualifying set is deliberately broad and that rule would suppress delegation in the common case.
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

## Defining a Worker of Your Own

A project does not have to define a worker at all — resolution accepts what a harness already exposes, and a generic implementation-capable agent qualifies. What a definition adds is narrower than it first appears, and worth being clear about before writing one:

- It pins the model and effort the worker runs at. A harness that offers this commonly defaults to inheriting the session's, which means the worker runs at the main actor's cost and the saving that motivated delegating disappears without anything reporting it.
- It places the worker at an explicit step in the resolution order rather than a discovered one.
- It can withdraw tools, which is the one place a boundary the package states in prose becomes a boundary the host enforces.

Everything else belongs in the package. A definition that also carried the decision boundary, the escalation list, the verification obligation, the commit rules, or the receipt shape would restate per agent what already arrives per run — and would drift from it the first time the package changed.

**Guidelines:**

- MUST keep a worker definition to properties of the agent — model, effort, tool limits, and a short framing — and MUST NOT restate anything the package supplies.
- SHOULD write that framing without assuming this loop: state what an implementation agent is, that it works from the prompt it was given, and that a decision it was not given goes back to whoever asked. A definition written around this loop's package stops being usable by any other caller, and stops being worth copying.
- MUST NOT preload this skill into a worker where the host offers that, since the package is self-contained by contract and preloading spends the worker's context on rules it is handed anyway.
- MUST NOT give a worker its own isolated checkout where the host offers that: the package names the branch and base revision the worker must verify, and an isolated copy will not match them.
- SHOULD withdraw the harness's GitHub channel from a worker where the host supports it, so the delivery boundary is enforced rather than trusted — noting that operations reached through a shell stay available, so this closes part of that boundary and not all of it.
