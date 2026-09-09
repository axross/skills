# Run State and Reporting

Apply this reference when persisting recoverable state or reporting a phase result. Storage and publication mechanics belong to the host and project; the loop owns the meaning that must survive.

## Semantic Run State

Durable state is whatever a fresh executor cannot safely derive: target, phase, approved plan revision and approval evidence, assignments and attempts, latest results, self-review evidence, checks, review round, open findings at their permitted durability, unresolved decisions or authorization, actual revision and uncommitted state, remaining processes, and unknown external effects.

**Guidelines:**

- MUST persist only through a currently permitted project mechanism and preserve append-only history.
- MUST NOT require an HTML status block, a particular service, a local path, or a byte-extraction command in the portable core.
- MUST keep evidence locators and revision identities sufficient to detect stale state.
- MUST preserve the substantive self-review outcome, unresolved findings, and limitations in permitted internal handoffs. When a persistence surface prohibits requirement-derived text, project only code or process observations and requirement locators onto that surface; the projection replaces neither the plan nor fresh review input.

## Phase Reporting

Report the result state—complete, partial, decision-waiting, authorization-waiting, unavailable, failed, or outcome-unknown—and the evidence supporting it. Exact commands and outcomes matter more than a generic success claim.

**Guidelines:**

- MUST report the approved revision, changed files or delivered content, verification evidence, review evidence, unresolved work, residual risk, remaining processes, and blockers where relevant.
- MUST distinguish skipped, unavailable, denied, failed, and unknown work.
- MUST NOT report child completion, self-review, or missing evidence as whole-change readiness.

## Ready-to-Merge Handoff

The completion report is also the human's verification brief.

**Guidelines:**

- MUST identify the work target, delivery target where one exists, approved plan revision, required-check results, independent-review outcome and round count, mergeability, and any residual risk.
- MUST give concrete manual exercise steps for human-observable changes and say plainly when none apply.
- MUST source any preview or artifact locator from verified current evidence rather than constructing it from memory.
