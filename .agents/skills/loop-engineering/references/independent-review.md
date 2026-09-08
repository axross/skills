# Independent Review and Readiness

Apply this reference after verified implementation and whenever external review or required checks return. Project policy chooses the reviewer and delivery mechanism; where it is silent, independent review remains mandatory.

## Independence

The author cannot certify its own work. Independence must come from the reviewer arrangement project policy requires, not from a label applied inside the authoring context.

**Guidelines:**

- MUST NOT self-certify independent review.
- MUST treat an unavailable advisory review as no waiver of mandatory external review.
- MUST request a fresh independent review after every fix batch using the project's independent-review input policy; the advisory stage's private ledger restrictions do not redefine the external review's policy.
- MUST treat missing required review material as a non-complete review result, never as a clean verdict.

## Addressing Findings

Address every blocking finding and unmet acceptance criterion, preserving finding identity and evidence between rounds. A finding that changes the approved plan returns the run to plan revision and fresh approval.

**Guidelines:**

- MUST preserve finding IDs, severities, citations, dispositions, and their fixing commits under the posted-review policy.
- MUST rerun affected verification after fixes and obtain a fresh review of the resulting content.
- MUST surface ambiguous product or architecture findings to the human rather than guessing.

## External Round Cap

The post-delivery address/review loop allows **4** rounds. After non-convergence, record unresolved findings and checks and return a decision-waiting result.

**Guidelines:**

- MUST stop autonomous addressing after four rounds and report the unresolved state.
- MUST NOT read the cap as authorization to publish, schedule, or trigger another review.

## Waiting Bound

Waiting is host execution, not loop semantics. The semantic bound remains the awaited work's declared timeout plus a margin, or **2 hours** where no timeout is declared. The budget resets when a new result arrives and a new push or equivalent revision starts fresh checks.

**Guidelines:**

- MUST report a still-pending result as partial or unavailable when the bound expires.
- MUST NOT require polling, subscriptions, schedulers, cache-TTL measurements, or a particular resume mechanism.
- MUST NOT infer scheduling permission from the existence of this bound.
- MUST stop autonomous waiting at that bound, preserving recovery evidence; human waits end the turn and are never polled. Any permitted wait mechanism is scoped to this tail and ends at readiness, non-convergence, or the waiting bound rather than watching for later human comments.

## Ready Gate

A change is ready only when all required checks are green, mandatory independent review is clean, the implemented plan revision is still approved, all required evidence is present, and the delivery target is mergeable under project policy.

**Guidelines:**

- MUST keep the change not ready while any condition above is unknown, unavailable, stale, or failed.
- MUST re-enter review when later human feedback changes delivered content.
