# Pre-Flight Review

Apply this reference after a delegated implementation worker returns and the completion-evidence check has run, and before the pull request is opened. It adds one optional stage: a second, review-only worker that judges the diff, and an implement→review loop that runs until every finding it raises has reached a terminal state.

The stage exists to buy **one** property of independent review cheaply — a reviewer that does not carry the implementer's reasoning state — and it explicitly buys no others. It is advisory. [Phase 3](../SKILL.md)'s independent review remains the authoritative gate, and nothing here weakens it.

Like delegation itself, the stage is conditional on the harness already exposing a worker that qualifies. With none, the run behaves exactly as it does without this reference.

## What the Stage Does and Does Not Reproduce

The case for running review outside the session is usually stated as one property. It is several, and they separate — which is why this stage can be worth running and still not replace the external one.

| Property                                                                                | External review                             | Pre-flight review                                                          |
| --------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| **Context independence** — no memory of its own decisions, no anchoring on its own plan | yes                                         | **yes** — what this stage buys                                             |
| **Input independence** — reviews the diff, not the author's narration of it             | yes                                         | **partly** — recovered by fixing the input source below                    |
| **Verdict independence** — the reviewed party cannot suppress a finding                 | yes                                         | **partly** — recovered for Critical and Major by the dismissal split below |
| **Absence visibility** — a review that never ran is externally observable               | yes                                         | **no** — a stage never entered leaves no gap                               |
| **Policy-source independence** — the policy is not the one this change edits            | yes                                         | **partly** — recovered by the merge-base read below                        |
| **Environment independence**                                                            | yes                                         | **no** — shares the checkout, uncommitted state included                   |
| **Cost**                                                                                | consumes the polling tail and the round cap | **seconds to minutes**, consumes neither                                   |

Absence visibility is the one no arrangement here recovers, because the reviewed party holds the report. It is an accepted limit, and a reason the external review stays exactly as it is.

**Guidelines:**

- MUST treat every pre-flight finding and verdict as advisory, and MUST NOT report this stage — under any name — as the independent review; the draft→ready flip stays gated on a clean external review plus green CI.
- MUST skip the stage where no compatible review worker resolves, falling back to what the run already has: the implementation worker's own self-check reported in its receipt plus the completion-evidence check, or [Phase 2](../SKILL.md)'s reviewer-mode self-check in single-agent mode. No gate is weakened either way.
- MUST resolve a review worker by the precedence shape [implementation-worker.md](./implementation-worker.md) uses for the implementer — one the project or host names explicitly, then a custom agent, then a harness built-in — but MUST end that sequence at **none**, never at its fourth step. That step is the main actor in single-agent fallback, and a main actor reviewing its own diff reproduces none of what this stage buys: falling back there would produce self-review presented as a pre-flight review, which the first rule of this section forbids. With no candidate, the stage is skipped rather than performed by the main actor.
- MUST NOT reuse that reference's exclusion criterion or its compatibility preflight. Both are written around implementing: the exclusion rejects "a read-only, review-only, or explicitly non-editing agent" by name, and the preflight requires the candidate edit files and create commits. Applied here they would filter out precisely the agent this stage wants.
- MUST qualify a review worker on reader capability instead — it can read the checkout and the diff, run read-only commands, and report findings back to the parent. An agent whose definition forbids editing qualifies here **because** it does; an implementation-capable agent also qualifies when its tools are narrowed to read-only for the spawn.

## Review Package — the Input Contract

A reviewer handed the implementer's account of its work inherits the implementer's framing, which is most of what the stage exists to avoid. The package is therefore built from repository and issue state only.

It carries the diff of the working branch against its recorded base revision; the project's review policy and skills **read at the merge base**; and the approved plan with its revision identifier, from the tracking issue.

