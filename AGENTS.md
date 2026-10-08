# AGENTS.md

## Project overview

**skills** is a distributable agent-skills library, written in Markdown with
JavaScript tooling. [README.md](./README.md) owns its commands and catalog;
[docs/index.md](./docs/index.md) indexes project conventions and operations.
Claude Code, Codex, and Amp use the same capability sources, not separate
host-specific skill libraries.

## Response Approach

For scoped authorization, see
[Loop Engineering](./skills/loop-engineering/SKILL.md). Apply this agreement
within the active host's actual instruction hierarchy and tool usage conditions.
Host entry guidance explains that application; it cannot redefine instruction
priority. Report any project gate that cannot be satisfied within those
boundaries. [Skill Portability](./docs/conventions/skill-portability.md#what-a-skill-deliberately-does-not-carry)
records this boundary and the unresolved local entry conflict. Load capabilities
by task rather than importing every change gate into read-only work:

- MUST load [Professional Behavior](./skills/professional-behavior/SKILL.md)
  first in every session, including read-only questions and investigations.
- MUST load [Software Development](./skills/software-development/SKILL.md)
  when a task touches the project.
- MUST load [Loop Engineering](./skills/loop-engineering/SKILL.md) before
  planning or making any code or document change, then follow
  [Development Workflow](./docs/operations/development-workflow.md) for this
  repository's required gates. Read-only work stays outside the change loop.
- MUST load each matching skill's body, not act from its discovery description
  alone. Domain skills govern their subject, not host tool selection.
- MUST read [README.md](./README.md#commands) before repository commands.
  Software Development owns the procedure when a command is undocumented.
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

## Routing a Change

Use these task-specific owners rather than duplicating their detailed rules:

| Task                                                  | Project document                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Skill layout, tiers, validators, evaluation layout    | [Directory Structure](./docs/conventions/directory-structure.md)                                                       |
| Gates, reporting tools, scheduled audits              | [Verification Gates](./docs/conventions/verification-gates.md)                                                         |
| Numbers stated in prose                               | [Marked Counts](./docs/conventions/marked-counts.md)                                                                   |
| Distributable content or dependency-governed surfaces | [Skill Portability](./docs/conventions/skill-portability.md) — MUST read before changing a dependency-governed surface |
| Placement of a settled decision                       | [Decision Placement](./docs/conventions/decision-placement.md)                                                         |
| Combined migration, ownership, rollout and recovery   | [Loop Migration](./docs/operations/loop-migration.md)                                                                  |
| Evaluation dispatch                                   | [Evaluation Dispatch](./docs/operations/evaluation-dispatch.md)                                                        |
| What skill evaluation measures                        | [Skill Evaluation](./docs/specs/skill-evaluation.md)                                                                   |
