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

[`2026-08-20-pin-the-investigator-at-sonnet-medium-and-step-implementer-and-reviewer-to-high.md`](../decisions/2026-08-20-pin-the-investigator-at-sonnet-medium-and-step-implementer-and-reviewer-to-high.md)
is the decision behind every model and effort value pinned across this
section and the ones below it: the vendor comparison the investigator's
shape rests on, and why this file and `reviewer.md` moving off `xhigh` is
the maintainer's judgment rather than a measured one.

## The Pre-Flight Review

`.claude/agents/reviewer.md` denies two things — editing, and spawning another
agent — and nothing else. The obvious move is to give a reviewer a short list
of permitted tools, since its job sounds narrow. It is not: judging a change
means confirming what was asked and not only what was written, which reaches
the issue, any artifact the plan points at, and the documentation behind a
factual claim. A reviewer missing one of those does not fail to start; it
runs, cannot check what it cannot reach, and returns a report short by exactly
those checks — and an under-equipped review reads exactly like a clean one.
So the asymmetry sits between the writer and its readers rather than between
two named files: the things `implementer.md`, the writer, must never do are
few and nameable, and it asks them in prose rather than closing them with a
withdrawn tool; the things a reader needs are open-ended, which is why both
readers — `reviewer.md` and `investigator.md` alike — still enforce their own
short deny-list with tools instead. Neither restriction is complete, and the
file says so — `Bash` remains, so mutation is enforced against the editing
tools and not against the shell, and reporting rather than publishing stays a
rule it is asked to honor. Delete this file and the stage is skipped rather
than performed by the main actor, which is what keeps it from degrading into
self-review.

## The Investigator

`.claude/agents/investigator.md` pins `model: sonnet` with `effort: medium`,
for the role
[context-ownership.md](../../skills/loop-engineering/references/context-ownership.md)
defines: a reader handed a large payload and asked to return a conclusion and
a locator rather than the payload itself. The 1M-token context window is what
bounds how large a payload the role can actually be handed — the one
dimension a role defined by being handed large payloads cannot trade away for
a cheaper model — which is why the file pins it over a model with a smaller
window. `medium` rather than `low` follows from the same reason the role is
delegated at all: the main actor cannot audit a conclusion's quality without
re-reading the payload that delegating was meant to keep out of its own
context, so the effort spent reaching that conclusion is not where this
repository looked to save. Like `reviewer.md`, it denies mutation and
spawning another agent with `disallowedTools` — `Edit`, `Write`,
`NotebookEdit`, `Agent` — and states the rest of the boundary in its own body
rather than closing it with a withdrawn tool: a general-purpose shell
remains, because reading requires one, so mutation is enforced against the
editing tools and not against the shell, and returning only the answer
rather than acting further on what it finds stays a rule it is asked to
honor. It carries nothing else: the decision boundary, the escalation list, the
verification obligation, and the return shape for one particular run all
arrive per run in the task, so a definition restating them would only drift
from it. It does not mention the loop at all, for the same reason
`implementer.md` does not — the same file works for a caller that has never
heard of `loop-engineering`. Delete the file and resolution falls back **per
read** rather than as a whole stage entered or skipped: each large payload the
main actor would have sent to an investigator is instead read directly into
its own context, one read at a time — unlike deleting `reviewer.md`, which
skips a stage rather than narrowing per read.

[Directory Structure](../conventions/directory-structure.md) covers why
`.claude/agents/` is the only home for an agent definition.

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
