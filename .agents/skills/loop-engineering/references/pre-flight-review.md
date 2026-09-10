# Pre-Flight Review

Apply this reference when project policy selects an advisory review before delivery. Its absence or unavailability never substitutes for or waives mandatory independent review.

## Review Input

Review the actual target revision and uncommitted diff, not an implementation receipt. Include the approved plan, applicable project review policy, required artifacts, and source/workspace identity. Run state is neither review evidence nor part of the verdict; disclose encountering it and exclude it from judgment.

**Guidelines:**

- MUST use an assignment satisfying the review contract in [implementation-package.md](./implementation-package.md), including every required material at its declared fidelity.
- MUST use a fresh review context each round and re-review after every fix batch.
- MUST NOT present parent self-review or an unavailable advisory review as independent review.
- MUST review correctness against the approved criteria, maintainability, security, and test coverage; use Critical, Major, Minor, and Nit severities, honoring any stricter project policy.
- MUST build input from the review directive, current project policy, approved plan, and actual diff, in that order, excluding the implementer's receipt and summaries derived from it. Reading encountered run state is disclosed, not claimed mechanically impossible.
- MUST review only a stable target without a competing writer. A plan change abandons the current round and requires approval and fresh review, not transfer of its findings into a new plan's verdict.

## Finding Ledger

The ledger preserves findings through translation and recovery. Each finding has an ID, severity, citation, claim, suggested fix, disposition, and reason.

**Guidelines:**

- MUST preserve each finding's ID, severity, and citation without omission or regrading.
- MUST give every finding one terminal state: **fixed**, **dismissed**, or **deferred**.
- MUST tie `fixed` to the fixing commit; the parent MAY dismiss Minor or Nit with a recorded reason, but MUST obtain human confirmation before dismissing Critical or Major and record that reason too.
- MUST use `deferred` only when the human makes an informed decision to decline another round.
- MUST NOT deliver the draft pull request while a finding in the current round lacks a terminal state. Superseded-plan rounds are abandoned, not silently treated as resolved.

## Durable Parks

Persisting full review reasoning can anchor a fresh reviewer. The session keeps the full ledger. Durable finding entries are restricted to the human waits for a Critical/Major dismissal or an additional round; a plan change abandons the round instead.

**Guidelines:**

- MUST persist only each open finding's ID, severity, and citation across a park, plus round and waiting state.
- MUST clear persisted findings before another review and re-run the ledger from scratch if that durable subset is lost.
- MUST NOT give prior findings, receipts, dispositions, or run state to the next reviewer as review input.
- MUST keep round and waiting state durable throughout the stage, not only at a park. Never persist resolved findings, claims, suggested fixes, dispositions, or reasons in that recovery subset.
- MUST re-run review where no recoverable ledger exists, including an interruption between parks; missing entries never establish completion.

## Deferred Handoff

An informed decline ends the advisory round without erasing its remaining risks. Its substantive handoff is a terminal human record, not the narrow recovery subset kept while a review may resume.

**Guidelines:**

- MUST retain each deferred finding's ID, severity, citation, claim, suggested fix, `deferred` disposition, decision reason, and supporting evidence, together with the advisory round, reviewed material identity, and human-decision evidence.
- MUST make that substantive record accessible to the human through a permitted project mechanism and identify it as handoff evidence, not canonical requirements or review input.
- MUST NOT provide the substantive handoff, its findings, or its dispositions as input to a later fresh advisory review or use it as replacement input for mandatory external review. A publicly readable record does not promise reviewer invisibility.
- MUST keep delivery incomplete when the substantive handoff cannot be persisted or published, report the missing effect, and preserve the full ledger in the current permitted internal handoff rather than reducing it to the durable-park subset.
- MUST report a missing substantive record after interruption as unavailable evidence and preserve only verified decision and process facts. Never reconstruct lost finding substance or treat the gap as permission for a new review round; any new finding set follows the ordinary round and informed-decision rules.

## Round Cap

The autonomous pre-flight envelope is the initial implementation plus **3** review/fix rounds. Each round's execution has its own initial-plus-two retry budget.

**Guidelines:**

- MUST ask the human once for each additional round, disclosing the count and severities of open findings and naming every open Critical or Major.
- MUST mark all still-open findings `deferred`, preserve them through the substantive handoff, and keep the delivered change in draft when the informed human declines another round.
- MUST NOT treat this cap as permission to schedule work or as a replacement for external independent review.
