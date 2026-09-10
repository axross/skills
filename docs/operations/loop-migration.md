# Loop Migration

This reference lets maintainers reconcile the portable Loop boundary with the
later host, GitHub, and entry integrations. It inventories the source at
[`b33fd958`](https://github.com/axross/skills/commit/b33fd95804a1637fdbf4e68c25775b78dfcdae25),
including `AGENTS.md`, `REVIEW.md`, installed skills, and development operations
as the policy baseline. The approved scope is
[#545](https://github.com/axross/skills/issues/545); the shared context and
accepted review corrections are in [#553](https://github.com/axross/skills/issues/553).

## Ownership and migration status

The portable contracts and entry routing are integrated here; this is not a
claim of live coverage for every supported host. The combined matrix below
separates static contract checks from actual execution evidence.
The source and generated installations move together. Consumers need no
repository-specific adapter to apply the contracts: they use the host's
published permitted tools, or report the exact unavailable capability or
authorization. They MUST NOT treat an unimplemented adapter as permission to
drop a required gate.

The tables use these receiving owners:

- **Loop**: the linked source reference owns the retained semantics now.
- **Host**: current host instructions and published tool contracts own execution
  now; [Amp execution](./amp-execution.md) supplies repository-specific guidance
  and bounded scenarios from [#550](https://github.com/axross/skills/issues/550).
  Removed universal mechanisms are not dormant requirements.
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

| Old file and sections                                                                                                                                                                                  | Disposition and receiving owner                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-flight-review.md`: What the Stage Does and Does Not Reproduce; Review Package — the Input Contract; Run State Is Not Input; The Reviewer Is a Reader; A Fresh Reviewer Each Round                 | Loop: [review input](../../skills/loop-engineering/references/pre-flight-review.md#review-input). Stable target, fresh context, receipt exclusion, disclosure and no independent-review substitution remain.                                                                                          |
| `pre-flight-review.md`: Finding Ledger; Ledger Durability; Dismissal Authority; Round Cap and Escalation                                                                                               | Loop: [ledger, durable parks, deferred handoff and cap](../../skills/loop-engineering/references/pre-flight-review.md).                                                                                                                                                                               |
| `pre-flight-review.md`: Defining a Reader of Your Own                                                                                                                                                  | Host owns tool restrictions, selection and capability checks; Loop requires actual material access.                                                                                                                                                                                                   |
| `independent-review.md`: CI and Review Tail                                                                                                                                                            | Loop: [independence, waiting bound and readiness](../../skills/loop-engineering/references/independent-review.md); Host owns permitted waits and cleanup. Automatic scheduling is removed, not reauthorized by a cap.                                                                                 |
| `independent-review.md`: Addressing Findings                                                                                                                                                           | Loop preserves fixing evidence, fresh review and escalation; Delivery owns comment/thread operations.                                                                                                                                                                                                 |
| `independent-review.md`: Resolution Reply Length                                                                                                                                                       | Delivery retains short fixing-commit replies and elaboration only when needed.                                                                                                                                                                                                                        |
| `independent-review.md`: Keeping the Branch Mergeable                                                                                                                                                  | Loop: [mergeability and conflict remediation](../../skills/loop-engineering/references/independent-review.md#mergeability-and-conflict-remediation) restores the mechanical-repair, affected-verification and re-review sequence; project policy selects append-only base merge and Host performs it. |
| `resuming-and-handoff.md`: Resolving a Resume; Resuming a Delegated Run                                                                                                                                | Loop: [reconstructing state and approval resumption](../../skills/loop-engineering/references/resuming-and-handoff.md).                                                                                                                                                                               |
| `resuming-and-handoff.md`: Take Over a Handoff; Locate and ingest the package; Verify preconditions; Resume the work                                                                                   | Loop: [handoff](../../skills/loop-engineering/references/resuming-and-handoff.md#handoff) preserves provenance, inventory and preconditions; Host owns archive extraction/patch transfer. No mandated filename or zip.                                                                                |
| `run-state-and-reporting.md`: GitHub as Lightweight State; Delegated Run State                                                                                                                         | Loop owns [semantic state](../../skills/loop-engineering/references/run-state-and-reporting.md#semantic-run-state); Delivery owns HTML token, first-element placement, bounded extraction, full-body writes and transient-handle exclusion.                                                           |
| `run-state-and-reporting.md`: Reporting a Delegated Run; Ready-to-Merge Handoff                                                                                                                        | Loop: [reporting and completion evidence](../../skills/loop-engineering/references/run-state-and-reporting.md); Conduct presentation; Host execution metadata.                                                                                                                                        |
| `run-state-and-reporting.md`: Why a Report-Only Turn Costs the Same as an Acting One; The Forbidden Turn Against Each Exception; The Asynchronous-Wait Boundary; The Prose-Beside-a-Tool-Call Boundary | Loop: [advance or stop](../../skills/loop-engineering/references/phase-progression.md#advance-or-stop) owns available-next-action and legitimate-stop semantics; Host owns tool and wait mechanics. Universal cache-price rationale remains removed.                                                  |
| `github-conventions.md`: GitHub Operation Mechanics; Where the Loop's Own Writes Go; Reading a Body That Carries State; Titles and Descriptions; Preserve Traceable History; Untrusted Content         | GitHub Operation owns API/identity/fidelity, Delivery owns routing and representation. Loop retains append-only fixes, data-as-data and result checks.                                                                                                                                                |
| `waiting-and-dormancy.md`: The Three-Tier Cost Model; Choosing the Mechanism; The Ten Places, Classified; Ending a Turn Is Not Going Dormant                                                           | Host owns waiting mechanisms and measured cost choices; Loop retains human-stop, machine bound and tail cleanup semantics. Cache measurement and automatic self-wakes are not portable requirements.                                                                                                  |

## Safeguards checked against the baseline

These invariants MUST survive downstream integration without a new policy decision:

| Invariant            | Before and after                                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approval             | Plan recorded before edits; stop for human review; later approval cannot repair a skipped gate; bare continuation only at an established approval wait, never after ambiguous interruption.                     |
| Authorization        | Plan approval stays separate; matching target/operation/route/evidence/limits/exclusions survive phase and session changes; only an unmatched difference prompts again.                                         |
| Identity             | First plan heading through Open questions; exclude archive and state; decode HTML entities only; mismatch stops edits; timestamps alone do not identify approval.                                               |
| Amendments           | Verbatim replacements, pre-approved resulting identity, reproduced current identity before drafting; otherwise separate approval; read back and compare after write.                                            |
| Plan change          | Stop affected execution; account for processes and partial work; obtain new approval; fresh context and assignment; audit retained changes rather than reuse stale results.                                     |
| Pre-flight scope     | Every verified initial implementation reaches the same pre-publication checkpoint regardless of actor; a qualified fresh reader runs it, while an unavailable reader is recorded rather than treated as clean.  |
| Pre-flight findings  | ID, severity, citation, claim and fix; fixed → fixing commit, dismissed → reason with human authority for Critical/Major, deferred → informed declined extra round only; no regrading or omitted findings.      |
| Pre-flight recovery  | Full ledger in session; durable round/wait throughout; open ID/severity/citation only across dismissal/extra-round parks; clear before review; lost ledger → fresh review, never success.                       |
| Deferred handoff     | An informed decline retains the substantive finding and decision record for the human, separate from the park subset and fresh review input; restricted delivery surfaces carry only a safe projection.         |
| Attempts             | Initial plus 2 retries per plan revision and task phase; runtime/API/tool failure, stall, lost response or disappearance counts; new plan/scope/round/task starts its own budget; exhaustion → parent recovery. |
| Progression          | Available authorized transitions proceed without another instruction; a stop names its decision, grant, capability, input, machine result, unsafe effect, bound, non-convergence or completion reason.          |
| Advisory rounds      | Initial implementation plus 3 autonomous review/fix rounds; human authorizes each additional round knowing all remaining severities and Critical/Major findings; decline → deferred findings in draft.          |
| External rounds      | 4 address/review rounds, then record non-convergence and stop.                                                                                                                                                  |
| Waiting              | Declared timeout plus margin, or 2 hours when absent; new result plus new revision/checks resets the budget; stop/cleanup at cap, readiness or non-convergence; no schedule authorization follows.              |
| Conflicts            | Project base merge and conflict resolution preserve history; mechanical repairs proceed, judgment returns to the human, affected checks rerun and resulting material receives fresh review.                     |
| Ready                | Required checks green, mandatory independent review clean, current approved plan, evidence complete and target mergeable; self-review and missing review cannot satisfy it.                                     |
| Recovery and history | Verify actual files, partial commits, processes, reviews and uncertain effects before retry; no destructive reset or history rewrite; inspect integrated results, not completion messages alone.                |

## Verification scope

Review these contracts with concrete inputs, not only a text search. The
following static walkthroughs are the portable boundary checks; they do not
claim actual Amp/Claude runs or downstream adapter coverage:

| Input                                                                                              | Required result and controlling contract                                                                                                                            |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read-only question without a tracking issue                                                        | Answer without change gates; phase intake and read-only assignment.                                                                                                 |
| Host forbids the proposed implementation delegation purpose                                        | Parent implements the approved change; a separately qualified fresh reader still performs pre-flight.                                                               |
| One-shot child encounters a product decision                                                       | `decision-waiting` plus partial result; parent asks; no invented live resume API.                                                                                   |
| Review in another workspace, same HEAD but missing uncommitted patch                               | Preflight returns non-complete until the actual diff/files arrive; HEAD is insufficient.                                                                            |
| Child cannot view a required design image                                                          | `unavailable`, not a prose substitute or clean review.                                                                                                              |
| Plan changes while a child works                                                                   | Old result cannot satisfy new approval; recover partial work, audit reuse and issue a fresh assignment.                                                             |
| Side-effect response is lost                                                                       | `outcome-unknown`; inspect stored result/processes before any non-idempotent retry.                                                                                 |
| Advisory reader unavailable or its purpose prohibited                                              | Exact qualification failure disclosed; authorized draft may proceed, but the result is never clean.                                                                 |
| Human declines another advisory round; both publication effects authorized                         | Remaining findings become deferred; a marked Issue comment preserves the substantive handoff while the draft PR carries only its safe projection.                   |
| Issue-comment publication is authorized but PR update is not                                       | Publish the marked substantive handoff, report the blocked PR projection and keep delivery incomplete; the two effects do not share authorization.                  |
| Neither deferred-handoff publication effect is authorized                                          | Preserve the full internal handoff, report its substance and both blocked effects, and keep delivery incomplete; an orb-local artifact is not a durable substitute. |
| Substantive canary `violet-otter`; PR projection repeats it or paraphrases it as `purple-mustelid` | Withhold both unsafe forms; use only code/process observations and valid locators, or report the limitation when no valid locator is available.                     |
| Substantive handoff evidence is missing after interruption                                         | Apply Loop recovery: report unavailable evidence, preserve verified facts, do not reconstruct finding substance, and do not infer permission for a new round.       |
| External review never returned                                                                     | Mandatory external review stays unmet and delivery stays draft.                                                                                                     |
| One transition lacks required input while another remains available                                | Stop only the dependent transition; perform the independent permitted action before returning.                                                                      |
| Action model completes but validation or publication fails                                         | Preserve the verified provider stage; workflow completion or an older summary is not clean review.                                                                  |
| Base integration has mechanical and judgment conflicts                                             | Repair only the mechanical set; rerun affected checks and return the intentional conflict to the human.                                                             |

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
The updated discovery description still selects GitHub reads and writes;
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
| Resumed session has a matching repository/PR/route grant                                | Loop and Delivery carry the grant forward; no prompt recurs solely because the phase, session or executor changed.                                   |
| Grant covers one review request, but a fix needs another                                | The exhausted limit makes only the new trigger authorization-waiting; completed draft and verification effects remain valid.                         |
| Grant covers draft publication and updates only                                         | Named draft effects may proceed; review, ready, merge and setup remain unauthorized.                                                                 |
| Compound grant names draft updates and remaining Action review rounds                   | Named effects continue within Loop's four-round cap; ready, merge, setup and scheduling remain excluded.                                             |
| Pull request or provider route changes after a grant                                    | Compare the proposed effect and request authorization only for the changed target or route; do not switch providers silently.                        |
| Action request is granted without production setup                                      | The exact trigger may cover named context, billed model and sanitized publication effects; secrets, settings and enablement remain unauthorized.     |
| Trigger response is lost and no correlated run can yet be established                   | Keep the trigger outcome unknown and do not post a duplicate command, even when the grant has unused requests.                                       |
| Failed run has no summary, or publisher fails after model completion                    | Preserve the observed run/model/publication stage; absence of a result is not clean completion, and retry still needs a valid remaining grant.       |
| Mutable bot summary identifies an older trigger/run attempt                             | Treat the current result as missing; the old summary cannot satisfy the new request or justify another trigger by itself.                            |
| Sanitized body lacks its HTML block and turns `&#x27;` into an apostrophe               | Body integrity rejects a replacement or identity claim from that read. Legibility decoding cannot reconstruct stored bytes.                          |
| Issue 40 tracks PR 41; assign PR 41 through an issues endpoint                          | Identity and targets selects 41 and verifies its assignees; project plan amendments still target issue 40.                                           |
| PR 41 exists after a lost create response; issue 40 still points at itself              | Recovery inspects the existing PR and continues handover from it. GitHub Delivery makes PR-side run state authoritative, without creating PR 42.     |
| PR creation succeeds, assignment is ignored, then verification cannot read draft status | Report creation as confirmed, assignment as unmet, and draft status as unknown. Keep the object ID and do not recreate the PR.                       |
| Review request is stored but no policy-compliant independent result is available        | Delivery records the unmet review gate and stays draft; no unrelated fix is made a new acceptance criterion.                                         |

These GitHub walkthroughs cover the delivery boundary. The combined integration
below consumes it alongside the host guide; neither structural checks nor
walkthroughs certify the mandatory independent review.

## Combined entry integration

The integration baseline is
[`f7b4dfb`](https://github.com/axross/skills/commit/f7b4dfbf54338c372af7a418efd6bfe6f51e873a).
It contains all component changes, but still has the old runtime-precedence
paragraph in `AGENTS.md`. The entry switch removes that contradiction without
changing the source contracts or review-output policy. The component revisions
and their receiving surfaces are:

| Issue | Merged revision | Surface consumed by entry integration                                            |
| ----- | --------------- | -------------------------------------------------------------------------------- |
| #545  | `bbfdcd8`       | Loop phase, handoff, recovery, finding and limit contracts; Development Workflow |
| #546  | `4020bfc`       | Professional Behavior's question content and parent-return boundary              |
| #547  | `5bf6ee2`       | GitHub Operation's access contracts and GitHub Delivery's storage                |
| #548  | `aff3879`       | Authoring's portable-content, metadata and conditional-reference boundaries      |
| #549  | `f7b4dfb`       | Management's active-loading evidence and Agent Skills' host procedures           |
| #550  | `a99c837`       | Amp Execution's current-tool, workspace, wait and recovery guidance              |

The source maps above remain the detailed Loop and GitHub inventory. The
following map completes the entry and component topics without duplicating
their rules:

| Previous topic                                                                                              | Preserved owner or explicit exclusion                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| AGENTS project overview, commands and tooling                                                               | README; entry retains library identity and command routing                                                            |
| AGENTS baseline skills, read-only/change split and domain loading                                           | Entry's Response Approach; Professional Behavior, Software Development and Loop own details                           |
| AGENTS unconditional runtime priority, standing publication ask, old Execution Model reference              | Removed; current host authority and scoped authorization replace the claim, not the gates                             |
| AGENTS mandatory gates, no size threshold, headless operation, completion evidence and extra human scrutiny | Development Workflow; Loop owns approval, review, recovery and caps                                                   |
| AGENTS routing table, index and dependency documentation reads                                              | Entry routes by task; existing conventions and operations remain detailed owners                                      |
| AGENTS concrete questions and reporting craft                                                               | Professional Behavior; no weaker interview or reporting rule introduced                                               |
| AGENTS discovery, gate-set, generated-root, scheduled-audit and count review reminders                      | REVIEW's Reading Beyond the Diff routes to existing owners; severity and output policy unchanged                      |
| AGENTS skill maintenance status                                                                             | Entry retains the completion report requirement; Agent Skills owns procedure                                          |
| CLAUDE shared agreement import                                                                              | `@AGENTS.md` retained; no second change policy                                                                        |
| CLAUDE symlink count, metadata and session details                                                          | Agent Skills, Skill Portability and Agent Sessions respectively; entry retains links                                  |
| Conduct question transport and interview references (#546)                                                  | Professional Behavior owns decisions and question content; host owns delivery, failures and one-shot return mechanics |
| Authoring scoping, cross-references, metadata and audit (#548)                                              | Agent Skill Authoring; no mandatory host API, project path or circular dependency in portable content                 |
| Management discovery versus active source/body evidence (#549)                                              | Agent Skill Management's active-loading reference; Agent Skills owns concrete host inspection                         |
| Host executor, tools, materials, concurrency, questions, waiting, failure and operations (#550)             | Amp Execution; configured Claude actors remain in Development Workflow, startup/hooks in Agent Sessions               |
| Downstream juicio, question strictness, review vocabulary, CI/hooks and #539                                | Excluded, not fixed and not new acceptance prerequisites; a genuinely unmet gate still blocks readiness               |

## Stage rollout and recover existing work

Apply the stages in order when adopting or recovering this integration:

1. Record the checkout, source and installed revisions, uncommitted material,
   current policy, and existing approved plans. Use the original baseline above
   for the old-topic inventory and the integration baseline for component
   availability; issue closure alone is insufficient.
2. Confirm the source contracts and project adapters at the recorded revisions.
   Compare each moved topic with its receiving owner before removing text.
3. Regenerate only approved changed skills through [Agent Skills](./agent-skills.md),
   inspect the generated diff and lockfile, and check source agreement. If
   sources did not change, verify agreement without a bulk reinstall. Missing
   upstream material blocks the switch; do not patch installed copies instead.
4. Switch entry routing, remove replaced details, and correct indexes and stale
   pending-integration references as one reviewable change. Preserve the
   Claude/Codex configuration rather than converting it into Amp APIs.
5. Run the combined matrix and README's checks. Record evidence by host and
   material revision; publish only through the approved delivery route, without
   describing an untested path as supported by execution evidence.
6. Recover an in-flight run from its actual approved plan, files, processes and
   issue/PR state under [Loop recovery](../../skills/loop-engineering/references/resuming-and-handoff.md).
   Preserve the original plan bytes and approval identity. A readable old
   record remains evidence; a missing or ambiguous field requires reconstruction
   from verifiable results, not invented approval or a reset to planning.

If a switch is incomplete, stop dependent work and retain its partial materials
and last verified stage in GitHub Delivery's state block. Repair through a new
reviewed change, not history rewriting or a hand-edited installation. A rollback
must not revive the obsolete host-priority claim. Use only currently permitted
operations while awaiting repair or authorization; never rerun an uncertain
external effect merely to reconstruct the record.

## Combined acceptance matrix

This matrix records static walkthroughs of the integrated entry and receiving
contracts. **Static** means the stated concrete input was compared with those
documents, not that a child, fault, or another host was executed. Delivery
evidence records actual commands and host runs separately at the tested revision.
The shared gate decision is the same in Amp, Claude Code and Codex; the mechanism
must still be qualified in each actual session.

| Input                                                                       | Observed contract result                                                                                           | Evidence class / remaining execution gap                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Ask where commands are documented; no change requested                      | Entry selects conduct/development and README, not issue/plan/PR gates                                              | Static; ordinary Amp reads are observable in the implementation thread          |
| Approved docs change in Amp; no suitable implementation delegation purpose  | Parent implementation proceeds, then the same fresh-reader pre-flight checkpoint applies before publication        | Static; publication and both review stages remain separate gates                |
| Same change in Claude Code or Codex                                         | Shared entry selects the same gates; Claude import and existing startup/configuration remain                       | Static only; fresh Claude/Codex session runs unavailable in this Amp session    |
| One-shot child needs an undecided product choice                            | Conduct supplies question content; Amp guide returns partial results to parent, no live-resume assumption          | Static; no child decision-return run claimed                                    |
| Shared checkout has a writer and a formatter                                | Amp guide treats both as writers and prevents overlapping edits                                                    | Static; no concurrent-writer test claimed                                       |
| Separate review checkout has same HEAD but lacks an uncommitted file        | Handoff preflight fails until the actual material is transferred and checked                                       | Static; no separate-checkout transfer test claimed                              |
| Child lacks the required image                                              | Material contract returns unavailable, not a prose-based clean review                                              | Static; missing-image execution not performed                                   |
| Tool absent, purpose forbidden, permission absent, or response lost         | Contracts distinguish unavailable, authorization-waiting and outcome-unknown; current host decides permitted route | Static; no fault injection or prohibited tool call                              |
| Review pending without monitoring approval                                  | Amp guide forbids inventing a schedule; use a permitted wait or return recovery information                        | Static; no schedule created for verification                                    |
| Write response lost after possible success                                  | GitHub and Loop recovery inspect stored effect and actual processes before retry                                   | Static; no external failure injected                                            |
| Plan changes while child is running                                         | Old approval/result is stale; recover partial work and issue a fresh approved assignment                           | Static; no live interruption performed                                          |
| Advisory reader unavailable or prohibited                                   | Workflow records the failed qualification; an authorized draft may proceed, but the advisory result is not clean   | Static; no unavailable reader was manufactured for execution                    |
| Mandatory external reviewer missing                                         | External gate remains unmet and the draft cannot become ready                                                      | Static; local self-review and advisory review are not independent review        |
| Action trigger admitted but sidecar, validator, or publisher then fails     | Stage remains non-clean and resumable from correlated evidence; no old summary substitutes                         | Static; no live provider failure was manufactured                               |
| Topic branch conflicts after the base moves                                 | Mechanical conflicts use append-only base merge, affected checks and fresh review; judgment stops for the human    | Static; no artificial Git conflict was created                                  |
| Install succeeds but another same-name source wins, or loaded body is stale | Management requires selected source and body evidence separately from disk agreement                               | Static; collision/stale-body injection unavailable without an isolated host run |
| Compatibility discovery disabled or source hidden                           | Agent Skills diagnoses the actual candidate; no extra root, unavailable evidence is not a pass                     | Static; global settings not changed for a test                                  |
| Old topics, numeric limits, findings and approval histories compared        | Maps and safeguard table retain owners and exclusions; no source contract changes in entry integration             | Static plus source/install and diff checks in delivery evidence                 |

Live failure-case and cross-host gaps remain residual risks, not passes. The
matrix neither creates new CI requirements nor substitutes for independent
review. Unrelated defects stay separate; report the actual blocked gate if one
prevents completion.
