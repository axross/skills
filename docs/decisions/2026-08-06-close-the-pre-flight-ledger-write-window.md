---
status: accepted
---

# Close the pre-flight ledger's write window

## Context

`loop-engineering`'s optional pre-flight review stage is sold on one property: a
reviewer that carries none of the implementer's reasoning state. Four of the
stage's own rules, all in force, combined to defeat that property for the
stage's entire life. The finding ledger — the main actor's record of what a
review round found, and what it decided about it — had to live in the tracking
issue's status block, because that block is where all durable run state lives
before a pull request exists. The reviewer had to read the issue, because the
approved plan lives nowhere else at that point. And the channel that reaches
the issue could not be withdrawn from the reader, because withdrawing it would
take the plan with it. Put together, for the whole life of the stage, the
ledger sat exactly where the reviewer was required to look.

The exposure was non-deterministic rather than constant, because the status
block is an HTML comment and this project's sanctioned GitHub-operation
channel strips HTML comments on read while a byte-faithful route (`gh api`,
raw REST) returns them intact. Two review rounds could therefore differ in
independence by which route each reviewer happened to reach for, with nothing
recording which. It was confirmed live in this repository: a prior issue's
status block, read through the byte-faithful route, carried five findings by
identifier and severity with their dispositions, including two dismissals and
the main actor's stated reason for each — read through the sanctioned channel,
the same issue showed no block at all. A prior review round's own package had
also asserted that an earlier round's findings were "deliberately withheld"
while pointing the reader at the very issue that carried them.

Two designs were available: disclose the leak honestly and leave it live, or
close the write window so a reviewer is never running while the ledger is
readable. The write window was chosen, on the grounds that the stage is
advisory throughout — Phase 3's independent review remains the authoritative
gate — which makes trading some recovery fidelity for input independence
cheap rather than risky.

## The decision

The pre-flight ledger's finding entries are written to the status block only
while the run is parked on a human question, and are cleared on resume before
any further review worker is spawned. The two rules are paired deliberately:
the write rule alone would only narrow the exposure window, and only the clear
rule makes "a finding entry is readable in the issue" and "a review worker is
running" mutually exclusive states, closing the leak by construction rather
than by asking a reader not to look.

The pre-flight round number and the waiting state stay in the status block
unconditionally, since they carry no judgment to anchor on and a resume needs
them regardless of whether a park is in progress. A durable finding entry
itself carries only an identifier, a severity, and a citation — never a
disposition, a dismissal reason, claim text, or suggested-fix text, and never
a resolved finding — so what a run adds later cannot widen what already
reached the issue. "The ledger" is defined once, as session state; the status
block carries only this bounded, conditional subset of it.

## What was rejected

**Honest disclosure only.** Correct the property table and the review
package's claim, add a rule telling a reader to disregard run state it
encounters, and leave the write window unconditional. Rejected because it
converts a live leak into a disclosed one and leaves the stage's one selling
point resting on a rule nothing enforces, when a structural fix was available
at a cost the stage's advisory status makes cheap.

**Strip the ledger to identifiers.** Drop severity and citation from the
durable entry as well as disposition and claim text. Rejected because removing
severity disables the dismissal-authority split after a resume — the main
actor could no longer tell which findings need the human's confirmation — for
a marginal reduction in exposure that, under the conditional window, is only
ever live while no reviewer is running anyway.

**Relocate the ledger.** Move it out of the status block entirely. Rejected
because it requires editing either the single-status-block rule or the ban on
separate status comments, both load-bearing for the whole loop, for little
gain — the reader shares the checkout, and a separate comment on the same
issue is just as reachable as the block.

**Withdraw the issue channel, or deny only its writes.** Rejected upstream of
this decision: withdrawing the channel wholesale takes the specification with
it, since the approved plan lives nowhere else before a pull request exists;
denying only writes drifts with the channel's surface while still reading as
enforcement rather than being it.

**Enumerate the reader's permitted tools.** Rejected by a standing rule in the
same reference: a short list of permitted tools is a guess at what reviewing
will require, and an under-equipped reader does not fail to start — it runs,
silently cannot check what it cannot reach, and returns findings
indistinguishable from a clean review.

## Consequences accepted

A reader that encounters run state despite the write/clear pairing — because a
run skipped the clear step, or was interrupted between a resume and the next
spawn — is asked to disregard it and report having seen it, and nothing here
enforces that beyond the run reporting the disclosure when a reviewer
volunteers it. That residual was accepted deliberately: the alternative was
either a rule that also could not be enforced, or a mechanism this decision
already rejected on other grounds.

A session lost while a ledger's entries are not in the status block — most of
the stage's life, under the new window — is recovered by re-running the
pre-flight review from scratch rather than resuming from a recorded ledger.
This is already the prescribed recovery for a block that cannot be read back;
the conditional window makes that branch more common, not new, and the
stage's advisory status is what keeps the added cost to worker spawns and
wall-clock rather than correctness.
