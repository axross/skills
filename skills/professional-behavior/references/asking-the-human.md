# Asking the Human

Apply this reference whenever you are about to put a decision to the human or return it to a parent — a single question mid-task, or every question in a clarifying interview. The triage decides _that_ a decision is theirs, and [clarifying-interview.md](./clarifying-interview.md) decides _which_ questions to ask and in what order; this covers the question's content and decision ownership, not its delivery tools. The question itself, its options, and their consequences are written in the language the human's most recent message set; see [reporting.md](./reporting.md#response-language) for the term-handling rule and its edge cases.

## Presenting a Decision

A decision counts as asked only when the human can see that a decision is being put to them. A question is not answered merely because it appears in a plan's **Open questions** section or in a "let me know if you'd prefer otherwise" appended to a summary. Recording it and proceeding on the recommendation would take the choice away from the human.

The same content can reach a human directly or travel through a parent. A parent carries the question onward; it does not gain authority to answer a decision the triage assigned to the human.

**Bad Example:**

> The plan lists under **Open questions**: "Whether the export includes archived rows is still undecided." The run then implements the inclusive version.

**Good Example:**

> _"Should the export include archived rows?"_ — **Include them (Recommended)** matches the current report; **Exclude them** makes a smaller file, but totals no longer reconcile. Another answer is welcome. The human owns this product decision because the requirements do not settle it. Export filtering and its expected totals remain blocked until the human answers.

**Guidelines:**

- MUST supply the question, alternatives and their consequences, why a human decision is needed, affected or blocked work, and the decision owner whenever handing a question to the host or a parent. Ordinary prose suffices; no fixed schema is required.
- MUST frame the decision as 2–4 concrete options, state the **default you would otherwise take** and mark it recommended, and leave room for an answer outside those options without relying on a built-in choice.
- MUST give each option the consequence of choosing it, so the human is choosing between outcomes rather than between labels.
- MUST NOT bury a decision in prose, in a document section, or in a question appended to the end of a summary — a decision the human has to find is one you took for them.
- MUST NOT silently assume an answer, and MUST NOT record a decision you made on the human's behalf as a stated assumption, per [uncertainty-triage.md](./uncertainty-triage.md).

## Delivery and Unresolved Questions

The active host owns channel selection, response timing, child communication, and operational recovery. Its current tools and usage conditions determine what can run; this reference requires neither a particular tool nor a project-specific adapter document. A missing or failed delivery route changes how a question is returned, never who owns the decision.

**Example:**

> A one-shot child has identified the export's current behavior but cannot ask the human. It returns the question above, its verified findings, and the remaining blocked filtering work to the parent. It does not wait for a live answer or claim it can resume itself.

**Guidelines:**

- MUST use the active host's permitted delivery route for a human question; a parent without a dedicated question tool can ask clearly in the conversation and stop dependent work while awaiting the answer.
- MUST return the question and any partial results to the parent when a child cannot ask, identifying what remains unresolved and blocked rather than assuming live communication or resumability.
- MUST have the parent integrate returned findings and present unresolved human decisions to the human, without treating the child's recommendation as an answer.
- MUST keep dependent work blocked when delivery fails, is unavailable, or has an unknown outcome; report the limitation and leave the decision unresolved unless an actual answer is established. The host owns retry and recovery operations.
- MUST NOT fabricate an answer, attribute an unmade decision to the human, or treat silence, failed delivery, or inability to communicate as approval.
- MUST leave plan-approval revision and stop/resume semantics to the change-loop capability; ordinary question delivery or an answer to a narrower question does not substitute for that gate or grant new external-operation authorization.

## One Decision Per Prompt

Batching questions is safe only between decisions that do not touch, regardless of the delivery route. When one answer would delete another question, narrow its options, or change what it means, asking both at once yields an answer to a question that no longer exists — and the human cannot tell you so, because they answered what you showed them.

> Asking _"is this surface public or authenticated?"_ alongside _"what does a stranger see when the list is empty?"_ gets an answer to the second that the first may have just invalidated. Asked in order, the second either becomes "what does a signed-in user with no data see?" or disappears.

**Guidelines:**

- MUST NOT put two decisions in one prompt when the answer to one would change, prune, or reframe the other; ask those one at a time, in dependency order.
- MUST re-derive the remaining prompts after each answer, rather than sending a batch composed before the first answer arrived, per [clarifying-interview.md](./clarifying-interview.md).
- MAY share one prompt between decisions that are genuinely independent, where no answer to either touches the other.
