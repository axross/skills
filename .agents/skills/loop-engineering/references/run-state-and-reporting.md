# Run State and Reporting

Apply this reference when persisting recoverable state or reporting a phase result. Storage and publication mechanics belong to the host and project; the loop owns the meaning that must survive.

## Semantic Run State

Durable state is whatever a fresh executor cannot safely derive: target, phase, approved plan revision and approval evidence, scoped operation grants, assignments and attempts, latest results, self-review evidence, checks, review round, open findings at their permitted durability, unresolved decisions or authorization, the execution arrangement and how it was settled, actual revision and uncommitted state, remaining processes, and unknown external effects.

**Guidelines:**

- MUST persist only through a currently permitted project mechanism and preserve append-only history.
- MUST NOT require an HTML status block, a particular service, a local path, or a byte-extraction command in the portable core.
- MUST keep evidence locators and revision identities sufficient to detect stale state.
- MUST record how the execution arrangement was settled, not only which one ran: what the determination rested on, quoted where it rests on a stated condition and recorded as an observation where it rests on none, and whether a question was ever put to the human. A record naming no grounds is incomplete, and recording a decline the human never gave claims an answer nobody made.
- MUST preserve the substantive self-review outcome, unresolved findings, and limitations in permitted internal handoffs. When a persistence surface prohibits requirement-derived text, project only code or process observations and requirement locators onto that surface; the projection replaces neither the plan nor fresh review input.

## Scoped Operation Grants

An operation grant records actual human authorization for one or more concrete effects. It remains separate from plan approval, execution capability and a host's permission to use a tool. Compatible effects may share one grant, but the grant is no broader than the targets, operations and consequences the human authorized.

**Guidelines:**

- MUST record each grant's target, permitted operations, human-evidence locator, applicable route and lifetime, limits, and explicit exclusions without credentials or sensitive payloads.
- MUST name an automation trigger's intended downstream effects, including billed execution, protected-context access or publication where applicable, before treating those effects as part of the grant.
- MUST compare every proposed effect with the recovered target, operation, route, lifetime, limits and exclusions; carry a matching grant forward across phases, sessions and executors, and ask only for an absent or expanded effect.
- MUST treat a changed target, route, expired lifetime, exhausted limit or missing evidence as authorization-waiting for the unmatched effect, without blocking independent effects covered by another valid grant.
- MUST NOT infer setup, secrets, settings, production enablement, readiness publication, merge, release, deployment or scheduling authority from a grant that does not name that effect.
- MUST NOT bind a grant to an exact material revision unless the human explicitly made that revision part of its scope; material currency and review validity remain separate evidence questions.

## Phase Reporting

Report the result state—complete, partial, decision-waiting, authorization-waiting, unavailable, failed, or outcome-unknown—and the evidence supporting it. Exact commands and outcomes matter more than a generic success claim.

**Guidelines:**

- MUST report the approved revision, changed files or delivered content, verification evidence, review evidence, unresolved work, residual risk, remaining processes, and blockers where relevant.
- MUST distinguish skipped, unavailable, denied, failed, and unknown work.
- MUST NOT report child completion, self-review, or missing evidence as whole-change readiness.

## Model and Effort Certainty

Whether an actor is _capable_ and which model it _ran_ are separate questions, and a host may answer the second only partially. Reporting a configured value as a confirmed one turns an unverified assumption into a claim the human cannot audit, so each is classified rather than asserted:

- `verified` — a runtime, transcript, or telemetry reading confirms the actual value
- `declared` — configuration or a spawn argument states the value, but what ran could not be independently confirmed
- `unknown` — the session exposes too little to say

**Guidelines:**

- MUST classify model and effort with one of those three values, independently of each other, for every role the run delegates to, and MUST NOT report a `declared` value as `verified`.
- MUST treat a spawn-time model argument that overrides an actor definition's pinned value as discarding that pin, and MUST NOT report the pinned value as what that run used — it is not even `declared` for that run. Record the override and its reason.
- MUST NOT require a runtime-verified value before delegating; a stricter policy than this belongs to a project or host that wants it.
- MUST fold the classification into the completion report for every role the run delegated to, rather than into a separate activity log beside it.

## Ready-to-Merge Handoff

The completion report is also the human's verification brief.

**Guidelines:**

- MUST identify the work target, delivery target where one exists, approved plan revision, required-check results, independent-review outcome and round count, mergeability, and any residual risk.
- MUST give concrete manual exercise steps for human-observable changes and say plainly when none apply.
- MUST source any preview or artifact locator from verified current evidence rather than constructing it from memory.
