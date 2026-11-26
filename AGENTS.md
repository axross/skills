# AGENTS.md

## Project overview

**skills** is a distributable agent-skills library, written in Markdown with
JavaScript tooling. [README.md](./README.md) owns its catalog and links
[Development Setup](./docs/operations/development-setup.md) for its commands;
[docs/index.md](./docs/index.md) indexes project conventions and operations.
Claude Code, Codex, and Amp use the same capability sources, not separate
host-specific skill libraries.

## Response Approach

Identify the intended checkout and read its scoped project entry. For top-level
work, load [Professional Behavior](./skills/professional-behavior/SKILL.md)
first, including for standalone read-only questions. Load
[Software Development](./skills/software-development/SKILL.md) for project work,
including delegated implementation.

A delegated locator lookup or ordinary review uses the assigned role's evidence,
limitations and escalation rules. For a standalone review criterion, the brief
may name its complete reference directly. Load the applicable Professional
Behavior body and references when a child produces a conclusion others will
rely on, speaks to the human, drives a change, or lacks sufficient role guidance.
Reassess when the assignment expands. For a decision the child cannot ask,
use [Asking the Human](./skills/professional-behavior/references/asking-the-human.md)
to return the decision and partial results to the caller.

For a code or documentation change, even when the request names another
skill, an issue, or a continuation, identify the tracking target and load
[Loop Engineering](./skills/loop-engineering/SKILL.md) before drafting a
change plan, assigning change work or editing. In the **first progress
update**, name the phase, tracking issue (or none) and plan approval state.
Report an unknown field as unknown while checking it.

Use [Loop intake](./skills/loop-engineering/references/phase-progression.md#intake-and-defaults)
and [Development Workflow](./docs/operations/development-workflow.md). Before
implementing or assigning implementation, recover the actual target and pending
phase from the tracker, reproduce the canonical plan identity from faithfully
retrieved bytes, and match both identity and requested scope to human approval.
If approval is missing, stop at the approval gate. Added scope on a named
issue goes through planning and approval. Preserve existing edits during
recovery. Resume an unchanged approved plan at its pending phase. For each proposed
effect that requires an [operation grant](./skills/loop-engineering/references/run-state-and-reporting.md#scoped-operation-grants),
verify a current match. A verified standing grant counts within its scope.
Hold an effect with a missing, expired or inapplicable grant and continue
independent permitted work.

Apply these gates within the host's actual instruction hierarchy and tool
conditions. Report the blocked operation and unmet gate when they conflict.

- MUST read [README.md](./README.md) and the
  [Development Setup](./docs/operations/development-setup.md) guide it links
  before repository commands. Software Development owns the procedure when a
  command is undocumented.
- MUST read [docs/index.md](./docs/index.md) when a task depends on project
  terminology, concepts, or past decisions; follow only the relevant routes.

## Host and delivery routing

Select guidance from the actual session, not a directory's host name:

- **Amp:** consult [Amp Execution](./docs/operations/amp-execution.md) before
  choosing execution, delegation, waiting, or recovery tools. Current tool
  contracts determine availability and permitted purposes.
- **Claude Code and Codex:** consult
  [Claude Code Execution](./docs/operations/claude-code-execution.md) before
  choosing a question, waiting, working-tree, delegation, or investigation
  instrument, [Agent Sessions](./docs/operations/agent-sessions.md) for startup
  and host configuration, [Development Workflow](./docs/operations/development-workflow.md)
  for configured actors, and
  [Agent Skills](./docs/operations/agent-skills.md) with
  [Skill Portability](./docs/conventions/skill-portability.md) for the
  symlinked skill root and the metadata each host reads. Qualify capabilities
  in the actual host; do not substitute Amp APIs for another host's operations.
- **GitHub:** load [GitHub Operation](./skills/github-operation/SKILL.md) for
  reads and writes. Consult [GitHub Delivery](./docs/operations/github-delivery.md)
  before plan/state storage or publication, including its comment markers
  before reading or posting agent comments.

## Code Review Rules

For every review, MUST read [REVIEW.md](./REVIEW.md) for the required project
checks and posted-report contract, and load
[Code Review](./skills/code-review/SKILL.md) for methodology. Where their
posted-report instructions differ, REVIEW.md governs. Consult
[Code Review operations](./docs/operations/code-review.md) for the selected
provider's invocation and policy-delivery qualification; routing alone does
not establish provider consumption or compliant output.

## Skill maintenance

For skill changes or loading diagnostics, load
[Agent Skill Management](./skills/agent-skill-management/SKILL.md) and follow
[Agent Skills](./docs/operations/agent-skills.md). For content and metadata
changes, also load [Agent Skill Authoring](./skills/agent-skill-authoring/SKILL.md).
Source, installed copies, symlinks, and active loading have distinct evidence;
their layout belongs to [Directory Structure](./docs/conventions/directory-structure.md).
At completion, MUST report whether skill maintenance was performed, skipped,
or blocked. Development Workflow owns the delivery evidence required alongside
that report.

Skill-acquisition safeguards require separate human authorization and must
preserve normal permissions and recovery reads. Qualify observation and refusal
in independently contained trials using disposable targets; keep unverified
scopes inactive. Observation must not interfere with valid work; refusal must
use actor-local evidence current through mutation, reject incomplete
acquisition, and permit valid work after full acquisition. Bound refusal to
verified scope and duration, with independent expiry or rollback after
interruption. Skill acquisition alone proves neither output correctness nor
permission to mutate.