Reading the policy at the merge base is what stops a change that edits the review policy from being judged by the policy it introduces. The completion-evidence check already treats "review-policy files changed" as a targeted-diff trigger (see [writer-ownership-and-recovery.md](./writer-ownership-and-recovery.md)); this is the pre-flight counterpart to that trigger, not a second statement of it.

**Guidelines:**

- MUST build the package from the diff, the merge-base policy, and the approved plan — and MUST NOT include the implementation worker's completion receipt, or any summary derived from it, in what the reviewer reads.
- MUST read the review policy and the project skills at the merge base rather than from the working tree.
- MUST apply the project's review policy in full, using its internal severity scale rather than the vocabulary reserved for posted review comments; the dismissal split below depends on that scale being the one in use.

## The Reviewer Is a Reader

[writer-ownership-and-recovery.md](./writer-ownership-and-recovery.md) tracks exactly one writer — no writer, the main actor, or one worker instance — and has no position for a participant that writes nothing. The review worker is that participant, and saying so is what keeps it out of the lease accounting.

**Guidelines:**

- MUST leave the writer lease with the main actor for the duration of the review; the review worker never acquires it and never mutates the checkout.
- MUST NOT treat the review worker as the second implementation worker [delegated-execution.md](./delegated-execution.md) forbids spawning; a reader is not one, which is why that prohibition does not reach it.
- MUST NOT spawn the review worker while an implementation worker is still running: the stage begins only once one has returned and the completion-evidence check has run. The rule above places a reader outside the second-worker prohibition, and that carve-out would otherwise read as licence to run the two concurrently — which is the concurrency the prohibition exists to prevent.

## A Fresh Reviewer Each Round

The surrounding rules are resume-preferred: the Retry Budget prefers resuming the same worker, and so does Phase 4 delegation. For an implementer that is right — continuity is cheap and valuable. For a reviewer it is backwards, because a resumed reviewer carries its own prior "this area is fine" verdicts, which is the anchoring the stage exists to avoid.

**Guidelines:**

- MUST spawn a fresh review worker for every round, never resuming the previous one — this inverts the resume-preferred default around it deliberately, and is not an oversight.

## Finding Ledger

The main actor translates findings into implementation instructions, and that translation is where a finding silently narrows or disappears. A fixed protocol carries fidelity across it; prose does not.

Each finding carries a stable identifier, a severity, a `file:line` citation, the claim, and a suggested fix — the shape the project's review policy already requires of review output. This is a protocol, not a transcript.

**Guidelines:**

- MUST carry each finding's identifier, severity, and citation through the translation into an implementation instruction, and MUST NOT drop a finding by omission.
- MUST NOT open the pull request while any finding lacks a terminal state. There are three: **fixed**, tied to the commit that fixed it; **dismissed** with a recorded reason, under the authority split below; and **deferred**, which only the declined-round path below produces and which no other route may reach.
- MUST route a finding that would change the approved plan through the plan-revision flow — fresh approval, fresh worker — exactly as a Phase 4 finding of the same kind is routed.

## Ledger Durability

This stage parks the run on a human question in two places, so a ledger held only in session context breaks the resume model. The status block carries it, and carries only what a fresh session cannot re-derive: a fresh review worker produces a _different_ finding set, so a lost ledger is not recoverable by re-running the review.

**Guidelines:**

- MUST record the pre-flight round number, the waiting state, and every **open** finding by identifier, severity, and citation in the status block; resolved findings are not written, since the commit that fixed each one is already in Git history.
- MUST re-run the pre-flight review from scratch where the status block cannot be read back, and MUST NOT treat the stage as complete on a ledger it cannot show.

## Dismissal Authority

The main actor wrote the plan and is accountable for the run converging. Letting it dismiss any finding alone leaves the verdict-independence hole open at exactly the findings where suppression costs the most; confirming every dismissal with the human would make a Nit block on a human response. The split lands between those.

**Guidelines:**

