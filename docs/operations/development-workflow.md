# Development Workflow

How a maintainer carries a change through this repository's required gates.
[Loop Engineering](../../skills/loop-engineering/SKILL.md) owns phase meaning
and evidence contracts; this document records the repository's choices and
the configured actors. Host instructions and tool usage conditions govern
execution, not the names of those actors.

## The Change Loop

Every change MUST retain the repository's issue, recorded plan, human plan
approval, verified implementation, draft pull request, independent review,
addressing, and ready gates. A read-only question, investigation, or review
does not enter them. Name an issue, a pull request, or a free-form change to
start; resume at the recorded pending phase rather than starting again.

The source skill now separates those gates from orchestration. The
[migration map](./loop-migration.md) records the baseline and all moved topics;
[Amp execution](./amp-execution.md) maps assignments to the current permitted
host tools. Combined entry integration remains separate work; the guide alone
does not establish whole-host compatibility.
The rationale replaces the old standing-mandate interpretation in
[the authority decision](../decisions/2026-09-07-separate-loop-contracts-from-host-authority.md).

## Configured Actors

The Claude Code definitions remain under `.claude/agents/`:

- `implementer.md` supplies the implementation-capable actor and its declared
  model and effort. Local results return to the parent; publication is not
  delegated merely by choosing this actor.
- `reviewer.md` supplies the advisory pre-flight reader. Its tool denial
  covers editing tools and nested spawning, not every possible shell write.
- `investigator.md` supplies a reader for bounded investigation questions.
  It is not required for an exact local lookup or when the host prohibits
  that delegation purpose.

The pinning rationale remains in
[the model decision](../decisions/2026-08-20-pin-the-investigator-at-sonnet-medium-and-step-implementer-and-reviewer-to-high.md).
These are configured candidates, not a portable ranking or permission grant.
A session MUST check actual permitted capabilities before using one. Parent
implementation is valid when delegation is inappropriate or unavailable;
mandatory verification and external review remain unchanged.

The project's advisory review still applies after delegated implementation
when a compatible reader is permitted. Its findings and round limits follow
[the pre-flight contract](../../skills/loop-engineering/references/pre-flight-review.md).
If a host does not permit that reader, record the skipped advisory stage rather
than relabeling parent self-review or waiving the external review.

## GitHub Delivery During Migration

Until the dedicated delivery integration is adopted, this repository retains
its existing representation: a first-element `<!-- loop-engineering` HTML
comment ending with `-->` in the issue before a PR exists, then in the PR.
It carries the phase, approved revision and approval evidence, review round,
waiting state, open question, execution status and durable recovery information
defined by [the state contract](../../skills/loop-engineering/references/run-state-and-reporting.md).
Ephemeral worker handles stay in the session. A stale issue-side block is not
the authoritative state after a PR exists.

Body reads and writes MUST follow
[GitHub Operation](../../skills/github-operation/SKILL.md)'s fidelity rules.
Read the full stored body before replacing it; a sanitized or narrowed read
cannot reconstruct omitted content. New comments begin with `<!-- ai-agent -->`.
Plan activity targets the issue; review replies target the PR's finding thread.
Keep status in the block and the conversation, not separate attention comments.
Preserve the original issue description inline or in a marked archival comment.

Use [the PR template](../../.github/pull_request_template.md), link the issue,
keep the PR draft, and follow [Code Review](./code-review.md) for the independent
review trigger. The trigger occurs only in its dedicated marked comment.
Resolution replies identify the fixing commit with `Resolved in <short-hash>`
and normally one sentence, then resolve the corresponding thread. These
repository conventions are not required storage or text formats for consumers
of the portable skill.

## Working Without an Agent

Working without an agent does not lower the bar: branch, implement, run
[README's checks](../../README.md#commands), open a pull request following the
template, and obtain review before merge. Agents likewise MUST use a branch
outside the default branch, preserve pushed history, and leave merging to the
human. `claude/` is the namespace observed by the sweep below; a namespace
never authorizes a push.

## The Branch-Governance Sweep

[`branch-governance-audit.yaml`](../../.github/workflows/branch-governance-audit.yaml)
sweeps hourly and flags a `claude/` branch ahead of the default branch with no
open pull request. It is scheduled rather than push-triggered because
implementation legitimately pushes before opening its pull request; a grace
window skips a branch whose latest commit is still fresh.
