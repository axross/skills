# Clarifying Interview

Apply this reference at the Phase 1 clarify-before-building gate, from the moment investigation ends until the plan is written. Investigation resolves _how_ to build; the interview resolves _what the product should do_. It is one continuous conversation, not a form to fill in: each answer changes which questions are still worth asking, so the question set is derived as you go rather than fixed up front.

## Facts and Decisions

Every open item is one of two kinds, and the kind decides who answers it. Sorting wrong is expensive in both directions — asking about a fact spends the human's attention on something a tool call would have answered, and quietly resolving a decision ships your taste as if it were their requirement.

A **fact** is anything the environment can answer: the filesystem, the code, project conventions, a dependency's documentation, the output of a command. Look it up. A **decision** turns on human judgment — what the product should do, how it should behave, where its scope ends. It is theirs. These are the two halves of the gate's existing sort: a fact is **Settle-and-note**, a decision is **Must-ask**.

**Guidelines:**

- MUST sort every open item as a fact or a decision before asking anything, and resolve each fact by investigation — reading code, project conventions, or documentation, or running a command — never by asking the human.
- MUST record each settled fact as a stated assumption in the plan, so a wrong lookup is visible and correctable at the plan-approval gate.
- MUST treat as a decision anything turning on human judgment: a product outcome, a UX or interaction choice, a scope boundary or non-goal, empty/error/edge-case behavior, a data-model or persistence/migration choice, or anything privacy-, platform-, or compatibility-sensitive.
- MUST NOT resolve a decision by choosing the reasonable-looking option and recording it as an assumption; an assumption records a fact you verified, never a judgment you made on the human's behalf.
- SHOULD re-sort an item that investigation fails to settle — a fact you cannot find is often a decision in disguise.

## Walking the Decision Tree

Decisions form a tree, not a list. Some are **upstream**: their answer changes which downstream questions exist, which options those questions may offer, or whether they survive at all. A question set fixed before the first answer arrives therefore asks moot questions, offers options an earlier answer already excluded, and misses the questions that answer exposed.

> Ask first: _is this surface public or authenticated?_ Answering **authenticated** deletes the anonymous-rate-limit question, turns the empty-state question from "what does a stranger see" into "what does a signed-in user with no data see," and exposes a new one about the unauthorized redirect. Asked in the other order — or asked all at once — three of those four questions are wrong.

How many questions may share a single prompt is governed by the cadence rule in the skill's Asking the Human section. Dependency, established here, is what that rule keys on.

**Guidelines:**

- MUST identify which open decisions are upstream of others — whose answer changes another's options, relevance, or existence — and ask the upstream decision first.
- MUST re-derive the remaining questions after each answer: drop the ones it made moot, revise the options it narrowed, and add the ones it exposed.
- MUST resolve one branch down to its leaves before starting the next, so the human reasons within one context at a time instead of switching between them.
- MUST reopen only the affected branch when a later answer contradicts an earlier one, rather than restarting the interview.
- SHOULD state the dependency when asking a downstream question ("since this is authenticated, …"), so the human can recognize an upstream answer they want to revisit.

## Exhaustive by Default

The interview ends when the decisions are settled, not when a budget runs out. That there is no budget is the skill's Termination Guard's rule to state, and it states it; what this section governs is how far the interview reaches while it runs.

It does not scale down for a small-looking change. The cost of an unasked decision is not proportional to the size of the diff: a one-line change built on a wrong assumption is still wrong, and it surfaces later — at the plan-approval gate, or in review — where it costs more to correct. What keeps the interview finite is the fact/decision sort. Exhaustiveness ranges over the decisions the spec leaves open; a request that leaves none earns no questions at all.

**Guidelines:**

- MUST put every decision the spec leaves open to the human, stopping only when the tree is walked out — never because the interview has run long.
- MUST NOT scale the interview down because the change looks small — the count of open decisions sets its depth, never the size of the expected diff.
- MUST keep exhaustiveness ranging over decisions only; asking what investigation could answer is a sorting failure, not thoroughness.
- SHOULD ask a question you expect to be answered "obviously yes" whenever the opposite answer would change the plan; a cheap confirmation beats a silent assumption.

## Confirming Shared Understanding

The gate clears on the human's confirmation, not on your judgment that you have asked enough. Restating what you now believe is the cheapest place to catch a misread: correcting a three-bullet restatement costs a moment, while correcting a finished plan costs a careful read to find where the misunderstanding was laundered into detail.

The restatement is not the plan. It is short enough to check at a glance — what is being built, each decision and the answer it got, and what is explicitly out of scope.

**Guidelines:**

- MUST restate the shared understanding compactly once the tree is walked — the scope, each decision and its answer, and the explicit non-goals — and put it to the human for a confirm-or-adjust through the question UI before writing the plan.
- MUST keep the restatement short enough to verify at a glance; it checks alignment and is not a draft of the plan.
- MUST treat an adjustment as reopening the affected branch — ask what the correction newly exposes, then re-confirm — rather than proceeding on a patched understanding.
- MUST NOT write the plan into the issue before that confirmation, so the plan-approval gate reviews a plan whose premise the human has already agreed to.
- SHOULD surface, in the restatement, any assumption you settled by investigation that would be expensive to have wrong, so a bad lookup fails here rather than at the plan-approval gate.