- MAY dismiss a **Minor** or **Nit** finding on the main actor's own judgment, with the reason recorded in the ledger.
- MUST obtain the human's confirmation, through the question tool, before dismissing a **Critical** or **Major** finding — routed as the normal decision path already routes a decision belonging to the human.
- MUST NOT re-grade a finding's severity; the grade is the review worker's. Without this the split is trivially evaded, because the party wanting the dismissal would otherwise set the grade that decides whether it needs confirmation.

The residual exposure is a review worker that under-grades on its own, which the no-re-grading rule does not address. It is accepted: the reviewer has no stake in the run converging and therefore no incentive to under-grade, whereas the main actor has both.

## Round Cap and Escalation

Each fix round is a new task phase, so it carries a fresh [Retry Budget](./writer-ownership-and-recovery.md) of one attempt plus two retries — consistent with that budget already excluding a new review round from counting against it. A round whose implementation exhausts that budget recovers the way any other does, in single-agent mode, and then continues to the next review round; the budget governs attempts inside a round, this cap governs rounds. Stated plainly so the cost is disclosed rather than discovered: four rounds at three attempts each is up to twelve implementation-worker spawns, plus up to four review workers, before the first human question. That envelope is why the cap is three rather than higher.

**Guidelines:**

- MUST run at most one initial implementation plus **3** review→fix rounds autonomously, then ask the human — through the question tool — whether to run another; ask once per additional round, for as many as the human keeps approving, with no ceiling above their judgment.
- MUST state, in that question, how many findings are still open and at what severities, naming each **Critical** or **Major** among them. Declining decides the disposition of those findings, not only whether to spend another round, and a human not told what remains open cannot make that decision. Without this the dismissal split above is bypassable: a Critical the main actor could not dismiss alone would instead be disposed of by an uninformed answer to a different question.
- MUST, where the human declines another round, record every still-open finding as **deferred** and then open the draft pull request with those findings in its body. The decline is that decision — made by the human, over the whole remaining set at once, and informed by the disclosure the rule above requires — which is why it needs no further per-finding confirmation and why it is neither a fix nor a dismissal; recording it as either would misstate what happened. **The human's decision is the license and the only license** — citing the external review's existence as the reason it is acceptable is the rationalization the loop's own rules forbid; that the external review still gates the change states what declining does not weaken, never why it is allowed.
- MUST keep this cap distinct from the address↔review cap in the Termination Guard, which governs the loop after the pull request exists.

## Defining a Reader of Your Own

A project does not have to define a review worker at all — resolution accepts one the harness already exposes, and an agent whose definition forbids editing qualifies here because it does. [implementation-worker.md](./implementation-worker.md)'s section on defining a worker owns what any such definition carries and what it must leave to the package, and that guidance applies here unchanged. This section states only where a reader departs from it.

The departure is the tool posture, and the same reasoning that picks one instrument there picks the opposite one here. A definition constraining an implementer withdraws a channel from a broad surface that moves with the host, so a denylist is the stable expression of it. A reader's surface is narrow, stable, and the very thing being constrained — so an allowlist is the stable expression, and its failure mode is the one to prefer: an entry that stops resolving fails the spawn loudly, where a denylist admits a newly added writing tool in silence.

**Guidelines:**

- SHOULD state a reader's tools as an allowlist rather than a denylist where the host offers both, admitting only what reading the change requires.
- MUST withdraw the harness's GitHub channel from a reader where the host supports it. For an implementer that enforces the delivery boundary; here it also protects the input contract above, because a reader that can reach the pull request or the issue thread can reach the author's account of the change.
- MUST NOT let a reader load the project's skills or review policy itself where the host offers that, since the package supplies them read at the merge base and a reader loading them reads the working tree's copy instead — the substitution that read exists to prevent.
- SHOULD withhold the ability to spawn further agents, so a reader cannot reach a writer through one.
- MUST NOT describe a reader as read-only while a general-purpose shell remains, since reading a change requires one; state which part of the constraint the host enforces and which stays a rule the reader is asked to honor.
