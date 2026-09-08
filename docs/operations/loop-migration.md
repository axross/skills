# Loop Migration

This reference lets maintainers reconcile the portable Loop boundary with the
later host, GitHub, and entry integrations. It inventories the source at
[`b33fd958`](https://github.com/axross/skills/commit/b33fd95804a1637fdbf4e68c25775b78dfcdae25),
including `AGENTS.md`, `REVIEW.md`, installed skills, and development operations
as the policy baseline. The approved scope is
[#545](https://github.com/axross/skills/issues/545); the shared context and
accepted review corrections are in [#553](https://github.com/axross/skills/issues/553).

## Ownership and migration status

The portable contracts are implemented here; whole-host compatibility is not.
The source and generated installations move together. Consumers need no
repository-specific adapter to apply the contracts: they use the host's
published permitted tools, or report the exact unavailable capability or
authorization. They MUST NOT treat an unimplemented adapter as permission to
drop a required gate.

The tables use these receiving owners:

- **Loop**: the linked source reference owns the retained semantics now.
- **Host**: current host instructions and published tool contracts own execution
  now; [#550](https://github.com/axross/skills/issues/550) owns repository-specific
  guidance. Removed universal mechanisms are not dormant requirements.
- **Delivery**: [GitHub Delivery](./github-delivery.md) owns this repository's
  storage and publication procedure, separated in
  [#547](https://github.com/axross/skills/issues/547).
  [GitHub Operation](../../skills/github-operation/SKILL.md) owns portable access,
  fidelity, and operation outcomes.
- **Conduct**: [Professional Behavior](../../skills/professional-behavior/SKILL.md)
  owns question content, attribution, and reporting; its transport split is
  [#546](https://github.com/axross/skills/issues/546).
- **PRD**: [PRD Authoring](../../skills/product-requirement-document-authoring/SKILL.md)
  owns section craft, with a shorter standalone fallback in Loop.

[#551](https://github.com/axross/skills/issues/551) reconciles entry routing and
combined operation. This change does not copy downstream juicio configuration,
change question strictness or severity policy, repair unrelated CI/hooks, or
add a generic orchestration skill. New contracts never override higher-priority
host instructions; valid authorizations retain their original scope.

## Source topic map

Every baseline H2/H3 topic is listed below. Filenames denote their old locations
under `skills/loop-engineering/`; each row names the current detailed owner or
the removed mechanism's receiving owner. File introductions follow their topics.

### Entry and planning

| Old file and sections                                                                                                                                             | Disposition and receiving owner                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKILL.md`: Execution Model; Intake — Identify the Unit of Work; Phase 1 — Plan; Phase 2 — Code + Verify; Phase 3 — Request Independent Review; Phase 4 — Address | Loop: [phase progression](../../skills/loop-engineering/references/phase-progression.md). Gates remain; host priority claims and mandatory orchestration removed.                            |
| `SKILL.md`: Asking the Human                                                                                                                                      | Conduct; Loop retains plan-stop and approval resumption.                                                                                                                                     |
| `SKILL.md`: GitHub Operation Conventions                                                                                                                          | Delivery; no required storage format in portable source.                                                                                                                                     |
| `SKILL.md`: Delegated Implementation                                                                                                                              | Loop: [execution selection](../../skills/loop-engineering/references/subagent-delegation.md) and assignments; Host selects mechanisms.                                                       |
| `SKILL.md`: Run State and Reporting                                                                                                                               | Loop: [semantic state](../../skills/loop-engineering/references/run-state-and-reporting.md); Conduct presentation; Delivery storage.                                                         |
| `SKILL.md`: Termination Guard                                                                                                                                     | Loop: retry, pre-flight, external-round and waiting bounds, enumerated below.                                                                                                                |
| `plan-document.md`: Beneficiary Framing; Canonical Structure; Todo; Acceptance Criteria                                                                           | PRD; Loop [canonical structure](../../skills/loop-engineering/references/plan-document.md#canonical-structure) retains a standalone fallback.                                                |
| `plan-document.md`: Plan Revision Identity; Plan Amendment; Visual Change Options                                                                                 | Loop: same named sections in [plan and approval](../../skills/loop-engineering/references/plan-document.md).                                                                                 |
| `plan-document.md`: Archiving the Original Description                                                                                                            | Delivery stores the archive; Loop excludes it from identity.                                                                                                                                 |
| `asking-the-human.md`: Asking Through the Question Tool                                                                                                           | Conduct owns options and dependency order; Host owns question UI, errors and retry transport. No universal tool retry remains.                                                               |
| `asking-the-human.md`: Never Manufacture the Human's Side                                                                                                         | Conduct; Loop [approval resumption](../../skills/loop-engineering/references/resuming-and-handoff.md#approval-resumption) preserves ambiguity, actual-human-decision and earlier-gate rules. |

### Execution and materials

| Old file and sections                                                                                            | Disposition and receiving owner                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subagent-delegation.md`: Why the Loop Delegates                                                                 | Host chooses when context isolation is useful; no universal delegation requirement.                                                                                                                                    |
| `subagent-delegation.md`: Harness Permission Determination; Putting the Decision to the Human                    | Host authority replaces the standing-mandate override. Loop distinguishes approval, authorization, capability and permitted purpose.                                                                                   |
| `subagent-delegation.md`: Resolution Precedence; Model and Effort Certainty; Defining an Agent of Your Own       | Host owns ranking, model metadata, tool restrictions and definitions. Existing project actor pins are unchanged.                                                                                                       |
| `subagent-delegation.md`: The Self-Contained Task                                                                | Loop: [assignment and fidelity](../../skills/loop-engineering/references/implementation-package.md).                                                                                                                   |
| `subagent-delegation.md`: Writer Versus Reader                                                                   | Loop: [writing coordination](../../skills/loop-engineering/references/writer-ownership-and-recovery.md#writing-coordination) preserves conflict prevention; Host owns concurrency mechanism.                           |
| `implementation-worker.md`: Executor Resolution; Compatibility Preflight; Phase 4 Delegation                     | Loop: [execution selection, preflight and integration](../../skills/loop-engineering/references/subagent-delegation.md); Host owns actual spawn/resume. Removed file is consolidated, not a missing dependency.        |
| `implementation-package.md`: Package Sections; Artifact Manifest and Fidelity; Completion and Escalation Receipt | Loop: [five handoff contracts](../../skills/loop-engineering/references/implementation-package.md). Target identity now explicitly includes read-only assignments and uncommitted materials.                           |
| `context-ownership.md`: The Investigator Role; The Boundary; The Investigator Task                               | Host owns direct vs delegated vs narrowed reads and result transport. Loop keeps source/revision/fidelity/decision boundaries, not a mandatory investigator, output shape or cost claim.                               |
| `writer-ownership-and-recovery.md`: Branch and Writer Lease; Waiting While a Worker Runs; Permission Requests    | Loop: [writing coordination](../../skills/loop-engineering/references/writer-ownership-and-recovery.md#writing-coordination); Host owns workspace, tool permission and waiting. A lease is behavioral unless enforced. |
| `writer-ownership-and-recovery.md`: User Input Mid-Run; Clarification versus Plan Revision                       | Loop: [changed plan and decisions](../../skills/loop-engineering/references/writer-ownership-and-recovery.md#changed-plan-and-decisions); Host stops/joins the actual executor.                                        |
| `writer-ownership-and-recovery.md`: Cohesive Local Commits; Retry Budget; Completion-Evidence Check              | Loop: [retry and append-only recovery](../../skills/loop-engineering/references/writer-ownership-and-recovery.md); project branch/history choices and Delivery publish.                                                |

### Review, recovery and storage

| Old file and sections                                                                                                                                                                                  | Disposition and receiving owner                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-flight-review.md`: What the Stage Does and Does Not Reproduce; Review Package — the Input Contract; Run State Is Not Input; The Reviewer Is a Reader; A Fresh Reviewer Each Round                 | Loop: [review input](../../skills/loop-engineering/references/pre-flight-review.md#review-input). Stable target, fresh context, receipt exclusion, disclosure and no independent-review substitution remain.                                |
| `pre-flight-review.md`: Finding Ledger; Ledger Durability; Dismissal Authority; Round Cap and Escalation                                                                                               | Loop: [ledger, durable parks and cap](../../skills/loop-engineering/references/pre-flight-review.md).                                                                                                                                       |
| `pre-flight-review.md`: Defining a Reader of Your Own                                                                                                                                                  | Host owns tool restrictions, selection and capability checks; Loop requires actual material access.                                                                                                                                         |
| `independent-review.md`: CI and Review Tail                                                                                                                                                            | Loop: [independence, waiting bound and readiness](../../skills/loop-engineering/references/independent-review.md); Host owns permitted waits and cleanup. Automatic scheduling is removed, not reauthorized by a cap.                       |
| `independent-review.md`: Addressing Findings                                                                                                                                                           | Loop preserves fixing evidence, fresh review and escalation; Delivery owns comment/thread operations.                                                                                                                                       |
| `independent-review.md`: Resolution Reply Length                                                                                                                                                       | Delivery retains short fixing-commit replies and elaboration only when needed.                                                                                                                                                              |
| `independent-review.md`: Keeping the Branch Mergeable                                                                                                                                                  | Loop retains mergeability and verified conflict results; project policy and Host own branch operations, with no forced history rewrite.                                                                                                     |
| `resuming-and-handoff.md`: Resolving a Resume; Resuming a Delegated Run                                                                                                                                | Loop: [reconstructing state and approval resumption](../../skills/loop-engineering/references/resuming-and-handoff.md).                                                                                                                     |
| `resuming-and-handoff.md`: Take Over a Handoff; Locate and ingest the package; Verify preconditions; Resume the work                                                                                   | Loop: [handoff](../../skills/loop-engineering/references/resuming-and-handoff.md#handoff) preserves provenance, inventory and preconditions; Host owns archive extraction/patch transfer. No mandated filename or zip.                      |
| `run-state-and-reporting.md`: GitHub as Lightweight State; Delegated Run State                                                                                                                         | Loop owns [semantic state](../../skills/loop-engineering/references/run-state-and-reporting.md#semantic-run-state); Delivery owns HTML token, first-element placement, bounded extraction, full-body writes and transient-handle exclusion. |
| `run-state-and-reporting.md`: Reporting a Delegated Run; Ready-to-Merge Handoff                                                                                                                        | Loop: [reporting and completion evidence](../../skills/loop-engineering/references/run-state-and-reporting.md); Conduct presentation; Host execution metadata.                                                                              |
| `run-state-and-reporting.md`: Why a Report-Only Turn Costs the Same as an Acting One; The Forbidden Turn Against Each Exception; The Asynchronous-Wait Boundary; The Prose-Beside-a-Tool-Call Boundary | Conduct and Host own turn handling; universal cache-price rationale removed, not a new permission to omit the next action.                                                                                                                  |
| `github-conventions.md`: GitHub Operation Mechanics; Where the Loop's Own Writes Go; Reading a Body That Carries State; Titles and Descriptions; Preserve Traceable History; Untrusted Content         | GitHub Operation owns API/identity/fidelity, Delivery owns routing and representation. Loop retains append-only fixes, data-as-data and result checks.                                                                                      |
| `waiting-and-dormancy.md`: The Three-Tier Cost Model; Choosing the Mechanism; The Ten Places, Classified; Ending a Turn Is Not Going Dormant                                                           | Host owns waiting mechanisms and measured cost choices; Loop retains human-stop, machine bound and tail cleanup semantics. Cache measurement and automatic self-wakes are not portable requirements.                                        |

## Safeguards checked against the baseline

These invariants MUST survive downstream integration without a new policy decision:

| Invariant            | Before and after                                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approval             | Plan recorded before edits; stop for human review; later approval cannot repair a skipped gate; bare continuation only at an established approval wait, never after ambiguous interruption.                     |
| Identity             | First plan heading through Open questions; exclude archive and state; decode HTML entities only; mismatch stops edits; timestamps alone do not identify approval.                                               |
| Amendments           | Verbatim replacements, pre-approved resulting identity, reproduced current identity before drafting; otherwise separate approval; read back and compare after write.                                            |
| Plan change          | Stop affected execution; account for processes and partial work; obtain new approval; fresh context and assignment; audit retained changes rather than reuse stale results.                                     |
| Pre-flight findings  | ID, severity, citation, claim and fix; fixed → fixing commit, dismissed → reason with human authority for Critical/Major, deferred → informed declined extra round only; no regrading or omitted findings.      |
| Pre-flight recovery  | Full ledger in session; durable round/wait throughout; open ID/severity/citation only across dismissal/extra-round parks; clear before review; lost ledger → fresh review, never success.                       |
| Attempts             | Initial plus 2 retries per plan revision and task phase; runtime/API/tool failure, stall, lost response or disappearance counts; new plan/scope/round/task starts its own budget; exhaustion → parent recovery. |
| Advisory rounds      | Initial implementation plus 3 autonomous review/fix rounds; human authorizes each additional round knowing all remaining severities and Critical/Major findings; decline → deferred findings in draft.          |
| External rounds      | 4 address/review rounds, then record non-convergence and stop.                                                                                                                                                  |
| Waiting              | Declared timeout plus margin, or 2 hours when absent; new result plus new revision/checks resets the budget; stop/cleanup at cap, readiness or non-convergence; no schedule authorization follows.              |
| Ready                | Required checks green, mandatory independent review clean, current approved plan, evidence complete and target mergeable; self-review and missing review cannot satisfy it.                                     |
| Recovery and history | Verify actual files, partial commits, processes, reviews and uncertain effects before retry; no destructive reset or history rewrite; inspect integrated results, not completion messages alone.                |

## Verification scope

Review these contracts with concrete inputs, not only a text search. The
following static walkthroughs are the portable boundary checks; they do not
claim actual Amp/Claude runs or downstream adapter coverage:

| Input                                                                | Required result and controlling contract                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Read-only question without a tracking issue                          | Answer without change gates; phase intake and read-only assignment.                                     |
| Host forbids the proposed delegation purpose                         | Parent implements the approved change; capability/authorization distinction and unchanged review gate.  |
| One-shot child encounters a product decision                         | `decision-waiting` plus partial result; parent asks; no invented live resume API.                       |
| Review in another workspace, same HEAD but missing uncommitted patch | Preflight returns non-complete until the actual diff/files arrive; HEAD is insufficient.                |
| Child cannot view a required design image                            | `unavailable`, not a prose substitute or clean review.                                                  |
| Plan changes while a child works                                     | Old result cannot satisfy new approval; recover partial work, audit reuse and issue a fresh assignment. |
| Side-effect response is lost                                         | `outcome-unknown`; inspect stored result/processes before any non-idempotent retry.                     |
| Advisory reviewer unavailable or external review never returned      | Advisory absence disclosed; mandatory external review stays unmet and delivery stays draft.             |

Repository format, lint, structural/link, installed-copy and test results belong
to the PR's verification evidence. Structural passes prove source consistency,
not that a host obeys prose. The separate integration issue consumes this map
and the actual merged contract revision rather than assuming issue closure is
proof of compatible installed content.

## GitHub boundary integration

The GitHub integration consumes the Loop contracts above without changing their
state meanings or limits. The following map covers the GitHub Operation topics
and project delivery text present at the start of #547. Generated skill copies
follow their source rather than becoming another detailed owner:

| Previous topic                                                                                     | Disposition and detailed owner                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub Operation introduction and Untrusted Content                                                | Retained in the [skill entry](../../skills/github-operation/SKILL.md); host restrictions, untrusted input, and the default channel apply to every operation.                                                                                                                               |
| The Sanctioned Channel: Default Route; When Another Route Is Permitted; What a Raw Route May Carry | Split between the entry's default and [channel qualification](../../skills/github-operation/references/channel-selection.md); no new raw-route permissions.                                                                                                                                |
| Agent-vs-Human Comments                                                                            | [Identity and targets](../../skills/github-operation/references/identity-and-targets.md) retains attribution and trigger isolation; marker values are project-owned.                                                                                                                       |
| Issue vs. Pull Request Are Distinct Targets                                                        | Portable object/endpoint distinction stays in identity and targets; project plan/review destinations move to GitHub Delivery.                                                                                                                                                              |
| Assigning What the Session Creates                                                                 | Identity and targets retains API limits and read-back; identity lookup follows the qualified authenticated channel.                                                                                                                                                                        |
| Editing an Existing Body; Obtaining Stored Bytes                                                   | [Body integrity](../../skills/github-operation/references/body-integrity.md) retains full-body preservation, sanitization limits, candidate reads, and exact comparisons.                                                                                                                  |
| Branch, Draft, and Review-Event Conventions                                                        | Split: portable COMMENT-only and no-default-branch protections in [publication and recovery](../../skills/github-operation/references/publication-and-recovery.md); draft publication and archive placement in GitHub Delivery; project branch/merge choices stay in Development Workflow. |
| Pull Request Titles and Descriptions                                                               | Publication and recovery retains API/template and squash-title consequences; prose craft defers to its specialist owners; GitHub Delivery selects this repository's template and issue link.                                                                                               |
| Preserve History — No Amend or Force-Push                                                          | Publication and recovery retains append-only commits and authorization exceptions subject to host rules.                                                                                                                                                                                   |
| Development Workflow: GitHub Delivery During Migration                                             | Detailed storage/routing moves to [GitHub Delivery](./github-delivery.md); old heading remains a routing anchor.                                                                                                                                                                           |
| AGENTS.md marker values                                                                            | Move to GitHub Delivery; the entry routes there before comment reads or writes.                                                                                                                                                                                                            |
| Loop run-state, approval, recovery, and readiness                                                  | Unchanged semantic owner; GitHub Delivery maps fields and evidence locations, including conditional finding durability.                                                                                                                                                                    |
| Code Review configuration; REVIEW.md severity/output policy                                        | Retained in their existing owners; no trigger, permission, or unrelated defect repair.                                                                                                                                                                                                     |

The split also adds a portable operation-outcome contract. It distinguishes
authorization waits, prohibited purposes, confirmed failures, partial effects,
and unknown outcomes without defining another Loop phase or retry budget.
The portable skill keeps a short draft/human-merge fallback only for consumers
without project delivery conventions; this repository's concrete procedure has
one owner in GitHub Delivery.
The unchanged discovery description still selects GitHub reads and writes;
conditional references now separate transport, attribution, body edits, and
publication. No new host guide or mandatory adapter is introduced.

### GitHub boundary walkthroughs

These are static, concrete walkthroughs for the integration, not claims of
live failure injection or completed external review. Compare each input with
the linked owners before accepting the boundary:

| Input                                                                                   | Expected result and owner                                                                                                                            |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| No GitHub tool; authenticated CLI available for an authorized issue edit                | Channel qualification permits the high-level alternative after identity, target, fidelity, and read-back checks. No host-name inference.             |
| Sanctioned tool times out while posting a comment; CLI also available                   | Publication and recovery inspects the original effect; channel selection forbids switching credentials because of the timeout. No duplicate comment. |
| Present channel has no review operation, or host prohibits the purpose                  | Channel selection reports unavailable capability or prohibition; user authorization does not turn either into a permitted tool use.                  |
| Draft review-trigger text exists, but only local implementation is authorized           | Publication and recovery returns authorization-waiting; no comment or workflow starts.                                                               |
| Sanitized body lacks its HTML block and turns `&#x27;` into an apostrophe               | Body integrity rejects a replacement or identity claim from that read. Legibility decoding cannot reconstruct stored bytes.                          |
| Issue 40 tracks PR 41; assign PR 41 through an issues endpoint                          | Identity and targets selects 41 and verifies its assignees; project plan amendments still target issue 40.                                           |
| PR 41 exists after a lost create response; issue 40 still points at itself              | Recovery inspects the existing PR and continues handover from it. GitHub Delivery makes PR-side run state authoritative, without creating PR 42.     |
| PR creation succeeds, assignment is ignored, then verification cannot read draft status | Report creation as confirmed, assignment as unmet, and draft status as unknown. Keep the object ID and do not recreate the PR.                       |
| Review request is stored but no policy-compliant independent result is available        | Delivery records the unmet review gate and stays draft; no unrelated fix is made a new acceptance criterion.                                         |

This integration does not implement #550's host execution guide or #551's
combined-host verification. Local structural checks and these walkthroughs
cannot certify either host behavior or the mandatory independent review.
