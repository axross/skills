# Phase Progression

Apply this reference to a change, not a read-only question, investigation, or review. Project policy chooses gates; execution and delivery mechanisms realize them without changing their meaning. A missing adapter is not a missing contract: use the host's published, permitted tools directly, or identify the particular capability or authorization that prevents the next transition.

## Intake and Defaults

A named issue enters planning; an existing pull request enters recovery and addressing. A free-form change first needs a durable tracking target. These defaults preserve the loop's issue → plan → draft pull request path when a project supplies no more-specific change policy. They are not permission to make an external write.

**Guidelines:**

- MUST identify the change target and applicable project policy before planning; by default anchor a new change in a tracking issue before planning or edits, and reconstruct an existing pull request rather than restarting it.
- MUST record the plan in that durable target before requesting approval; a private local plan-mode artifact alone does not satisfy this gate.
- MUST surface an authorization or capability blocker when a required delivery operation cannot be performed; never silently replace a mandatory target or gate with an easier one.
- MUST use the default independent-review arrangement where project policy is silent: a separate session on separate infrastructure, under a bot identity distinct from the connected operator. A review produced inside the authoring session is self-review, regardless of its name.

## Execute and Verify

The approval binds the outcome; the assignment binds the execution. Parent and child implementations carry the same verification burden. The project's software-development and specialist capabilities own how to implement and test, and its code-review and QA capabilities own diff judgment and evidence adequacy.

**Guidelines:**

- MUST implement only the current approved plan, preserve unrelated changes, and resolve the execution arrangement before the first edit.
- MUST run the required formatting, lint, type, test, and surface-specific checks using documented project commands; disclose every failed or skipped check and its residual risk.
- MUST perform a reviewer-mode self-check against the request and actual diff before delivery, fixing obvious Critical or Major problems; a child's self-check is checked against its receipt and actual state, not treated as independent review.
- MUST perform the advisory pre-flight stage by default after verified initial implementation, regardless of the implementation actor, when a compatible reader is permitted and available; when host conditions or missing material rule it out, record the exact unavailable reason, never report a clean result, and preserve the external gate.
- MUST preserve branch history, work outside the default branch, and refrain from pushing to the default branch or merging the change under the default policy. A child may not publish merely because it owns implementation.

## Deliver and Address

The default delivery is a draft pull request linked to its tracking issue. Delivery owns its template, assignment, comment routing, trigger and persistence representation; the loop owns whether the evidence permits progress.

**Guidelines:**

- MUST open delivery in draft by default and include the approved scope, verification evidence, acceptance status, and recovery information; request the project's required independent review through a permitted route.
- MUST address blocking findings and unmet acceptance criteria on the same delivery target, correlate every fixed finding with its fixing commit, rerun affected checks, and obtain fresh review after fixes.
- MUST preserve human decisions already settled in the plan rather than re-offering them as open choices to a reviewer.
- MUST keep mandatory review marked unmet when it cannot be obtained; no self-check, advisory review, or unavailable reviewer certifies readiness.
- MUST move to ready only after [independent-review.md](./independent-review.md)'s ready gate, report the evidence, and leave merging to the human under the default policy.
- MUST return to addressing after later human feedback, restoring draft status when necessary and requiring fresh review of changed content.
