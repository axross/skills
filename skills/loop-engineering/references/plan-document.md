# Plan Document

Apply this reference when writing the Phase 1 plan into the issue body. A plan states **what** is needed and **how completion is verified**, not how it is built. This structure is self-contained; when the host project ships its own product-requirement guideline, defer to it for section craft and use this as the fallback.

## Canonical Structure

Every plan follows this seven-section order. **Required** sections are always present; **conditional** sections are included when they apply and omitted with a one-line stated reason when they do not.

1. **Summary** _(required)_ — one standalone paragraph a reader can grasp without the rest.
2. **Background** _(required)_ — with **Goals**, **Non-goals**, and **Assumptions** subsections.
3. **Functional requirements** _(conditional)_ — with **UI design** and **System design** nested under it; the latter carries an **Alternatives considered** subsection when a plausible competing approach exists.
4. **Non-functional requirements** _(conditional)_ — performance, security, accessibility, compatibility budgets that constrain the change.
5. **Acceptance criteria** _(required)_ — the checkable list the reviewer verifies against the finished pull request.
6. **Verification strategy** _(required)_ — which checks and manual steps prove each acceptance criterion.
7. **Open questions** _(required, may be empty)_ — unresolved decisions and who must answer them.

**Guidelines:**

- MUST include every required section and follow this order; omit a conditional section only with a one-line stated reason so a reader knows it was considered.
- MUST right-size each section to the change — a one-file fix needs a paragraph per section, a cross-cutting feature needs the full treatment.
- MUST separate stated **Assumptions** (decided, recorded) from **Open questions** (undecided, needing an answer); never leave a Must-ask decision buried as an assumption.
- MUST frame **Goals** and **Non-goals** as concrete, checkable outcomes, not vague quality adjectives.
- SHOULD add the **System design › Alternatives considered** subsection whenever a reviewer would reasonably ask "why not the other approach?".

## Acceptance Criteria

Acceptance criteria are the contract the reviewer checks the finished pull request against. Each must be verifiable by observation, not by trusting intent.

**Guidelines:**

- MUST write acceptance criteria as a plain bullet list, not GitHub `- [ ]` checkboxes — nothing checks those boxes, so they read as perpetually incomplete.
- MUST make each criterion a single observable outcome ("an empty list renders the empty-state copy", not "handle empty lists well").
- MUST cover the not-default paths the change touches — empty, error, loading, unauthorized, and boundary states — not only the happy path.
- SHOULD state the criterion in terms of user- or caller-visible behavior, so it survives an implementation change.

## Plan Revision Identity

A plan that can be delegated needs a name for _which_ plan was approved. Human approval binds to that identity, and a worker checks it before editing — so an edit made after the plan moved is caught rather than discovered later in review.

The **canonical plan content** is the issue body from its first section heading through the end of Open questions, excluding the status block and any archived original description. The boundary is stated in headings rather than HTML constructs because a sanitizing read removes the latter and leaves the former intact.

**Guidelines:**

- MUST derive a stable revision for the canonical plan content — a digest of it, or another immutable identity offering equivalent guarantees — store it in the status block, bind the human's approval to it, carry it in any implementation package, and invalidate approval when the canonical content changes.
- MUST NOT treat an issue-wide `updated_at` timestamp as that identity on its own; unrelated issue metadata moves it.
- MUST decode HTML character references, numeric and named alike, before comparing — and apply no other normalization, since each further rule is another way for a real difference to be masked.
- MUST stop before editing on a mismatch, whichever of its two causes applies: the plan moved, or the channel degraded the read. Distinguishing them is the main actor's job, not the reader's.

## Archiving the Original Description

The original description is provenance rather than specification, and the canonical content above already excludes it. Where the body cannot spare the room, it belongs in a marked comment instead of a collapsed section — a comment is reachable through any read channel, and a collapsed section is not.

**Guidelines:**

- MUST NOT compose a new body from a body read back through a sanitizing channel; such a read silently drops the collapsed section, the status block, and angle-bracket text in the prose.
- SHOULD move the original description into a marked archival comment, leaving a link to it in the body, whenever keeping it inline would leave no room for a later plan revision to rewrite the body.

## Visual Change Options

Any visual change — a public surface, the application UI, or an admin view a human operates — is decided by the human at the plan-approval gate from a set of options, never from a single implied design. The visual direction is therefore never a Must-ask question; it is settled through this exhibit.

**Guidelines:**

- MUST, for any visual change, present the UI design section as a choice of **2–4 distinct** presentation options rather than one design, and record the human's choice in the issue as the design source of truth.
- SHOULD climb a fidelity ladder — a low-fidelity wireframe round to settle layout and hierarchy, then a high-fidelity round to confirm the concrete look — approving one round at a time.
- SHOULD publish each round as a rendered artifact the human can view, and link the chosen design from the pull request description so reviewers can compare the build against it.
- MUST NOT enter Code until the final design round recorded in the issue has been approved; a plan with no visual change proceeds on plan approval alone.
