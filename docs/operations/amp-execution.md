# Amp Execution

Maintainers running this repository in Amp use the simplest permitted execution
route. This reference maps the portable Loop assignments to Amp operations;
it does not grant tool access or replace the current tool definitions.
[Development workflow](./development-workflow.md) owns project gates,
[Loop Engineering](../../skills/loop-engineering/SKILL.md) owns transitions and
evidence, and [Professional Behavior](../../skills/professional-behavior/SKILL.md)
owns decisions and question content. Direct and delegated changes keep the same
approval, verification, and independent-review requirements.

The operational baseline was checked on 2026-09-08 against the active session's
tool definitions and Amp's [modes and subagents](https://ampcode.com/docs/models-and-subagents)
and [agent-to-agent documentation](https://ampcode.com/docs/orbs/agent-to-agent).
Those pages explain the model; a session MUST recheck its actual tools and their
purpose restrictions before using this guide. Names below are not promises that
every session exposes the same tools.

## Qualify the executor

Before effects, compare the assignment with the executor's actual access to
files, shell commands, network, images, communication, interruption, resumption,
and workspace. A parent MUST NOT infer a child's capabilities from its own.
Require the child to confirm the source, revision, required material and return
path before editing; missing access returns a non-complete result.

Use the [Loop handoff contracts](../../skills/loop-engineering/references/implementation-package.md)
for the content of an assignment and result, including read-only work. In this
repository, identify `axross/skills`, the checkout and base/head revisions,
and any uncommitted files or patches with content identifiers. Local `main`
and `origin/main` are not interchangeable. A commit ID alone does not identify
uncommitted work. Supply exact text or images where the assignment requires
them, and have the executor actually view required images rather than accept
a description as equivalent evidence.

Keep four failure cases distinct:

| Observation                           | Next action                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Required tool or material missing     | Return `unavailable`; identify the missing access.                             |
| Tool present, but purpose denied      | Use a permitted route, usually direct work; do not emulate the forbidden call. |
| Operation needs human permission      | Return `authorization-waiting`; ask for that operation only.                   |
| Response lost after a possible effect | Return `outcome-unknown`; inspect actual state before retrying.                |

## Select a route by purpose

The parent normally implements a coherent change directly. Do not delegate only
because a task is complex, spans files, or needs routine self-review. The active
contracts determine whether one of these narrower routes fits:

| Route       | Appropriate use in this repository                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell reads | Exact paths, symbols, and bounded local inspection.                                                                                                                        |
| Finder      | Behavior-level local discovery or related searches across modules.                                                                                                         |
| Librarian   | External repositories, dependency internals, or remote history; not local first-party reads.                                                                               |
| Oracle      | A specific unresolved, high-impact judgment after direct investigation; not routine review or an approval gate.                                                            |
| Task        | Independently specifiable parallel work, a bounded unit whose intermediate output needs isolation, or explicit user-requested delegation, as its current contract permits. |
| Threads     | A separately owned outcome or independent review; not a second route into the same runner and checkout merely to gain access.                                              |

Specialist calls do not remove the parent's responsibility to inspect evidence.
Keep implementation single-threaded unless writers have genuinely disjoint
targets. Do not invent an actor ranking or map the Claude actor names to Amp
tools. Omit mode overrides normally; custom/plugin modes and ultra require the
explicit selection prescribed by `create_thread`. Record observable requested
and returned metadata, and mark an unobservable model or effort unknown rather
than infer it from a role name.

## Qualify the advisory reader

At the advisory checkpoint selected by
[Development workflow](./development-workflow.md), qualify a fresh review
context against its permitted purpose, access to the stable source and
uncommitted diff, current policy, approved plan and required materials, and a
usable return channel. A route name alone proves none of these. Use only
mechanisms whose current contracts permit routine read-only review; do not
substitute Task, Oracle or another specialist when its purpose excludes that
review. Freeze competing writers before supplying the actual target under the
Loop review contract.

If no route qualifies, record whether the cause is a missing capability,
prohibited purpose or missing material and identify the failed qualification.
Return that result under the
[Loop handoff contracts](../../skills/loop-engineering/references/implementation-package.md);
Development Workflow owns the delivery restriction, and
[Loop recovery](../../skills/loop-engineering/references/resuming-and-handoff.md)
owns which checkpoint resumes.

## Return questions from one-shot work

Task receives the supplied prompt, not the parent's conversation. Its final
result is the return channel; the parent cannot guide it midway through the
call. A Task encountering an unresolved human decision MUST return the question,
verified findings, partial changes, blocked work and any remaining processes.
It MUST NOT assume a live parent answer or same-instance resumption.

The parent presents the question in the conversation when no dedicated question
tool exists, and stops dependent work. After an answer, use a fresh assignment
if more one-shot work is warranted. A changed approval target follows Loop's
reapproval rules; a child's recommendation is not the human's answer. A failed
question delivery leaves the decision unresolved, not approved.

## Establish thread materials and workspace

`create_thread` selects the child's executor, not a restriction on the caller's
executor. An orb starts from the project's default branch and does not inherit
the parent's local files. If the outcome depends on a user's machine, use an
appropriate live runner from a fresh `list_runners` result or ask the user;
do not silently substitute an orb. Name the project and give the child a complete
owned task, with no nested delegation unless the user requested it.

Confirm the destination checkout rather than assume all threads are separated
or shared. For shared checkouts, agree on write ownership before starting.
For separate checkouts, explicitly transfer required materials and results.
`send_thread_message` carries instructions and findings, not files or commits.

Use `upload_thread_file` for required local files, and `download_thread_file`
for an arbitrary result file from a running workspace, subject to their limits.
`download_thread_changes` recovers the latest captured changes even when the
source executor is unavailable; it is not a copy of the entire workspace or
proof of the latest uncaptured work. Inspect reported deletions and skipped files.
Use a staging destination and avoid overwriting local work without checking it.
Transfer patches or other revision material explicitly when needed; forwarding
image paths or attachments also requires the destination to confirm access.

Before integration, compare the result's plan and material revision with the
assignment. Compare its self-review target, policy, outcome, unresolved findings
and limitations with the returned commits, files or patch. Then inspect the
actual contents, account for deletions and uncommitted changes, and run the
affected checks in the destination checkout. Missing, stale or mismatched
self-review evidence is not clean. Changes made during integration require a
current parent self-review of the integrated diff. Neither a completion message
nor a downloaded file proves integrated correctness.

## Coordinate writers and late results

Parallelize independent reads when permitted. Treat formatters, installed-copy
generation, Git operations and tests that write shared state as writers too.
Do not run the repository-wide formatter while another actor edits its inputs.
A read of a changing file is not stable review evidence; provide a fixed material
revision for review.

When new input changes the plan, stop affected execution using an available,
permitted interruption mechanism. If no such mechanism exists, do not claim
cancellation: keep conflicting work stopped, identify possible ongoing effects,
and recover partial results. A late result remains tied to its original plan;
audit any reusable material before adopting it under a newly approved plan.
Loop's [writing and recovery contract](../../skills/loop-engineering/references/writer-ownership-and-recovery.md)
owns retries and approval invalidation, not the tool chosen to stop work.

## Wait for the right result

Process, child, thread, CI and human completion are different events:

| Awaited result        | Amp route and completion check                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell command         | Follow the returned PID with `shell_command_status`; check exit status and output. A tool wait timeout does not stop the process.                                                   |
| Task                  | Inspect its final result and actual evidence; a partial result is not a finished change.                                                                                            |
| Thread, reply path    | Ask the child to reply and continue independent work. Do not also call `wait_for_threads` for that child.                                                                           |
| Thread, join path     | Do not request a reply; use `wait_for_threads` only when progress depends on the result. Inspect status/content afterward: idle, approval-waiting or error is not proof of success. |
| CI or external review | Read checks and review evidence through the permitted GitHub route; a successful trigger is not a successful review.                                                                |
| Human decision        | Ask and end the turn; never poll for human approval.                                                                                                                                |

Use expected-duration waits, not repeated tiny polls. `shell_command_kill` is
for a demonstrably hung tracked process under its current conditions, not for
a normal long test or a command whose tool timeout merely elapsed. Service
shutdown follows the service lifecycle, not process-pattern killing.

The [migration safeguards](./loop-migration.md) retain the retry and round
limits. Loop's [independent-review contract](../../skills/loop-engineering/references/independent-review.md)
owns the waiting policy. In Amp, cleanup MUST use a permitted mechanism, or
report the still-running process; reaching a Loop bound does not authorize
`shell_command_kill` on an otherwise healthy process.

Scheduling requires the user's explicit monitoring, scheduling, or later-follow-up
request and the `building-schedules` skill before schedule tools. A wait cap,
review request, or available scheduler is not permission. Thread completion uses
the chosen reply/join path, not scheduled polling. Without authorized scheduling,
use a permitted current-turn wait or stop with recovery information. Missing
cache-TTL or cost timing metrics never block otherwise permitted work.

## Recover uncertain effects

After connection failure, let connectivity stabilize, then inspect the tracked
process, worktree, partial commits and any external operation's stored result.
Do not infer cancellation or absence of effects from a missing response. Avoid
repeating a non-idempotent operation merely to recover output. If inspection
cannot settle the outcome, keep it `outcome-unknown` and report the needed access.

Recover the approval revision, attempts, pending result and remaining processes
through Loop's [recovery contract](../../skills/loop-engineering/references/resuming-and-handoff.md).
GitHub state storage and independent-review invocation remain in
[GitHub Delivery](./github-delivery.md) and
[code review operations](./code-review.md). No local specialist call
substitutes for the mandatory external review.

## Keep host operations separate

[Agent sessions](./agent-sessions.md) owns provisioning, hooks, service lifecycle
and telemetry. This guide changes none of their settings or event semantics.
Use Amp's supervised service tools when a service is actually needed; this
repository currently has no development server. Do not create one to exercise
an execution guide.

[Agent skills](./agent-skills.md) owns installation and refresh. Active source
and content verification follows its Amp procedure, not this guide; a reload or
successful install alone is not evidence of which content an actor loaded.
[Loop Migration](./loop-migration.md) records combined entry verification.

Claude Code and Codex consume the same semantic assignments and results, but
their operational APIs are not Amp aliases. Their configured actors remain in
[development workflow](./development-workflow.md), and their startup, hooks and
telemetry stay in [agent sessions](./agent-sessions.md). Qualify communication,
resume and workspace access from each actual session rather than assume that
Claude actor configuration supplies Amp capabilities. Preserve existing behavior;
mark an unavailable host path untested instead of claiming cross-host coverage.

## Exercise bounded scenarios

Use these cases when checking this guide. Record the target revision, input,
observed result and limitations with the delivery evidence. A walkthrough or
simulation MUST NOT be labeled an actual host execution. Run safe representative
cases only when tool purposes permit them; do not manufacture external effects,
schedule requests, unavailable APIs or expensive modes to prove prose.

| Case                                                           | Required observation                                                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Parent or child implements an approved change                  | Both reach the same advisory checkpoint before initial publication; implementation itself is not forced into another actor. |
| Eligible Task independently inspects a fixed material revision | Final evidence identifies that revision; an unresolved decision returns to the parent without live dialogue.                |
| Two writers share a checkout                                   | Overlapping edits, formatter and Git mutations wait for ownership; no concurrent overwrite.                                 |
| Separate thread reviews an uncommitted file                    | HEAD alone fails preflight; transfer the file, verify its content identity, retrieve and inspect the result.                |
| Required image or tool unavailable                             | Non-complete result identifies missing access; prose is not visual verification.                                            |
| No permitted fresh advisory reader                             | Record the failed qualification and advisory gap; separately authorized draft delivery may proceed, but never as clean.     |
| Review pending without monitoring authorization                | No schedule created; use a permitted wait or return recovery information.                                                   |
| Lost response after a write                                    | Inspect stored bytes and process state before any retry.                                                                    |
| Plan changes before a child returns                            | Old result does not satisfy new approval; recover and audit it first.                                                       |
| Existing host or mandatory external reviewer unavailable       | Report the untested path; mandatory external review remains unmet until obtained.                                           |

Run the documented format, lint and aggregate checks in
[README](../../README.md) after edits. The aggregate suite includes the docs
validators; it checks structural consistency, not actual host compatibility.
