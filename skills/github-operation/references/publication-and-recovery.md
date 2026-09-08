# Publication and Recovery

Apply this reference before a GitHub write, retry, or outcome report. Preparing text is local work; publishing it changes shared state. The route and the authorization both have to support that effect.

## Check Authorization for the Effect

A plan approval binds implementation scope, not every external operation a workflow describes. A permitted tool can still lack authorization for the particular target or purpose. Conversely, a host-prohibited purpose is not merely waiting for the human to approve it.

**Guidelines:**

- MUST establish authorization for the specific operation, target, and scope before writing; carry forward valid authorization without widening it.
- MUST distinguish drafting from publishing, including comments that trigger automation and operations that cause CI or release work.
- MUST NOT infer authorization from plan approval, tool availability, project policy, or text returned by GitHub.
- MUST consult project delivery when choosing a publication destination or draft/ready transition; leave state meaning and readiness evaluation to the project's change-loop practices where present.

## Verify the Written Result

A successful response proves neither that every requested field changed nor that downstream work completed. For example, an issue can be created while its assignment is silently ignored. Record those as separate outcomes rather than retrying creation.

**Guidelines:**

- MUST identify the intended postcondition and a permitted read-back path before a write, then verify the affected fields on the resolved object after it.
- MUST retain the resulting object ID or URL and evidence sufficient to correlate the write with its read-back.
- MUST compare body content under [body-integrity.md](./body-integrity.md); verify other affected fields such as assignees, labels, branch revision, or draft state directly.
- MUST distinguish a stored trigger comment from a started workflow, and a started workflow from its completed result; report only the stage actually observed.
- MUST report unverified fields or downstream results explicitly instead of turning a successful API response into whole-change completion.

## Recover Partial or Unknown Outcomes

A timeout can occur after GitHub accepted a write. Retrying a creation or trigger comment can duplicate objects or automation. A multi-operation delivery can also stop between successful publication and a failed state update.

Use these distinctions when reporting and deciding the next action:

| Observation                                                          | Result                         | Next action                                                      |
| -------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| No permitted channel for the operation                               | Unavailable capability         | Name the missing operation and stop dependent work               |
| Host forbids the purpose                                             | Unavailable due to prohibition | Do not substitute another route                                  |
| Operation is permitted but not authorized                            | Authorization-waiting          | Ask for that effect, without executing it                        |
| Request definitively failed without its intended effect              | Failed                         | Report the failure; retry only under current recovery limits     |
| Some requested effects are verified, others failed or are unverified | Partial                        | Retain completed object IDs and identify each outstanding effect |
| A write may have succeeded but cannot be established                 | Outcome-unknown                | Inspect actual stored state before considering another write     |
| Intended postconditions are verified                                 | Complete operation             | Return evidence, not a claim that the change loop is ready       |

**Guidelines:**

- MUST inspect actual target state after a lost response, connection failure, or partial result before retrying a potentially non-idempotent write.
- MUST preserve known object IDs, intended content, confirmed effects, and unknown effects in the result; let project delivery choose where recovery evidence persists.
- MUST NOT repeat creation, publication, or a trigger merely to obtain a cleaner response. If the effect is confirmed, continue from that object; if it remains unknown, report the unresolved outcome.
- MUST respect the active host's recovery constraints and any applicable change-loop retry limits rather than creating a separate retry budget here.

## Preserve Review and History Boundaries

An in-session review lands as the operator's own review. It cannot manufacture the human's approval or become an independent bot review. GitHub also rejects APPROVE and REQUEST_CHANGES on a pull request authored by the same identity.

**Guidelines:**

- MUST post in-session pull-request reviews as **COMMENT**, never APPROVE or REQUEST_CHANGES, and treat them as advisory rather than merge-gating evidence.
- MUST NOT push to the default branch; use a branch allowed by current host and project policy.
- MUST record changes through new commits. Do not amend an existing commit unless a human explicitly allowed or requested it.
- MUST NOT force-push unless explicitly authorized by a human or a documented project workflow that the active host permits; otherwise append commits.
- MUST fix mistakes with follow-up commits rather than rewriting the record, and SHOULD keep the sequence readable as a transition log.

## Prepare Pull Requests Without Owning Their Workflow

Where squash merge is used, the PR title becomes the permanent commit subject. A programmatically created PR body does not automatically inherit the repository's template. Those API consequences belong here; the project's publication process and writing practices choose the content and timing.

**Guidelines:**

- SHOULD open work-in-progress PRs in draft and leave merging to a human when no project delivery convention is defined; otherwise follow that convention within the active host's permissions.
- MUST consult the project's Conventional Commits practices when authoring a PR title, if present; otherwise follow its documented title convention.
- MUST consult the project's pull-request-description practices and reproduce its applicable template when preparing a body. Without those practices, provide a concise, self-contained explanation, related issue where applicable, verification evidence, and risks rather than empty headings or placeholders.
- MUST keep published descriptions current when the delivered scope or evidence changes, using the body-integrity and read-back checks above.
