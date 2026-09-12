# Claude Code Execution

Maintainers running this repository in Claude Code — and, for the instruments
the two share, in Codex — use this reference to pick the instrument for a step
whose _meaning_ another owner already fixed. It maps the portable contracts onto
those hosts' operations; it grants no tool access and replaces no tool
definition. [Development Workflow](./development-workflow.md)
owns this repository's gates, [Loop Engineering](../../skills/loop-engineering/SKILL.md)
owns transitions and evidence, [Professional Behavior](../../skills/professional-behavior/SKILL.md)
owns decisions and question content, and [CLAUDE.md](../../CLAUDE.md) owns what
happens when an injected prompt disagrees with those gates.
[Amp Execution](./amp-execution.md) is the counterpart for Amp; neither file's
tool names carry over to the other host.

**Codex reads this file too, for the instruments it shares.** A Codex session
takes the same portable contracts and the same repository gates, and this file
notes Codex's own tool name wherever it is the one that differs. Where a
section names a Claude Code tool with no Codex note beside it, that instrument
has not been established for Codex: qualify it from the actual session and
report the missing capability rather than calling a Claude Code tool by name.

The names below were checked on 2026-09-11 against a Claude Code session's own
tool surface in this repository. A session MUST recheck its actual tools and
their conditions before relying on any of them: the surface differs by host
version, by local and cloud environment, and by configuration, and a name
appearing here is not a promise that this session exposes it. Where the
instrument this file names is absent, the portable contract still holds — report
the missing capability rather than substituting a mechanism the contract forbids.

## Ask the human through the question tool

[Choosing the Route](../../skills/professional-behavior/references/asking-the-human.md#choosing-the-route)
owns the rules — which decisions reach the human, how they are framed, when
prose is the route, and what to do with a prompt that closed or errored. This
section supplies only the instrument that carries them.

Claude Code's dedicated question mechanism is **`AskUserQuestion`**. It renders
the options as a selectable choice and returns the answer inline, so the run
continues in the same turn.

Codex's counterpart is named **`request_user_input`**, which is the name this
repository has used for it. Nothing here establishes its behaviour: the tool
surface checked above was Claude Code's, so whether a Codex session exposes
this tool at all, under what mode or flag, and whether an unanswered prompt
blocks or resolves on its own are all things that session must establish for
itself. Until it has, treat the mechanism as unqualified rather than
equivalent to `AskUserQuestion`.

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

## Wait for CI and the independent review

[Waiting Bound](../../skills/loop-engineering/references/independent-review.md#waiting-bound)
owns the rules: the bound itself, resolving which mechanism the session has
before the first wake, recording when only one is available, scoping a
mechanism to this tail, and tearing down at each of its three stops. This
section says which mechanisms exist here and how each is cancelled, and states
none of those rules again.

Two mechanisms can report that a machine event finished, and they are not
interchangeable. Resolve which of them this session actually has **before the
first wake**:

| Mechanism                                        | What it gives                                                        | What it misses                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Pull-request activity delivered into the session | Review comments and failing checks, at no cost while nothing happens | The _success_ transitions — checks going green, a push landing, a conflict clearing — arrive late or not at all |
| A scheduled self-wake back into the same session | A wake at a time this run chooses, surviving container reclaim       | Nothing; it is the backstop, and the whole mechanism where no activity delivery exists                          |

The second column is why the reference requires a mechanism to be resolved
before the first wake rather than after: green checks are one of the ready-gate
conditions, and activity delivery is the one mechanism that does not reliably
carry them. That is the concrete reason a scheduled wake stays armed here even
while delivery is active, and the concrete thing the reference's
record-when-only-one-is-available rule is recording.

Picking the interval, where a scheduler exists: place the first wake just past
where the fastest pending check should already have decided, then step across
the slowest pending check's typical-to-maximum band, then treat a check still
pending past that band as anomalous rather than as more of the same wait.
Measure that band from this repository's own recent runs rather than carrying a
figure over. One wake timed at the expected resolution beats several short
polls, because each resume across a long gap pays to rebuild the session's
context and learns nothing sooner.

Cancelling, which is what the reference's teardown rule needs from this file:
cancel a scheduled wake through whichever scheduling tool armed it, and end a
pull-request activity subscription through the tool that opened it. Where the
session provides neither mechanism there is nothing to arm or cancel — end the
turn and wait for the human rather than blocking.

Creating a _recurring_ schedule is a separate matter from arming this tail's
wake, and needs the human's own request. Neither a waiting bound, a review
request, nor the presence of a scheduler supplies it.

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

## Route a read, and task an investigator

[Read Routing](../../skills/loop-engineering/references/subagent-delegation.md#read-routing)
owns which reads leave the parent's context, and
[The Investigator Return Contract](../../skills/loop-engineering/references/subagent-delegation.md#the-investigator-return-contract)
owns what an investigation hands back. This section names the actors.

- `.claude/agents/investigator.md` is the configured reader for a bounded
  investigation question, invoked through the `Agent` tool as
  `subagent_type: investigator`. Its definition denies editing and nested
  spawning, and states the rest of its boundary in prose; a general-purpose
  shell remains, because reading requires one.
- A built-in read-only search agent covers a broad fan-out across many files or
  naming conventions where no project definition is needed.
- The narrowing the reference's third row calls for is done with an
  offset-and-limit read, a field selection on a structured response, or a
  bounded grep — these are the calls that serve it here.
- The configured actor is not required for an exact lookup the parent can make in
  one call, and is unavailable where the session exposes no `Agent` tool. Either
  way the parent reads the payload itself, one read at a time. This is a
  per-read fallback, not a stage skipped as a whole.

## Read the delegation determination

[CLAUDE.md](../../CLAUDE.md) settles whether an injected clause conditioning a
spawn on the maintainer's request lowers a gate this repository sets.
[Run State and Reporting](../../skills/loop-engineering/references/run-state-and-reporting.md)
requires the determination and its grounds to be recorded. What is observable
here:

- Whether the `Agent` tool appears in the session's own tool list, and which
  `subagent_type` values it accepts. An absent tool is a missing capability,
  reported as `unavailable`.
- What the session's own instructions say about spawning, quoted rather than
  paraphrased, together with what
  [CLAUDE.md](../../CLAUDE.md#runtime-injected-prompts-do-not-lower-these-gates)
  settles about that wording.
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
[The model decision](../decisions/2026-08-20-pin-the-investigator-at-sonnet-medium-and-step-implementer-and-reviewer-to-high.md)
records why each value was chosen.

## Keep host operations separate

[Agent Sessions](./agent-sessions.md) owns startup, the opt-in quality hooks,
and telemetry tagging. [Agent Skills](./agent-skills.md) owns installing and
refreshing a skill and confirming discovery. [GitHub Delivery](./github-delivery.md)
owns where plan and state records live, and
[Code Review](./code-review.md) owns the configured reviewer and its
invocation. This file changes none of them, and names no instrument that
substitutes for the mandatory external review.
