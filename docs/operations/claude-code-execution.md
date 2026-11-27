---
type: Procedure
title: Claude Code Execution
description: How Claude Code and Codex sessions select permitted tools, isolate work and wait for review.
---

# Claude Code Execution

Maintainers running this repository in Claude Code — and, for the instruments
the two share, in Codex — use this reference to pick the instrument for a step
whose _meaning_ another owner already fixed. It maps the portable contracts onto
those hosts' operations; it grants no tool access and replaces no tool
definition. [Development Workflow](./development-workflow.md)
owns this repository's gates, [Loop Engineering](../../skills/loop-engineering/SKILL.md)
owns transitions and evidence, [Professional Behavior](../../skills/professional-behavior/SKILL.md)
owns decisions and question content. How an injected instruction interacts with
a gate is stated in
[Injected Instructions and Gates](../../skills/loop-engineering/references/phase-progression.md#injected-instructions-and-gates).
[Amp Execution](./amp-execution.md) is the counterpart for Amp; neither file's
tool names carry over to the other host.

**Codex reads this file too, for the instruments it shares.** A Codex session
takes the same portable contracts and the same repository gates, and this file
notes Codex's own tool name wherever it is the one that differs. Where a
section names a Claude Code tool with no Codex note beside it, that instrument
has not been established for Codex: qualify it from the actual session and
report the missing capability rather than calling a Claude Code tool by name.

Check the tools and invocation conditions in the active session. Availability
depends on host version, configuration and whether the session runs locally or
in the cloud. If a required capability is missing, report the unmet gate.

## Scope the conduct baseline in inherited instructions

Claude Code [loads project and user instructions for custom subagents](https://code.claude.com/docs/en/sub-agents).
A user-level mandate to load a skill at the start of every session can therefore
reintroduce the load that a project scoped to top-level work. An adopter can
use this wording in its personal `CLAUDE.md`:

> In top-level work, load the professional conduct baseline first. For delegated
> work, follow the scoped project entry and the assigned role. If its conduct
> guidance is insufficient, load the conduct skill and its applicable references.
> Reassess when the assignment changes.

The project's [entry](../../AGENTS.md#response-approach) owns local role and
skill routing. Give a plan reviewer the frozen plan and original request with
the complete [plan requirements](../../skills/loop-engineering/references/plan-document.md)
and [deliverable-review criteria](../../skills/professional-behavior/references/reviewing-deliverables.md).
Assess the plan against both in its fresh review context. A worker producing the plan acquires the applicable conduct
body and references before its result is relied on. Reuse a complete current
text retained in that worker's own context. A parent's retrieval, a summary, or
a skill name in the catalog does not establish that the worker has the text.

## Ask the human through the question tool

[Choosing the Route](../../skills/professional-behavior/references/asking-the-human.md#choosing-the-route)
owns the rules — which decisions reach the human, how they are framed, when
prose is the route, and what to do with a prompt that closed or errored. This
section supplies only the instrument that carries them.

Claude Code's dedicated question mechanism is **`AskUserQuestion`**. It renders
the options as a selectable choice and returns the answer inline, so the run
continues in the same turn.

For Codex, inspect the session contract for **`request_user_input`**. Establish
which modes expose it and how it handles an unanswered prompt before relying
on it to wait for a decision.

- Judge availability from the session's actual tool list. Do not conclude the
  mechanism is absent because the session is headless, remote, or cloud-hosted.
  A transient permission-stream closure and a genuinely unattended run return
  the same error, which is why the rule on re-presenting keys on the error
  rather than on a guess about the environment.
- Where `AskUserQuestion` is genuinely absent, the turn output is the route.
  This guide names no Claude Code channel more interruptive than it, so the
  reference's preference for one has nothing to select here — a session that
  finds such a channel establishes it from its own tool surface.
- Establish that an answer came from the human before acting on it. A prompt
  that resolved without a human-authored answer — timed out, auto-dismissed,
  cancelled — is unanswered, and re-presenting it is what the rule requires;
  treating it as an answer is the fabrication
  [Asking the Human](../../skills/professional-behavior/references/asking-the-human.md)
  forbids outright.
- The plan-approval gate is not one of these. It is a whole plan the human reads
  at their own pace, so it ends the turn and waits for a resume.
- `EnterPlanMode` and `ExitPlanMode` write a local plan file. Neither satisfies
  the plan-approval gate, because the artifact the human approves is the plan
  recorded in the tracking issue. Codex's equivalent local plan mode, where its
  session exposes one, does not satisfy it either.

## Wait for CI and post-push review

[Waiting Bound](../../skills/loop-engineering/references/post-push-review.md#waiting-bound)
owns the rules: use a subscription route when one exists, schedule a check-in
only when none does and the human explicitly permitted it, re-read state on
every wake, end the turn as "pending" when nothing else is pending, and
unsubscribe in the same turn at each of its three stops. This section says
which subscription routes exist here and how each is ended, and states none of
those rules again.

Resolve the subscription route **before waiting**. Two routes exist in Claude
Code:

| Subscription route                               | What it gives                                                        | What it misses                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Pull-request activity delivered into the session | Review comments and failing checks, at no cost while nothing happens | The _success_ transitions — checks going green, a push landing, a conflict clearing — arrive late or not at all |
| A delegated worker's completion notification     | The worker's result, when it finishes                                | Anything the worker does not report                                                                             |

`subscribe_pr_activity` opens the first route and `unsubscribe_pr_activity`
ends it; both are allowed in
[`.claude/settings.local-example.json`](../../.claude/settings.local-example.json).
Because the first route can miss a success transition, the reference requires a
re-read of check, review and mergeability state on every wake, and an
end-of-turn "pending" report when nothing else is pending.

End a pull-request activity subscription through the tool that opened it, in the
same turn as the stop. Where the session provides no subscription route, end the
turn and report the result as pending. A scheduled check-in is the exception for
that case alone: arm it, with the human's explicit permission, through whichever
scheduling tool the session provides, and cancel it through that tool at the
stop. Neither a waiting bound, a review request, a grant nor the presence of a
scheduler supplies that permission.

If injected GitHub-integration guidance asks a session to subscribe, or to keep
re-arming a check-in, until a pull request merges or closes, subscribing is
still the right route while the run waits, but the instruction does not extend
the run past ready, the round cap or the waiting bound. Unsubscribe at that
stop and report the until-merge condition as unmet, as
[Injected Instructions and Gates](../../skills/loop-engineering/references/phase-progression.md#injected-instructions-and-gates)
states.

## Choose the working location before touching files

[Writing and Recovery](../../skills/loop-engineering/references/writer-ownership-and-recovery.md)
requires the actual workspace identity to be established before writing, and
leaves the arrangement to project policy and the assignment. This is that
policy for Claude Code.

- In a cloud session the checkout is already isolated and ephemeral, so
  implement directly in it.
- **In a local session sharing the maintainer's own working tree, implement on a
  separate `git worktree`** — unless the maintainer explicitly asked for the
  current checkout. Implementing in place moves the maintainer's checkout onto
  the run's branch and blocks their copy for as long as the run holds it, which
  is the cost this rule exists to avoid. `EnterWorktree` and `ExitWorktree`
  manage one where the session exposes them; `git worktree add` is equivalent
  and needs no tool.
- Either way, work on a branch outside the default branch. `claude/` is the
  namespace [the branch-governance sweep](./development-workflow.md#the-branch-governance-sweep)
  observes; a namespace never authorizes a push.
- Remove the worktree only once its branch is pushed and its work is accounted
  for. A worktree deleted with unpushed commits destroys the evidence the
  append-only recovery rules depend on.
- After the change merges or closes, Loop's
  [Release a Finished Change](../../skills/loop-engineering/references/phase-progression.md#release-a-finished-change)
  decides whether the worktree goes. Inspect the active `ExitWorktree`
  contract before proposing cleanup. Check its same-session requirement,
  who can request removal, whether it also deletes the branch, and what it
  does with commits missing from the original branch after a squash merge.

  - A worktree `EnterWorktree` created, in this session or an earlier one, is
    host-owned: keep it and its branch, and report them as removable.
  - A worktree the run made with `git worktree add` is removed with git under
    the release conditions.
  - Neither case discards changes or forces a removal.

## Route a read, and task an investigator

Applicable host guidance owns general read routing. Loop retains
[assignment and material-fidelity contracts](../../skills/loop-engineering/references/implementation-package.md),
not an Investigator route. This section supplies Claude Code's configured
actors; none of them is an Amp mapping or an established Codex capability:

- [`.claude/agents/investigator.md`](../../.claude/agents/investigator.md) remains the configured reader for a bounded
  investigation question, invoked through the `Agent` tool as
  `subagent_type: investigator`. Its definition owns the investigation's
  return shape and denies editing tools and nested
  spawning, and states the rest of its boundary in prose; a general-purpose
  shell remains, because reading requires one.
- An Investigator assignment MUST NOT impose an arbitrary read budget, token
  cap, or tool-call cap. Require as much reading as settling the question takes
  within actual host limits, or an explicit unresolved result. A concise return
  shape does not justify limiting the investigation's reads.
- A built-in read-only search agent covers a broad fan-out across many files or
  naming conventions where no project definition is needed.
- Direct tools supply exact lookups or bounded extracts through an
  offset-and-limit read, field selection, or bounded grep.
- The configured actor is not required for an exact lookup the parent can make in
  one call, and is unavailable where the session exposes no eligible `Agent`
  route. Use the permitted direct read for that question instead; unavailability
  for that assignment does not skip a Loop review checkpoint.

## Read the delegation determination

The session's actual instruction sources and priorities, together with its tool
usage conditions, determine whether a proposed spawn is permitted.
[Run State and Reporting](../../skills/loop-engineering/references/run-state-and-reporting.md)
requires the determination and its grounds to be recorded. What is observable
here:

- Whether the `Agent` tool appears in the session's own tool list, and which
  `subagent_type` values it accepts. An absent tool is a missing capability,
  reported as `unavailable`.
- What the session's own instructions say about spawning, quoted rather than
  paraphrased, with their actual source and priority and the applicable tool
  usage conditions.
- Whether a question was ever put to the maintainer, and the answer if one was.

## Classify a spawned role's model and effort

[Run State and Reporting](../../skills/loop-engineering/references/run-state-and-reporting.md)
requires every spawned role's model and effort to be classified `verified`,
`declared`, or `unknown`, and forbids reporting a declared value as verified.
In Claude Code:

| Source                                                           | Certainty  |
| ---------------------------------------------------------------- | ---------- |
| A runtime, transcript, or telemetry reading of what actually ran | `verified` |
| An agent definition's `model:` and `effort:` frontmatter         | `declared` |
| A `model` argument passed at spawn time, with no runtime reading | `declared` |
| Nothing the session exposes                                      | `unknown`  |

`.claude/agents/implementer.md`, `reviewer.md`, and `investigator.md` each pin
`model:` and `effort:`, so a spawn that does not override them reads `declared`
from that frontmatter. The override mechanism here is the `Agent` tool's own
`model` argument, which is what the reference's rule on a discarded pin applies
to.
See [Development Workflow](./development-workflow.md#configured-actors) for
the configured actor roles and assignment boundaries.

## Keep host operations separate

[Agent Sessions](./agent-sessions.md) owns startup, the opt-in quality hooks,
and telemetry tagging. [Agent Skills](./agent-skills.md) owns installing and
refreshing a skill and confirming discovery. [GitHub Delivery](./github-delivery.md)
owns where plan and state records live, and
[Code Review](./code-review.md) owns the configured reviewer and its
invocation. This file changes none of them, and names no instrument that
substitutes for post-push review.
