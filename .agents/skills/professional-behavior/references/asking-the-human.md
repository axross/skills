# Asking the Human

Apply this reference whenever you are about to put a decision to the human or return it to a parent — a single question mid-task, or every question in a clarifying interview. The triage decides _that_ a decision is theirs, and [clarifying-interview.md](./clarifying-interview.md) decides _which_ questions to ask and in what order; this covers the question's content, who owns the decision, and which kind of route it goes through — never which tool a given runtime names for that route. The question itself, its options, and their consequences are written in the language the human's most recent message set; see [reporting.md](./reporting.md#response-language) for the term-handling rule and its edge cases.

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

## Choosing the Route

A runtime that provides a **dedicated question mechanism** — one that renders the options as a choice the human acts on and returns the answer inline, so the work continues in the same turn — makes the question unmissable in a way prose cannot. The same decision written into a paragraph is indistinguishable from commentary: it gets read past, and the work proceeds on whatever you would have chosen anyway. That is the failure this section exists to prevent, and it looks diligent from the inside, because the decision was written down somewhere.

So the route is chosen by what the session actually exposes, never by what a host is assumed to provide. Which mechanism a given runtime offers, and how it is invoked, belongs to that runtime's own operations guidance rather than here; this reference requires no particular tool and no project-specific adapter document. A missing or failed route changes how a question is returned, never who owns the decision.

**Guidelines:**

- MUST put a decision the triage assigned to the human through the runtime's dedicated question mechanism wherever the session exposes one, judged from the tools actually available rather than assumed from the host or the mode, and MUST NOT skip it in the expectation that it is absent.
- MUST put the same options into the turn output and stop, rather than deciding, only where the session exposes no such mechanism at all. That is the floor, not the preference: what it rules out is deciding, never reaching for something better.
- SHOULD use a more interruptive channel over the turn output where the runtime offers one and no dedicated mechanism exists — a channel counts as more interruptive when it puts the decision in front of the human rather than waiting to be read, which the turn output of an unattended session does not. Whether any such channel exists is the runtime's own question; where none does, the turn output is both the floor and the whole of it.
- MUST re-present a prompt that was closed, cancelled, errored, or left unanswered — showing the decision in plain text first, then asking again with the same options in the same order — rather than routing around the human or reporting the work as blocked. A transient stream closure and a genuinely headless run return the same error, so the error alone does not tell them apart.
- MUST read a bare answer token on a later turn — an option number, a label, or free-form text — as answering the still-open question, reconciled against the options you presented, rather than as a new instruction or a reason to restart.

## Returning a Question You Cannot Ask

A question does not stop being the human's to answer because the actor holding it has no way to reach them. What changes is the direction it travels: back to whoever asked, together with what was already established, so the parent can put it to the human and the work resumes from evidence rather than from a guess.

**Example:**

> A one-shot child has identified the export's current behavior but cannot ask the human. It returns the question above, its verified findings, and the remaining blocked filtering work to the parent. It does not wait for a live answer or claim it can resume itself.

**Guidelines:**

- MUST return the question and any partial results to the parent when a child cannot ask, identifying what remains unresolved and blocked rather than assuming live communication or resumability.
- MUST have the parent integrate returned findings and present unresolved human decisions to the human, without treating the child's recommendation as an answer.
- MUST keep dependent work blocked when delivery fails, is unavailable, or has an unknown outcome; report the limitation and leave the decision unresolved unless an actual answer is established.
- MUST NOT fabricate an answer, attribute an unmade decision to the human, or treat silence, failed delivery, or inability to communicate as approval.
- MUST leave plan-approval revision and stop/resume semantics to the change-loop capability; ordinary question delivery or an answer to a narrower question does not substitute for that gate or grant new external-operation authorization.

## One Decision Per Prompt

Batching questions is safe only between decisions that do not touch, regardless of the delivery route. When one answer would delete another question, narrow its options, or change what it means, asking both at once yields an answer to a question that no longer exists — and the human cannot tell you so, because they answered what you showed them.

> Asking _"is this surface public or authenticated?"_ alongside _"what does a stranger see when the list is empty?"_ gets an answer to the second that the first may have just invalidated. Asked in order, the second either becomes "what does a signed-in user with no data see?" or disappears.

**Guidelines:**

- MUST NOT put two decisions in one prompt when the answer to one would change, prune, or reframe the other; ask those one at a time, in dependency order.
- MUST re-derive the remaining prompts after each answer, rather than sending a batch composed before the first answer arrived, per [clarifying-interview.md](./clarifying-interview.md).
- MAY share one prompt between decisions that are genuinely independent, where no answer to either touches the other.
