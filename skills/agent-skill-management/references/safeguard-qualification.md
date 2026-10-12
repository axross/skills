# Qualify optional acquisition safeguards

Use this reference when assessing an optional safeguard that observes skill
acquisition or proposes to refuse dependent mutations. It states portable
qualification criteria, not a host hook API, activation procedure or new project
gate. Project policy chooses whether to enable a safeguard; host operations own
its mechanism and actual execution permissions.

## Audit before enforcement

Audit records observations without preventing an operation. Enforcement claims
that refusal prevents a defined mutation. A registered handler, visible event or
refusal message does not establish that control. Acquisition claims still use
[actor-local-acquisition.md](./actor-local-acquisition.md); an intermediate
observation cannot prove final model delivery.

Actual refusal needs a bounded qualification exercise before ordinary
enforcement can be qualified. That exercise tests prevention without treating
an unqualified safeguard as protection for routine work.

**Guidelines:**

- MUST begin an optional safeguard in audit mode and keep unqualified scopes there outside the bounded qualification exercises below. Keep unqualified or unobserved scopes outside enforcement-success claims.
- MAY temporarily enable refusal for a qualification exercise separately authorized for specific actors, routes, targets and duration; that authorization does not permit broader enforcement.
- MUST return unqualified scopes to audit mode when the qualification exercise ends; ordinary enforcement still requires qualified prevention evidence and applicable activation authorization.
- MUST distinguish what the safeguard observed, what it attempted to refuse and what mutation it prevented; audit completion is not enforcement qualification.
- MUST obtain applicable policy and authorization before activation or qualification effects. Qualification itself grants neither permission nor an exemption from normal tool permissions.
- MUST report hidden final delivery or actor/context correspondence as unknown even when callback coverage is complete; do not transfer the parent's observations to a worker.

## Scope and effective composition

A prevention claim names the actual host configuration and the routes it covers.
Qualification checks that configuration rather than assuming every tool,
worker or worktree shares the same handler. The relevant scope includes:

- Host and configuration revision, event stage and tool or command route.
- Actual actor/current-context correspondence and assignment/material revision.
- Mutation target, path classification and workspace/worktree.
- Effective handler order, combined outcomes and failure/timeout behavior.

**Guidelines:**

- MUST qualify actual host, event, tool and actor coverage, marking unsupported or unobserved routes explicitly rather than extending another route's result to them.
- MUST inspect effective handler composition, including ordering, aggregation, overrides and ignored outcomes; configured registration alone is insufficient.
- MUST correlate the input inspected with the input executed, including transformations or replacement inputs between observation and mutation.
- MUST distinguish creation from editing, resolve relevant symlink and worktree relationships, and establish the target before claiming path coverage. A path-shaped string alone does not establish which file was mutated.
- MUST include all routes within the claimed scope, including shell writes, patches and formatters where applicable. Formatting is mutation, not a blanket exemption.
- MUST preserve the active host's permission and tool-purpose restrictions; a proposed safeguard authorizes no otherwise prohibited operation.

## Failure and recovery behavior

An acquisition safeguard that blocks the reads needed to recover missing text
cannot safely restore work. Failure behavior also depends on where an error or
timeout occurs: before inspection, after a refusal, or after mutation are not the
same outcome.

**Guidelines:**

- MUST exercise malformed or missing inputs, unavailable evidence, handler failures and timeouts through the actual qualified route, recording whether mutation was reached and what happened.
- MUST verify that permitted recovery reads remain usable before and after refusal, including reacquisition of missing ranges from one verified revision.
- MUST distinguish known prevention, known mutation and unknown effects after a failure; inspect the actual target before retrying an uncertain operation.
- MUST retain unqualified failure cases as audit observations or explicit limitations rather than claim that an error automatically prevented mutation.

## Prevention and valid-edit controls

A useful qualification distinguishes effective refusal from both ignored
refusal and constant denial. A shell refusal paired with an unrelated successful
patch cannot rule out constant denial on the shell route. These contrasting
observations answer different questions:

| Case                                                             | Necessary observation                                              | Limit                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| Required material missing; target mutation reaches the safeguard | Refusal takes effect and the target remains unchanged              | A refusal message alone is insufficient            |
| Required material acquired; otherwise valid mutation             | The mutation proceeds under normal permissions                     | Constant denial fails this control                 |
| Recovery after refusal                                           | Required reads succeed and a subsequent valid mutation can proceed | Preventing recovery is not successful protection   |
| Operation denied before reaching the safeguard                   | The earlier denial and its cause are recorded                      | No safeguard prevention was exercised              |
| Unsupported actor, event, tool or target                         | The unsupported scope is identified                                | Not a prevention success or proof of full coverage |

These are qualification criteria, not a report that any host passed them.
Walkthroughs can check the intended contract; only authorized actual exercises
can establish runtime prevention.

An unchanged target while delayed work is still running cannot distinguish
effective refusal from a later write. Independently stopping that work
establishes cleanup, not prevention by the safeguard.

**Guidelines:**

- MUST demonstrate refusal preventing the intended mutation from actual target-state evidence after the attempted mutation and any delayed or spawned work have settled; a pre-edit event, refusal output or zero exit status is insufficient. Verify any termination through permitted host operations; unsettled effects remain unknown.
- MUST pair refusal with valid-edit and post-recovery mutation controls through the same actor, event, tool, target, configuration and effective handler composition, varying only the acquisition condition. Recovery reads still use their permitted read routes.
- MUST exercise valid-edit controls and recovery under the same ordinary permission boundaries; do not disable permissions to make a guard appear effective or grant broader permissions to make its control pass.
- MUST NOT count an unsupported route, an edit never reached, a prior permission denial or an unknown target effect as successful prevention.
- MUST label static analysis, fixtures and walkthroughs separately from actual host execution, and bound any promotion to the scope and failure cases the evidence establishes.
