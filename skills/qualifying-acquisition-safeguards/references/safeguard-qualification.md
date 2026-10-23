# Qualify optional acquisition safeguards

Use this reference only when assessing an optional safeguard relying on
actor-local skill-acquisition evidence to observe acquisition or refuse
dependent mutations. It qualifies that use of acquisition evidence, not general
runtime controls. Project policy chooses whether to enable a safeguard; host
operations own interception, containment construction, scheduling, permissions
and activation mechanisms. These criteria supply no host API or new project gate.

## Audit before enforcement

Audit records observations without preventing an operation. Enforcement claims
that refusal prevents a defined mutation. A registered handler, visible event or
refusal message does not establish that control. Acquisition claims still use
the established actor-local acquisition contract; an intermediate
observation cannot prove final model delivery.

Actual refusal needs a bounded qualification exercise before ordinary
enforcement can be qualified. That exercise tests prevention without treating
an unqualified safeguard as protection for routine work.

**Guidelines:**

- MUST begin an optional safeguard with independently contained audit qualification before routine audit activation. Keep unqualified or unobserved scopes outside enforcement-success claims.
- MAY temporarily enable refusal for a qualification exercise separately authorized for specific actors, routes, targets and duration, only after establishing [exercise containment](#containment-and-cleanup) and [independent configuration restoration](#restore-temporary-refusal-configuration); that authorization does not permit broader enforcement.
- MUST return unqualified enforcement scopes to audit mode when the qualification exercise ends only where [audit noninterference](#qualify-audit-noninterference) is established; otherwise keep the optional safeguard inactive outside contained exercises. Every audit fallback below presupposes that evidence. Ordinary enforcement still requires qualified prevention evidence and applicable activation authorization.
- MUST distinguish what the safeguard observed, what it attempted to refuse and what mutation it prevented; audit completion is not enforcement qualification.
- MUST obtain applicable policy and authorization before activation or qualification effects. Qualification itself grants neither permission nor an exemption from normal tool permissions.
- MUST report hidden final delivery or actor/context correspondence as unknown even when callback coverage is complete; do not transfer the parent's observations to a worker.

### Qualify audit noninterference

A mode called audit can still refuse a valid edit or alter the executed mutation.
An unchanged target after an earlier permission denial cannot distinguish that
interference from observation-only behavior. Audit qualification therefore
begins under [independent containment](#containment-and-cleanup), not on routine
targets, and compares otherwise valid operations with the safeguard absent
across the [claimed reachable-effect scope](#scope-and-effective-composition).
An unchanged intended edit can hide collateral file or external effects; final
equality after rollback can hide observable interference. A separately permitted,
bounded acquisition-observation record is the only telemetry exception, not a
label for unrelated work or altered task/control behavior.

**Guidelines:**

- MUST demonstrate that otherwise valid mutations proceed without safeguard-imposed refusal or interference across the claimed reachable-effect scope in both Full and every relevant non-Full acquisition condition. Use the established actor-local acquisition coverage meanings, not receipt shape alone.
- MUST compare equivalent safeguard-absent controls under the same ordinary permissions and relevant state, applying [state, input and invocation-order controls](#control-state-and-invocation-order). Establish matching outcomes across the claimed effect scope after delayed or spawned work settles, excluding observable transient interference as well as final differences. A prior permission denial or operation never reached does not establish noninterference.
- MUST establish any telemetry exception before the exercise with all of the following bounds:
  - Separately permitted content recording acquisition observations only.
  - Declared, separately permitted destination and reachable effects under independent containment.
  - Settled effects verified against those bounds, including delayed or spawned telemetry work.

  Declaration alone grants no permission. Task/acquisition-material changes, changed permissions or effective control behavior and undeclared effects remain in the noninterference comparison.

- MUST establish noninterference for the actual claimed actor, event, route and effective handler composition, including its [concurrency conditions](#qualify-concurrent-actor-state).
- MUST follow each exercised history required by [state and invocation-order controls](#control-state-and-invocation-order) with all of the following noninterference controls:
  - Otherwise valid Full and relevant non-Full mutations.
  - Usable required recovery reads.
  - Equivalent safeguard-absent comparisons under the ordinary permissions and relevant state above.

  Keep each comparison's actual event history intact; initial allow behavior, a history reset or a fresh unaffected instance cannot establish post-event noninterference.

- MUST keep unknown, blocked or unexercised audit scopes, including hidden reachable effects, outside routine activation. Acquisition transitions do not authorize audit refusal. Audit evidence neither qualifies enforcement nor proves complete acquisition or final delivery; an unverified audit mode is not the fallback for unqualified enforcement.

## Containment and cleanup

A refusal exercise must remain safe when the safeguard fails entirely. Naming a
temporary path is not isolation if that path or a spawned operation can reach
ordinary work. Disposable targets also do not isolate a shared handler that can
deny unrelated operations. Cleanup cannot recover valuable data that an
uncontained exercise destroys, and cleanup is not evidence that the safeguard
prevented mutation.

**Guidelines:**

- MUST establish independent scope containment for the effective configuration before enabling temporary refusal. Use technical isolation by default, or separately authorized effective quiescence of non-exercise operations. Establish that non-exercise actors and routes cannot encounter the exercise configuration throughout possible refusal activity, including interruption and delayed or spawned work. Disposable targets, declared scope or the tested guard's own decisions cannot establish that boundary; without it, do not enable refusal.
- MUST establish independent containment before any qualification mutation: use isolated disposable targets whose resolved paths and reachable effects cannot damage ordinary work or valuable shared data even if refusal fails entirely. Include symlink and worktree aliases and delayed or spawned effects in that boundary.
- MUST establish the target baseline and cleanup conditions before the exercise, including permitted means to settle delayed or spawned work and restore the baseline or remove declared disposable targets.
- MUST NOT begin mutation exercises when containment or safe cleanup cannot be established; retain that scope as unqualified in audit mode.
- MUST settle delayed and spawned effects through permitted host operations before inspecting target state and verifying cleanup. Unsettled effects or unverified cleanup remain explicit limitations, not qualification success.
- MUST verify that cleanup restores the recorded baseline or removes the declared disposable targets. Cleanup or independent termination does not establish safeguard prevention, and containment alone does not establish [bounded target-class applicability](#apply-evidence-to-a-bounded-target-class).

### Restore temporary refusal configuration

Restoring a disposable target does not restore safeguard configuration. A crashed
qualification session or failed disable operation can leave unqualified refusal
active beyond its authorization. Configuration restoration therefore needs a
path that does not depend on the tested safeguard or the session finishing.

**Guidelines:**

- MUST establish the permitted non-enforcement baseline for the effective safeguard configuration and handler composition before enabling temporary refusal: qualified audit, or otherwise inactive.
- MUST establish automatic expiry or independently recoverable rollback satisfying all of the following conditions:
  - Restores the established baseline within the authorized duration.
  - Covers session interruption or failure of the ordinary disable operation.
  - Remains usable independently of the tested safeguard and continued qualification-session execution, under ordinary permissions.
- MUST NOT enable temporary refusal when that restoration path or its applicable interruption behavior cannot be established. A stated duration, planned final cleanup or target deletion alone is insufficient; do not assume a host expiry mechanism, rollback API or permission override.
- MUST perform history-preserving qualification controls within the authorized duration before normal final configuration restoration, without delaying restoration for unfinished controls. Restoration after interruption does not supply unperformed post-event controls or qualify their scope.
- MUST verify both configuration-restoration conditions below separately from target cleanup, after normal completion and each exercised interruption or disable failure:
  - Temporary refusal has ended.
  - Effective configuration and handler composition match the established baseline.

  An elapsed duration or successful disable response alone does not establish restoration.

- MUST retain unsettled effects or unverified target/configuration cleanup as explicit limitations, and stop further dependent work while possible unintended refusal remains unresolved. Inspect and settle unknown effects through permitted recovery operations before retrying.

## Scope and effective composition

An acquisition-safeguard claim names the actual host configuration and the routes
it covers. Qualification checks that configuration rather than assuming every
tool, worker or worktree shares the same handler. The relevant scope includes:

- Host and configuration revision, event stage and tool or command route.
- Actual actor/current-context correspondence, required material and assignment/material revision through inspection and mutation.
- Creation versus editing, resolved target/path classification and symlink/worktree aliases.
- Effective handler composition/state, order, combined outcomes and failure/timeout behavior.
- Inspected-to-executed input transformations, ordinary permissions and reachable effects.

**Guidelines:**

- MUST qualify actual host, event, tool and actor coverage, marking unsupported or unobserved routes explicitly rather than extending another route's result to them.
- MUST inspect effective handler composition, including ordering, aggregation, overrides and ignored outcomes; configured registration alone is insufficient.
- MUST correlate the input inspected with the input executed, including transformations or replacement inputs between observation and mutation.
- MUST distinguish creation from editing, resolve relevant symlink and worktree relationships, and establish the target before claiming path coverage. A path-shaped string alone does not establish which file was mutated.
- MUST include all routes within the claimed scope, including shell writes, patches and formatters where applicable. Formatting is mutation, not a blanket exemption.
- MUST establish the claimed reachable-effect scope independently of successful outcomes, including intended mutation and collateral, external, delayed or spawned effects reachable by the operation and effective composed handlers. An observed undeclared effect cannot be excluded or relabeled to obtain qualification.
- MUST preserve the active host's permission and tool-purpose restrictions; a proposed safeguard authorizes no otherwise prohibited operation.

### Keep acquisition evidence current through mutation

Input correspondence does not establish acquisition continuity. A cached allow
can pass static non-Full controls yet admit a mutation after compaction loses
required text. Enforcement qualification therefore covers the validity interval
from inspection through executed dependent mutation, including delayed or
spawned mutations and execution handoffs within its claimed scope. Unchanged
arguments, identifiers or timestamps cannot establish that interval; a recheck
followed by an unobserved transition leaves the same gap.

**Guidelines:**

- MUST establish actual actor/current-context, required-material and applicable-revision validity throughout that interval under the established actor-local acquisition meanings. Establish effective binding, or revalidate affected acquisition after relevant transitions before mutation with evidence of continued validity; a check alone cannot qualify an unobserved interval.
- MUST exercise relevant transitions between inspection and mutation, including the following:
  - Compaction.
  - Context or actor replacement.
  - Resumption.
  - Changed responsibility or required material.
  - Applicable-revision changes.

  Each now-non-Full control excludes admission by the earlier allow under [prevention controls](#prevention-and-valid-edit-controls), paired with otherwise valid current-Full and recovered-Full mutations through the same qualified scope. Apply [input, state and invocation-order controls](#control-state-and-invocation-order); permanently denying transitions or unconditionally reloading unchanged retained text is not the remedy.

- MUST check post-transition recovery with the actual transition history intact under [failure and recovery behavior](#failure-and-recovery-behavior): usable required reads, effective missing-material refusal and a current-acquired-material valid mutation. Audit instead retains its [effect-wide noninterference controls](#qualify-audit-noninterference), including otherwise valid non-Full work.
- MUST keep the affected enforcement claim unqualified when transition visibility or continued validity cannot be established. A narrower interval claim needs independently established restrictions, not a trace with no transition. Qualified audit or inactivity grants no exception to the actor's missing-material dependent-work rule; transitions after completed mutation affect later work, not its historical evidence.

### Apply evidence to a bounded target class

Mutation exercises remain independently contained and disposable. Their evidence
can apply to a precisely bounded class of ordinary targets only when relevant
target-dependent behavior is equivalent. A shared path prefix or matching
outcomes cannot establish that equivalence. Applicability supplies neither
activation permission nor another actor's acquisition or unobserved-route coverage.

**Guidelines:**

- MUST define the claimed target class and establish relevant equivalence with the exercised disposable targets independently of their outcomes, covering the conditions in [Scope and effective composition](#scope-and-effective-composition).
- MUST establish the actual intended target's membership in that class before applying its evidence; unknown membership or relevant equivalence leaves that scope unqualified in audit mode.
- MUST reassess applicability when relevant conditions change; a prior class or membership result cannot qualify changed behavior.

## Failure and recovery behavior

An acquisition safeguard that blocks the reads needed to recover missing text
cannot safely restore work. Failure behavior also depends on where an error or
timeout occurs: before inspection, after a refusal, or after mutation are not the
same outcome. A latched failure can leave the route unusable even when ordinary
refusal recovers; an allow-all latch can admit a valid edit while also admitting
missing-material edits. Successful work can also leave a latched allow or refusal
in composed-handler state. History-preserving controls need both post-event
acquisition conditions, not only a successful recovered edit.

**Guidelines:**

- MUST exercise malformed or missing inputs, unavailable evidence, handler failures and timeouts through the actual qualified route, recording whether mutation was reached and what happened.
- MUST verify that permitted recovery reads remain usable before refusal, including reacquisition of missing ranges from one verified revision.
- MUST, for enforcement qualification, follow each exercised history required by [state and invocation-order controls](#control-state-and-invocation-order) with usable required recovery reads, effective missing-material refusal and an acquired-material valid mutation through the same actual qualified scope under ordinary permissions. Keep the event's history intact in each comparison instance; do not reset that history or substitute a fresh unaffected instance. Blocked or unexercised post-event controls leave that scope unqualified. Audit exercises instead use [audit noninterference controls](#qualify-audit-noninterference).
- MUST distinguish known prevention, known mutation and unknown effects after a failure; inspect the actual target and settle unknown effects through permitted operations before retrying an uncertain operation.
- MUST retain unqualified failure cases as audit observations or explicit limitations rather than claim that an error automatically prevented mutation.

## Prevention and valid-edit controls

A useful qualification distinguishes effective refusal from both ignored
refusal and constant denial. A shell refusal paired with an unrelated successful
patch cannot rule out constant denial on the shell route. An admitted operation
can still corrupt the intended edit; a prevented edit can still report false
success. These contrasting observations answer different questions:

| Case                                                             | Necessary observation                                                                                                     | Limit                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Required material missing; target mutation reaches the safeguard | Caller-visible refusal and no committed or externally observable mutation                                                 | Refusal and final baseline equality alone are insufficient         |
| Required material acquired; otherwise valid mutation             | Correct intended mutation and matching safeguard-absent outcomes under normal permissions                                 | Constant denial or altered allowed effects fail this control       |
| Post-event behavior with actual history intact                   | Required reads, missing-material refusal and acquired-material valid mutation remain effective with actual history intact | An allow-all latch or fresh unaffected instance fails this control |
| Operation denied before reaching the safeguard                   | The earlier denial and its cause are recorded                                                                             | No safeguard prevention was exercised                              |
| Unsupported actor, event, tool or target                         | The unsupported scope is identified                                                                                       | Not a prevention success or proof of full coverage                 |

These are qualification criteria, not a report that any host passed them.
Walkthroughs can check the intended contract; only authorized actual exercises
can establish runtime prevention.

A well-formed receipt can still describe incomplete, stale or mixed-revision
material, or belong to another actor/current context. A receipt-shape check
can pass missing-input exercises while admitting mutations under these non-Full
conditions. The negative controls must distinguish complete current acquisition
from each relevant condition, not merely distinguish valid from malformed input.

An unchanged target while delayed work is still running cannot distinguish
effective refusal from a later write. Independently stopping that work
establishes cleanup, not prevention by the safeguard. A write followed by rollback
is compensation, not prevention: other consumers may already have observed the
transient change even when the final target matches its baseline.

**Guidelines:**

- MUST exercise every relevant non-Full acquisition condition in the claimed enforcement scope using the established actor-local acquisition coverage meanings, including well-formed partial, stale, mixed-revision and wrong-actor/current-context evidence. Each negative control must reach the safeguard and demonstrate effective refusal paired with a Full-acquisition valid mutation under the equivalent-input, state and invocation-order controls below.
- MUST leave unavailable or unexercised acquisition conditions and their affected scopes unqualified; receipt shape, another condition's result or an intermediate observation cannot qualify them or establish Full acquisition.
- MUST establish that the actual caller receives a refusal distinguishable from successful completion through the effective composed route. An internal handler's signal, a later-ignored message or a silently dropped mutation reported as success fails this control, even if the target remains unchanged.
- MUST demonstrate refusal preventing the intended mutation with evidence excluding committed or externally observable transient mutation within the claimed target/effect scope. Inspect actual target state after delayed or spawned work settles; final baseline equality alone is insufficient. Verify any termination through permitted host operations; unsettled effects remain unknown.
- MUST keep the affected prevention scope unqualified when permitted observations cannot exclude transient effects. Refusal output, successful exit, rollback and cleanup cannot establish prevention alone.
- MUST pair refusal with valid-edit controls through the same qualified event, tool, configuration and effective handler composition, using [state and invocation-order controls](#control-state-and-invocation-order) for starting-state equivalence and actual actor/context/target correspondence. Recovery reads still use their permitted read routes.
- MUST compare every current-Full and recovered-Full valid-edit control with an equivalent safeguard-absent control under the same ordinary permissions, inputs and relevant state, preserving the actual selected history under [state and invocation-order controls](#control-state-and-invocation-order). Establish the intended mutation and matching outcomes across the claimed reachable-effect scope after delayed or spawned work settles, excluding observable transient interference as well as final differences. Only acquisition telemetry meeting the [existing bounds](#qualify-audit-noninterference) is excepted; altered task/control behavior is not telemetry.
- MUST exercise valid-edit controls and recovery under the same ordinary permission boundaries; do not disable permissions to make a guard appear effective or grant broader permissions to make its control pass.
- MUST NOT count an unsupported route, an edit never reached, a prior permission denial or an unknown target effect as successful prevention.
- MUST label static analysis, fixtures and walkthroughs separately from actual host execution, and bound any promotion to the scope and failure cases the evidence establishes.

## Control state and invocation order

A handler that denies its first invocation and allows later invocations can pass
one missing-then-acquired sequence without inspecting acquisition. Matching
configuration does not hold internal state constant. Compare acquisition
conditions from equivalent starting states, then check the actual post-event path
separately so a reset does not erase the history being tested. Successful Full
work can affect a later non-Full actor through shared handler state without any
overlapping invocations.

A payload filter can also deny one command and allow another without consulting
acquisition. Compare equivalent executed mutations, not merely matching routes.
Necessary input variations must each cross both acquisition conditions rather
than assigning a denied payload to missing material and an allowed one to
acquired material. Post-event comparisons also need equivalent exercised history
in each instance; an untouched instance cannot rule out a latch caused by the event.

**Guidelines:**

- MUST start missing-material and acquired-material comparisons from verified equivalent state unrelated to acquisition, including effective composed-handler state and target baseline. For pre-event comparisons, the default is a permitted reset of the same tested scope; matched isolated instances are an alternative only when relevant starting-state and scope equivalence are established independently of their outcomes. Post-event comparisons retain the exercised history under [failure and recovery behavior](#failure-and-recovery-behavior).
- MUST preserve each comparison's actual actor/current-context and target correspondence; matched instances do not establish another actor's acquisition or extend coverage to unexercised scopes.
- MUST hold intended and executed mutation content and semantics equivalent across acquisition conditions, correlating inspected-to-executed transformations. Different disposable target identifiers require a target mapping established independently of outcomes; normalization must not discard mutation-relevant differences.
- MUST exercise each necessary relevant command or payload variation with both acquisition conditions independently of invocation order; an input-only deny/allow filter cannot qualify from differently assigned payloads.
- MUST repeat matched comparisons or counterbalance the acquisition conditions to distinguish acquisition-dependent results from invocation-position or history-dependent behavior. One missing-then-acquired sequence is insufficient.
- MUST keep the affected scope unqualified in audit mode when relevant input or state equivalence or the order comparison cannot be established; matching configuration or outcomes alone is insufficient, and an unavailable reset does not authorize an invented host mechanism.
- MUST exercise history-preserving post-event controls for all of the following history-producing events in the claimed scope:
  - Successful Full-acquisition mutations.
  - Refusals and relevant non-Full acquisition, including well-formed partial, stale, mixed-revision and wrong-actor/current-context evidence.
  - Handler failures or timeouts.
  - Malformed or missing inputs.
  - Unavailable evidence.
  - Relevant [acquisition transitions between inspection and mutation](#keep-acquisition-evidence-current-through-mutation).

  Select histories independently of outcomes, including relevant history from earlier non-overlapping actors sharing the handler. Follow each exercised history with [audit noninterference](#qualify-audit-noninterference) or [enforcement recovery controls](#failure-and-recovery-behavior), keeping equivalent actual history intact in each comparison instance. Reset-based comparisons cannot replace these controls.

  Follow-up controls examine the selected history rather than recursively require new exercises. Unexercised longer or differently ordered histories remain unqualified.

### Qualify concurrent actor state

Sequential controls can pass while actors overwrite shared acquisition state.
For example, a Full actor can overwrite a shared value between a non-Full actor's
inspection and mutation, admitting the latter's edit. Separate targets or
worktrees do not isolate effective handler state.

**Guidelines:**

- MUST state whether operations from multiple actors can overlap throughout inspection and executed mutation in the effective shared handler scope. Sequential or counterbalanced runs alone establish no concurrent coverage.
- MUST establish one of the following before claiming concurrent coverage:
  - Effective actor-state isolation established independently of outcomes.
  - Exercised contained interleaving controls for relevant shared acquisition and composed-handler state.

  Keep each actor's correspondence separate for the following:
  - Actual context.
  - Assignment/material revision.
  - Inspected-to-executed mutation.

- MUST, for concurrent enforcement claims, establish both outcomes under ordinary permissions:
  - A Full actor's shared-state update does not admit a non-Full actor's mutation.
  - The Full actor's otherwise valid mutation proceeds.

  Exercise relevant reverse roles and histories, including post-event controls; one ordering does not qualify every overlap.

- MUST, for concurrent audit claims, verify each actor's noninterference and recovery-read controls under the claimed overlap, including otherwise valid non-Full mutations.
- MUST keep concurrent scopes unqualified when isolation or relevant interleaving evidence is unavailable. A narrower single-flight claim requires an independently established restriction against overlapping invocations throughout inspection and mutation in the effective shared handler scope; sequential observations or separate actors, targets or worktrees do not establish that restriction.
- MUST reassess qualification when relevant sharing or concurrency conditions change. Unqualified enforcement stays in separately qualified audit, or inactive when that audit scope is unqualified; these criteria supply no serialization API or activation authority.
