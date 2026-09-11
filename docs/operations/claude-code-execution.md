# Claude Code Execution

Maintainers running this repository in Claude Code use this reference to pick
the instrument for a step whose _meaning_ another owner already fixed. It maps
the portable contracts onto Claude Code operations; it grants no tool access and
replaces no tool definition. [Development Workflow](./development-workflow.md)
owns this repository's gates, [Loop Engineering](../../skills/loop-engineering/SKILL.md)
owns transitions and evidence, [Professional Behavior](../../skills/professional-behavior/SKILL.md)
owns decisions and question content, and [CLAUDE.md](../../CLAUDE.md) owns what
happens when an injected prompt disagrees with those gates.
[Amp Execution](./amp-execution.md) is the counterpart for Amp; neither file's
tool names carry over to the other host.

The names below were checked on 2026-09-11 against a Claude Code session's own
tool surface in this repository. A session MUST recheck its actual tools and
their conditions before relying on any of them: the surface differs by host
version, by local and cloud environment, and by configuration, and a name
appearing here is not a promise that this session exposes it. Where the
instrument this file names is absent, the portable contract still holds — report
the missing capability rather than substituting a mechanism the contract forbids.

## Ask the human through the question tool

[Asking the Human](../../skills/professional-behavior/references/asking-the-human.md)
owns which decisions reach the human, how they are framed, and the rule that a
decision written into prose was never asked. This section supplies only the
instrument.

Claude Code's dedicated question mechanism is **`AskUserQuestion`**. It renders
the options as a selectable choice and returns the answer inline, so the run
continues in the same turn. It is the default route for a decision with options,
not a fallback reached after some other channel failed.

- Judge its availability from the session's actual tool list. Do not conclude it
  is absent because the session is headless, remote, or cloud-hosted.
- On a closed, cancelled, or errored prompt, show the decision in plain text —
  background, the question, the numbered options, the recommended default — then
  call `AskUserQuestion` again with the same options in the same order and hold
  for the answer. A transient permission-stream closure and a genuinely
  unattended run return the same error, so the error alone does not distinguish
  them.
- The plan-approval gate is not one of these. It is a whole plan the human reads
  at their own pace, so it ends the turn and waits for a resume.
- `EnterPlanMode` and `ExitPlanMode` write a local plan file. Neither satisfies
  the plan-approval gate, because the artifact the human approves is the plan
  recorded in the tracking issue.

## Wait for CI and the independent review

[Independent Review and Readiness](../../skills/loop-engineering/references/independent-review.md)
owns the waiting bound, the ready gate, and the rule that a human wait is never
polled. This section supplies the instrument and the teardown.

Two mechanisms can report that a machine event finished, and they are not
interchangeable. Resolve which of them this session actually has **before the
first wake**:

| Mechanism                                        | What it gives                                                        | What it misses                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Pull-request activity delivered into the session | Review comments and failing checks, at no cost while nothing happens | The _success_ transitions — checks going green, a push landing, a conflict clearing — arrive late or not at all |
| A scheduled self-wake back into the same session | A wake at a time this run chooses, surviving container reclaim       | Nothing; it is the backstop, and the whole mechanism where no activity delivery exists                          |

Because green checks are one of the ready-gate conditions, delivery alone can
leave a finished change waiting indefinitely. Keep a self-wake scheduled
wherever the session provides one, even while activity delivery is active, and
record in the run state when only delivery is available — a success transition
missed there strands the run rather than merely delaying it.

- Derive each wake from the checks still pending rather than from a fixed ladder:
  place the first just past where the fastest pending check should already have
  decided, then step across the slowest pending check's typical-to-maximum band,
  then treat a check still pending beyond that band as anomalous rather than as
  more of the same wait. Measure that band from this project's own recent runs.
- Prefer one wake timed at the expected resolution over several short polls. A
  run that checks repeatedly across a long wait pays to rebuild its context each
  time and learns nothing sooner.
- Where the session provides neither mechanism, end the turn and wait for the
  human rather than blocking.
- **Tear down whatever was armed, in the same turn as the stop.** Cancel the
  scheduled self-wake and end the activity subscription at each of the three
  stops: the ready transition, non-convergence at the round cap, and the waiting
  bound. This holds with no exception, including where follow-up work on the same
  change is already anticipated. A mechanism left armed past the tail wakes the
  session for every unrelated event that still fires — a base-branch push, a bot
  comment, a check re-run — and buys nothing toward what comes next.
- Never arm either mechanism to catch a human's comment on a pull request the
  tail has already finished with. Such a comment reaches the run through the
  human's own resume.

Scheduling tools are for this tail. Do not read a waiting bound, a review
request, or the existence of a scheduler as authorization to create a recurring
schedule; that needs the human's own request.

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

[Read Routing and the Investigator Return Contract](../../skills/loop-engineering/references/subagent-delegation.md#read-routing)
own which reads leave the parent's context and what an investigation returns.
This section names the actors.

- `.claude/agents/investigator.md` is the configured reader for a bounded
  investigation question, invoked through the `Agent` tool as
  `subagent_type: investigator`. Its definition denies editing and nested
  spawning, and states the rest of its boundary in prose; a general-purpose
  shell remains, because reading requires one.
- A built-in read-only search agent covers a broad fan-out across many files or
  naming conventions where no project definition is needed.
- Narrow at the tool call, rather than delegating, when fidelity is the
  requirement and only part of a payload is wanted: an offset-and-limit read, a
  field selection on a structured response, a bounded grep.
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
  Recording "no question was put" is a determination; recording a decline the
  maintainer never made is not.

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
`model:` and `effort:`, so a spawn that does not override them has a `declared`
value. A `model` argument passed at spawn time **discards** the definition's pin,
so the definition's value is not even `declared` for that run — record the
override and its reason, and never report the pinned value as what ran.
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
