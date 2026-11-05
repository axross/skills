# Selecting Review Workflows

Select the invocation route for each review checkpoint without changing what that checkpoint means. Pre-flight is the advisory review before the first push and draft pull request (PR). Mandatory independent review happens after PR creation. A different reviewer or tool changes neither stage's input, finding authority, limits, nor completion conditions.

## Select Each Checkpoint's Route

An installing project can choose a route in ordinary prose in `AGENTS.md`, another applicable instruction file, project operations, or an applicable skill. No special configuration file or schema is needed. Resolve instructions through their actual source, scope and priority; a skill does not automatically outrank project instructions or vice versa.

**Example:**

> For every PR in this repository, request independent review by posting a comment containing `@claude review`.

That sentence selects the post-PR trigger on every authoring host. Keep the existing pre-flight checkpoint, then request `@claude review` after creating the PR, follow the configured review service's completion contract, address findings and obtain fresh review after fixes. Do not also request the host's default reviewer.

**Guidelines:**

- MUST identify applicable review instructions separately for pre-flight and post-PR independent review, and record the selected route and its grounds in existing run state.
- MUST follow an explicitly selected route, including one named by a single sentence or an applicable skill; use the defaults below only for what applicable instructions leave unspecified.
- MUST preserve [pre-flight's existing contract](./pre-flight-review.md) and the mandatory post-PR [independent-review contract](./independent-review.md). A pre-PR review never satisfies the post-PR gate; conflicting timing instructions require resolution, not silently moving or skipping a stage.
- MUST keep pre-flight's existing default and checkpoint qualification when its route is unspecified; the post-PR defaults below neither replace nor disable it.
- MUST NOT silently replace an explicitly selected unavailable or failed route with a host default. Record the unmet checkpoint and seek resolution through the applicable blocker and human-decision practices.

## Default Post-PR Arrangement

The default is a reviewer other than the implementation author, working in a fresh context without the author's conversation or accumulated implementation reasoning, and publishing its own result to the PR. A child session or thread can provide this separation even on shared infrastructure or under a shared GitHub login. Those arrangements do not establish environment or account independence; a project requiring either retains that stronger condition.

Here, an **external review** means the mandatory post-PR review outside the author's context. A local pre-flight result remains advisory even when its reader also used a fresh context.

Reviewing the actual PR can expose author explanations and self-assessment. Their presence does not make them correctness evidence: the reviewer needs the actual material and applicable requirements to judge those claims. Context independence does not require hiding authorship or Git history.

**Guidelines:**

- MUST use a context-independent post-PR reviewer through the active host's available, permitted means when no explicit route is selected. Use the matching example below where available, and qualify an equivalent fresh-context route for an unlisted host.
- MUST qualify required material access, review purpose, publication capability and authorization before relying on a reviewer route. Shared infrastructure or account identity alone does not disqualify it unless applicable policy requires separation; a new name or model alone does not qualify it.
- MUST give a created reviewer a neutral review assignment identifying the repository, PR, base/head material and required artifacts and policy. Have it inspect the actual PR and acceptance-criteria projection; exclude the author's conversation, accumulated implementation reasoning, implementation receipt and pre-flight ledger. Reuse neither the implementation author nor a prior round's review context.
- MUST preserve access to required policy, artifacts and surrounding code, and ground the review in that material and applicable requirements. Treat author explanations, claimed verdicts and self-assessed acceptance-criterion statuses as unverified claims, not evidence of correctness.
- MUST have the reviewer publish the review directly to the PR and return its result locator. A private child reply or the parent's reposted summary is not the posted reviewer-origin result required for completion.

## Host Examples

These examples travel with the skill so an installing repository needs no copy of its author's host runbooks. They illustrate the default arrangement; an explicit route such as `@claude review` takes precedence. Current host contracts determine which launch, publication and closure operations actually exist and are permitted.

The default examples are:

| Authoring host | Post-PR default                                                                                                                                                                | Completion and cleanup                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex          | Request Codex code review by posting a dedicated PR comment containing `@codex review`, or use the repository's configured equivalent Codex code-review trigger.               | Verify the published reviewer result against the request and material. A reaction or service status alone is insufficient. There is no caller-created child session to close for this hosted trigger.                |
| Claude Code    | Start a fresh review child session, such as a non-fork subagent with the required PR read/publication tools. Ask that child to inspect and post its review directly to the PR. | Verify the child's posted result, then end the review child session using its supported lifecycle operation. Automatic one-shot termination counts when observed; an idle resumable session is not proof of closure. |
| Amp            | Start a fresh review child thread for the PR. Give it material locators rather than inheriting the implementation conversation, and ask it to post directly to the PR.         | Verify the posted result, then close/archive that review thread through the supported thread lifecycle operation, preserving its history.                                                                            |

**Example child assignment:**

> Review PR [URL] in repository [identity], base [revision], head [revision], under the applicable review policy [locator]. Inspect the actual diff, surrounding code, PR acceptance criteria and required artifacts [locators]; verify author claims against those materials. Do not edit the implementation or delegate. Publish your review directly to this PR using the permitted publication route and adopted report format, including a no-findings result when appropriate. Report the published result locator, reviewed material, host-enforced restrictions and any limitations or instruction-only constraints, then finish.

Verified against [Codex's GitHub review documentation](https://developers.openai.com/codex/integrations/github/), [Claude Code's subagent documentation](https://code.claude.com/docs/en/sub-agents), and Amp's [agent-to-agent](https://ampcode.com/docs/orbs/agent-to-agent) and [thread lifecycle](https://ampcode.com/docs/threads) documentation on 2026-11-05. Claude Code forks inherit the parent conversation and do not provide the fresh context this default requires. Amp handoffs can carry selected author context; a handoff label alone likewise establishes no independence. Example documentation is not evidence of a successful live review in the current host.

**Guidelines:**

- MUST check the current host's permitted tool contracts and, where needed, official documentation rather than assume an example's tool is installed or a nested publication route is available.
- MUST use available, permitted tool restrictions for a review child while retaining required material access and direct PR publication. Distinguish host-enforced restrictions from instruction-only constraints; a prompt prohibition alone does not establish enforced read-only access.
- MUST keep a missing review or PR-publication capability visible as an unmet independent-review gate; returning a private review cannot substitute for posting it.

## Review Session and Thread Cleanup

A review child is a temporary resource for one review round. Close it after its result is posted and verified, rather than keeping it until merge or reusing its context for another round. This cleanup is distinct from releasing a merged or closed change's branch and working copy.

Review validity and cleanup outcome are separate facts. A failed close does not invalidate an already verified posted review, but the failure still requires action and a concrete human handoff.

**Guidelines:**

- MUST retain each created review session/thread's checkable identity, round, posted-result locator and closure status in the existing permitted run record; distinguish a durable identity from a transient worker handle. On recovery, inspect actual posting and closure state before retrying or requesting another assessment.
- MUST close each review child the run created after verifying its posted result, using an available supported end/close/archive operation and preserving review history and PR evidence. Verify closure rather than infer it from the reviewer's final message; record observed automatic termination where the host provides it.
- MUST ask the human for missing cleanup permission when a permission boundary prevents closure, then attempt cleanup if that permission is granted and the operation is permitted. Carry forward existing permission and actual denial evidence rather than repeat an unchanged request or bypass a prohibition.
- MUST tell the human when cleanup cannot be completed for another reason, or permission remains unavailable, identify the exact session/thread and reason, and ask them to close it with concrete host-specific steps. Resolve the operation from current host documentation; do not invent a command or merely say "clean up manually".
- MAY complete the overall change despite failed review-child cleanup once all applicable permission-request, cleanup-attempt and concrete human-handoff obligations above are fulfilled and all other gates are satisfied; report the remaining resource and actual outcome without claiming successful closure.
- MUST preserve incomplete review/publication evidence when a run fails or stops before a result is posted, release its review child when safe through a permitted route, and apply the same failure handoff if closure is impossible. Closing a child supplies no missing review result, and lost publication responses require outcome inspection before retrying.
