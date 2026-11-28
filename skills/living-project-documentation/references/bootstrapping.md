# Bootstrapping and Migrating Documentation

## Detect before proposing

“Adopt OKF for our engineering docs” calls for reviewing the populated
collection as it stands at checkout. Valid frontmatter can coexist with two
answers to the same question or a release command separated from its stop
condition.

| Request                                          | Work and completion claim                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Start a new or empty bundle                      | Answer the [first reader question](#start-with-a-reader).                                                                  |
| Migrate a populated root or package              | [Assess the collection](#assess-the-collection), design its subject layout, then migrate and verify the covered subjects.  |
| Add frontmatter only                             | Make the requested format changes and report the format checks. Leave the editorial outcome open.                          |
| Fix one page or keep docs current after a change | [Update affected claims and callers](./consulting-and-upkeep.md#find-the-affected-claim). Bound the result to that change. |

**Guidelines:**

- MUST identify the requested root or package, its entry points and its export boundary before interpreting the [whole-root check](./validators.md#check-the-whole-documentation-root).
- MUST preserve a working legacy layout until the project adopts migration. Follow its change gates, then carry an approved migration through to the owning pages and callers.

## Assess the collection

“What happens after cancellation **with an attempt still running**?” can
disappear if notes reduce it to “job lifecycle.” For a populated collection,
use this sequence from the initial inventory through the first edited slice.
Open the linked references as their decisions arise.

1. Scan the tree and its entry points together. Group independent searches
   for questions, sources and callers. List concrete questions from handoffs,
   caller comments and adopted decisions, including the case that changes an
   answer. Try the published root, an actual caller and the contributor's
   route for placing a neighboring claim. Sketch the subjects those readers need.
2. Pick one question. One line in working notes can hold its actual starting
   link, owning passage and evidence. Edit the owner, switch callers and try that
   route immediately. For example, follow [the notification rule](../assets/docs-example/notifications.md#rules)
   to [the cancellation passage](../assets/docs-example/scheduling/outcomes.md#states)
   and open its evidence for cancellation with retries left.
3. Answer from the edited page, including its exception or the precise limit
   of the evidence. Fix the passage now if the answer still requires the
   author's notes. Repeat for the remaining questions. Run the required
   [whole-root and export checks](./validators.md) on the integrated changes.
   If setup stalls, record the failing step and finish the reader checks
   before spending more time on tooling.

**Guidelines:**

- MUST inventory the initial tree across the requested scope. Include indexes, glossaries, human and agent entry points, external callers, tools and boundaries such as generated pages with a separate producer or immutable evidence.
- MUST [trace representative reader questions](./consulting-and-upkeep.md#verify-a-readers-route) in the existing collection before choosing a target layout. Carry every concrete in-scope question found during that assessment forward to a verified answer or an explicit gap.
- SHOULD scan every subject at page level in a large corpus, then inspect suspect sections and decision-critical routes closely. Look for mixed decisions, conflicting or repeated rules, unfamiliar terms, claims without support, questions without an owner and prerequisites stranded on other pages.

## Design the target

A root labeled “Specifications” and “Guides” asks a newcomer to predict
which kind of document contains the answer. A reader who asks when a job
becomes terminal can choose “Scheduling.” An operator deciding whether to
roll back can choose “Operating a release.” Try both routes in the
[worked Scheduler migration](../assets/scheduler-migration.md).

**Guidelines:**

- SHOULD sketch the smallest tree that answers the observed questions. Name each subject in the project's language and say which decisions it owns. Choose [page types and local indexes](./documentation-structure.md#choose-the-subject) once the owners are clear.
- SHOULD compare a minimal repair, such as a direct heading link, with a different grouping when ownership is ambiguous. Try a root lookup, [placing a new claim from a contributor entry point](./conventions-and-operations.md#contributor-routes) and the affected caller routes. Weigh the cost of maintaining old entries.
- MUST account for each affected legacy decision in working notes or the existing change record. Identify what stays, what moves or splits, which claims merge at one owner, and why a page is created or retired.
- MUST investigate missing answers in implementation, tests, configuration or an adopted decision. Write the rule and the case that distinguishes it from a plausible alternative at their owner. Where sources conflict or evidence runs out, tell the reader there what the source establishes, what remains unknown and which decision depends on it. A local observation may cover only one stage of a longer process.

## Migrate one reading route

A metric's formula, its result-buffer contract and its presentation can change
independently. A sampled stage can compute values for several participants
while returning a score for only one. A caller needs the result Specification
to know whose score is available. By contrast, a configuration name, its
requiredness and its failure behavior together tell the operator what to set.
A testing convention and the counterexample that motivated it also belong
together.

**Guidelines:**

- MUST trace the slice's claims to their owners, callers, paths and fragments, exported assets, metadata and supporting evidence before editing.
- SHOULD split claims when they serve different decisions and can change independently. Keep facts that a reader must apply together on one page; page length and heading count alone do not justify a split.
- MUST carry the claim's limits and rationale into its typed owner. For a newly established answer, link the precise supporting source there or include a permitted, attributed excerpt. Try the citation from the exported page and identify any access limit. A filename in migration notes leaves the recipient without that evidence.
- MUST preserve established type names and metadata. Correct generated material at its producer. Search the affected pages for another full statement of the verified rule. Replace editable duplicates with the local decision and a direct link to the owner. Retire obsolete material within the agreed scope.
- MUST [preserve supported bookmarks](./cross-references.md#preserve-the-reading-route) as external entries and [exercise editable callers](./consulting-and-upkeep.md#verify-a-readers-route) separately. Follow the link in each affected caller, including the contributor guide, to the passage its wording promises. Repair a detour through a compatibility heading. Update the subject index and glossary where readers use them.
- MUST keep the action, authority, cost and stop or recovery condition together. Walk every proposed branch from its actual failure state, including any effect already committed. If repeating an action would violate the recovery decision, remove every suggestion to repeat it, including optional or discouraged alternatives. Show the safe next action or no-op.

## Close the requested scope

In a flat library, a retry page can already answer both “When is the next
attempt?” and “What happens after the last one?” Opening that page from the
root and exercising exhaustion can justify keeping the layout. A local index
with only that destination would give the reader another step.

**Guidelines:**

- MUST reconcile the edited tree and working questions with the initial inventory. Open each recorded answer passage and answer the original question from that passage alone or its necessary links. Correct missing cases or record the gap. In the handoff identify covered subjects, remaining owners, unresolved questions and cross-package callers as applicable. Limit the completion claim to routes actually exercised.
- MUST report [format checks](./validators.md) separately from editorial results. Replay representative questions from the root and callers. For a repaired defect, show the original failure, the edited owner and the route to the complete answer. For a retained layout, identify a working owner, its boundary case and the detour an extra split or directory would introduce.

## Start with a reader

One recurring question is enough to begin. For a new bundle the root index can
begin with this frontmatter, followed by a topic heading and a link to the
concept.

```yaml
---
okf_version: "0.3"
title: Scheduler engineering
description: Job execution and delivery guarantees for Scheduler contributors.
---
```

In a small library, the rest of that index can be a single link:
`[When will a failed job run again?](./retries.md)`. The whole bundle is
`index.md` and `retries.md`. The concept could read:

```markdown
---
type: Specification
title: Job retries
description: Retry timing, attempt limits and the state callers observe between attempts.
---

# Job retries

A failed job waits one minute for a second attempt and appears as queued.
If the second attempt fails, the job ends as failed.
```

Here the retry contract owns both timing and exhaustion. When readers also
need to count attempts, a growing project can group a Definition and a
Specification under scheduling. The [Scheduler subject index](../assets/docs-example/scheduling/index.md)
shows that choice in a larger service with its own retry limits. Link both
the human contributor guide and agent instructions to the same maintained
[placement convention](../assets/docs-example/contributing/documentation.md#choose-a-subject).

**Guidelines:**

- SHOULD answer the first question from the implementation or an adopted decision, give the answer a primary type, and link it from the index.
- SHOULD let a new decision earn its own page. Link it from the flat root or from the subject where readers already seek it.

## Preserve evidence identity

An approval that names a file by SHA-256 binds to its bytes, including its first
line and newline convention. When retiring a dated feasibility study, move any still-useful check into the
operator's Procedure. Its next execution produces evidence for that change's
pull request. A reader investigating the old result can open the original
study at its commit.

**Guidelines:**

- MUST preserve any bytes an existing approval or distribution contract binds. If current guidance relies on that evidence, cite its pinned source and acceptance from the typed page that owns the claim. An existing Specification or Procedure can be its companion.
- MUST distinguish implemented behavior, an adopted target awaiting implementation, a revision-specific observation and an unverified hypothesis in the wording of the claim. State which revision, environment and conditions the evidence supports. Preserve recorded provenance without inferring verification, authorship, ownership, approval or license from migration.
- SHOULD remove superseded reports from the live tree once active evidence obligations and reader routes are accounted for. Direct historical lookups to the original commit or pull request.
- MUST record hashes before migration and compare the exported evidence and linked assets byte-for-byte with their originals.
- MUST report intentional untyped evidence by path during verification so an accidental omission elsewhere remains visible.
