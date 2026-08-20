# Development Workflow

How a change gets from a stated intent to a merged pull request in this
repository, and how the loop that drives it is wired here specifically.
[loop-engineering](../../skills/loop-engineering/SKILL.md) owns the change
loop itself — its stages, where it stops, and what it caps; this document
covers only what nothing outside this repository could know: which agent
definitions carry out which stage, and the sweep that backs the loop from
outside any one session.

## The Change Loop

Development here is agent-assisted via Claude Code. The working agreement
lives in `CLAUDE.md` and routes to the detailed skills under `skills/`. Every
change goes through the same loop — **plan → approve → code → verify →
independent review → address → ready** — and `loop-engineering` runs
**model-invoked**: there is no slash command. Name the work and it drives that
work to a merge-ready pull request in one continuing session, stopping
wherever a decision is a human's to make.

## Kicking It Off

Kick it off by naming what to deliver — "deliver issue #42", "pick up PR 57",
or a description of the change with no issue behind it yet. To carry on after
it stops, continue the session and tell it to.

## Implementation Runs in a Subagent

`.claude/agents/implementer.md` pins a lower-cost model and effort — a
secondary benefit of delegating rather than the reason for it, which
[`subagent-delegation.md`](../../skills/loop-engineering/references/subagent-delegation.md#why-the-loop-delegates)
states as context separation: a worker that inherited the session's own model
would still run at the main actor's cost, forfeiting that secondary saving
without anything reporting it. It also states the delivery boundary in its
own body rather than closing it by withdrawing a tool: commits stay local, and
pushing, publishing, and anything else that speaks outward belongs to whoever
asked, a rule the file asks the worker to honor rather than one the host
enforces. It carries nothing else: the decision boundary, the verification
obligation, the commit rules, and the receipt shape all arrive per run in the
task package, so a definition restating them would only drift from it. It does
not mention the loop at all, which is the point — it says what an
implementation agent is and what it may not decide, so the same file works for
a caller that has never heard of `loop-engineering` and is worth copying into
a project that runs its subagents some other way. What it leaves out, and why,
is explained host-neutrally in
[`subagent-delegation.md`](../../skills/loop-engineering/references/subagent-delegation.md#defining-an-agent-of-your-own).
Delete the file and the loop keeps delegating — to a generic
implementation-capable agent at the session's inherited model — rather than
returning to single-agent execution, with no gate weakened. Single-agent
execution is what a host exposing no capable agent at all produces.

## The Pre-Flight Review

`.claude/agents/reviewer.md` denies two things — editing, and spawning another
agent — and nothing else. The obvious move is to give a reviewer a short list
of permitted tools, since its job sounds narrow. It is not: judging a change
means confirming what was asked and not only what was written, which reaches
the issue, any artifact the plan points at, and the documentation behind a
factual claim. A reviewer missing one of those does not fail to start; it
runs, cannot check what it cannot reach, and returns a report short by exactly
those checks — and an under-equipped review reads exactly like a clean one.
So the asymmetry between the two agent definitions sits in both what each
denies and how: the things `implementer.md` must never do are few and
nameable, and it asks them in prose rather than closing them with a withdrawn
tool; the things a reader needs are open-ended, which is why `reviewer.md`
still enforces its own short deny-list with tools instead. Neither restriction
is complete, and the file says so — `Bash` remains, so mutation is enforced
against the editing tools and not against the shell, and reporting rather than
publishing stays a rule it is asked to honor. Delete this file and the stage
is skipped rather than performed by the main actor, which is what keeps it
from degrading into self-review.

[Directory Structure](../conventions/directory-structure.md) covers why
`.claude/agents/` is the only home for either file.

## Working Without an Agent

Working without an agent does not lower the bar: branch, implement, run the
checks in [`README.md`'s commands table](../../README.md), open a pull request
following [the template](../../.github/pull_request_template.md), and get it
reviewed before merge.

## The Branch-Governance Sweep

One check backs the loop from outside any session:
[`branch-governance-audit.yaml`](../../.github/workflows/branch-governance-audit.yaml)
sweeps hourly and flags any `claude/` branch pushed ahead of the default
branch with no open pull request — work delivered outside the loop, and so
never independently reviewed. It is deliberately a scheduled sweep rather than
a push-triggered gate, because implementation legitimately pushes before the
pull request opens; a grace window skips a branch whose latest commit is
still fresh.
