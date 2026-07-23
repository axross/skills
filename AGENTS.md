# AGENTS.md

## Requirement Level Keywords

Apply these keywords consistently in this document and the documents linked from this document.

| Keyword      | Synonym           | Meaning                                                                        |
| ------------ | ----------------- | ------------------------------------------------------------------------------ |
| "MUST"       | "REQUIRED"        | Non-negotiable requirement; no exceptions.                                     |
| "MUST NOT"   |                   | Non-negotiable prohibition; no exceptions.                                     |
| "SHOULD"     | "RECOMMENDED"     | Strongly preferred; deviation is allowed only after weighing the implications. |
| "SHOULD NOT" | "NOT RECOMMENDED" | Strongly discouraged; allowed only after weighing the implications.            |
| "MAY"        | "OPTIONAL"        | Genuinely optional; no preference implied.                                     |

## Project Overview

- **skills** is a Claude Code agent-skills library: a curated, reusable collection of agent skills — the working agreement plus guideline and workflow skills that a Claude Code project loads through `CLAUDE.md`.
- Primary language: Markdown (with occasional JavaScript for scripting). Runtime: Claude Code.
- Tooling: npm for packages, markdownlint-cli2 for linting, Prettier for formatting. Relative-link integrity is checked by `.claude/skills/agent-skills-best-practices/scripts/check-links.sh`.
- For run-scripts, current-docs lookup rules, and verification commands, consult [Development Guidelines](.claude/skills/development-guidelines/SKILL.md).
- For how skills are authored, structured, named, and cross-linked, consult [Agent Skills Best Practices](.claude/skills/agent-skills-best-practices/SKILL.md). Skills ship directly under `.claude/skills/`; the `skills/` source directory holds the source of any skills installed into `.claude/skills/` with `npx skills` (currently the `loop-engineering` and `unit-test-guidelines` skills) — see [Skill Installation](.claude/skills/skill-installation/SKILL.md). The index below routes to all of them.

## Skill Index

`AGENTS.md` is the master routing index for the library's skills. Consult the relevant skill before acting on matching work. Keep this index in sync whenever a skill is added, renamed, moved, or removed.

| Skill                                                                                          | When to apply                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Agent Skills Best Practices](.claude/skills/agent-skills-best-practices/SKILL.md)             | Creating, refining, splitting, renaming, deleting, or auditing skills or this skill index                                                                                                                                                                                                                                                                                                                                    |
| [Application Security Requirements](.claude/skills/application-security-requirements/SKILL.md) | Reviewing secrets, environment variables, input validation, injection in rendered content, SSRF/outbound fetching, privacy exposure, or dependency/supply-chain risk                                                                                                                                                                                                                                                         |
| [Code Review Guideline](.claude/skills/code-review-guideline/SKILL.md)                         | Reviewing a diff, pull request, local change, or post-implementation self-review                                                                                                                                                                                                                                                                                                                                             |
| [Development Guidelines](.claude/skills/development-guidelines/SKILL.md)                       | Implementing, refactoring, running commands, preparing commits, writing pull request descriptions, adding dependencies, writing source comments or doc-comments, or checking current docs                                                                                                                                                                                                                                    |
| [GitHub Operation Guidelines](.claude/skills/github-operation-guidelines/SKILL.md)             | Reading from or writing to GitHub — issues, pull requests, comments, labels, reviews, or branches — through a proxied single-operator identity: agent-comment markers, issue-vs-PR targets, commit messages and pull request titles under squash merge, pull request template and description authoring, history preservation (no amend/force-push), untrusted content                                                       |
| [Loop Engineering](.claude/skills/loop-engineering/SKILL.md)                                   | Driving a unit of software work end-to-end through the plan → code → independent-review delivery loop; a self-contained, installable generalization of the `/address` workflow for a project that ships no delivery loop of its own. Within this repository `address` (Workflow Entry Points) is the delivery entry point and this skill defers to it — carried here as an installable source, not a second delivery driver. |
| [Maintainable Code Guidelines](.claude/skills/maintainable-code-guidelines/SKILL.md)           | Reviewing readability, naming, abstraction boundaries, complexity, dead code, or scope discipline                                                                                                                                                                                                                                                                                                                            |
| [Product Requirement Guidelines](.claude/skills/product-requirement-guidelines/SKILL.md)       | Writing, refining, or reviewing a product requirement, feature spec, issue description, or plan document; the canonical plan-document structure and its section craft — summary, background (goals/non-goals/assumptions), functional and non-functional requirements, acceptance criteria, verification strategy, open questions — plus scope framing, testable acceptance criteria, and section omit-rules                 |
| [Quality Assurance Guidelines](.claude/skills/quality-assurance-guidelines/SKILL.md)           | Reviewing verification evidence — lint/format proof, manual checks, skipped checks, and residual risk                                                                                                                                                                                                                                                                                                                        |
| [Skill Installation](.claude/skills/skill-installation/SKILL.md)                               | Installing, refreshing, or removing the `skills/`-sourced skills with the `npx skills` CLI, the committed `.claude/skills/` copies and `skills-lock.json`, and the refresh-and-verify workflow after editing a source skill                                                                                                                                                                                                  |

| [Unit Test Guidelines](.claude/skills/unit-test-guidelines/SKILL.md) | Writing, refactoring, reviewing, or running unit tests across runners such as Jest or Vitest — explicit test-API imports, colocated specs, describe/case naming, behavior-focused design, fixtures/fakes/mocks, async assertions, snapshot discipline, schema/codec tests, type-only modules, the optional coverage gate, and when to yield to integration or e2e coverage |

### Workflow Entry Points

Unlike the guideline skills above, these skills are runnable workflows: a human launches one as `/<name>` (or the agent invokes it when its `when_to_use` matches), so they carry `user-invocable: true` and an `argument-hint` per [Agent Skills Best Practices](.claude/skills/agent-skills-best-practices/SKILL.md).

| Skill                                      | What it drives                                                                                                                                                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Address](.claude/skills/address/SKILL.md) | Delivering one unit of work — an issue, a pull request, or a free-form prompt — end-to-end: plan, human approval, code, independent review, address findings; `continue` resumes a paused run or takes over a handoff package |
| [Handoff](.claude/skills/handoff/SKILL.md) | Suspending in-progress work into a downloadable package that a fresh-context session takes over with `/address continue`                                                                                                      |

## Response Approach

Use this workflow for single-agent work in this project. The agent owns planning, implementation, investigation, verification, review, and reporting directly.

### Overall Strategy

Non-trivial work should move through the same decision sequence even when some steps are brief.

1. Classify the request and load the relevant project guidance.
2. Define success criteria, constraints, affected surface, dependencies, and verification expectations.
3. Inspect the smallest useful content and documentation context.
4. Draft an ordered local workflow with acceptance criteria.
5. Implement, investigate, or review within the narrowest scope that satisfies the request.
6. Self-review the result as a separate phase.
7. Run or report the relevant verification.
8. Update or propose skill guidance when the work exposes reusable project learning.
9. Summarize outcome, verification status, trade-offs, and open follow-ups.

**Guidelines:**

- MUST consult [Development Guidelines](.claude/skills/development-guidelines/SKILL.md) at the start of every task.
- MUST classify non-trivial work as implementation-only, review-only, skill-maintenance, exploratory, or mixed workflow before editing files.
- MUST consult every skill whose routing condition matches the changed surface or requested review lens.
- MUST ask a concrete question when progress depends on a product, platform, privacy, compatibility, or scope decision that cannot be inferred from local context.
- SHOULD compress the sequence for small answer-only requests without skipping relevant safety checks.

### Planning and Execution

Planning exists to make the work checkable. It should name what changes, what must stay unchanged, and how the result will be verified.

**Guidelines:**

- MUST restate success criteria, constraints, affected surface, and verification expectations before non-trivial edits.
- MUST preserve existing behavior and routing during refactors unless the requested change intentionally modifies it.
- MUST keep edits scoped to the smallest surface that satisfies the acceptance criteria.
- SHOULD inspect independent discovery targets in parallel when their outputs do not depend on each other.
- SHOULD revise the plan when new evidence changes affected files, risks, or acceptance criteria.

### Review Independence Gates

A single agent cannot provide true independent review. This project compensates with a mandatory separate review phase for ordinary work and external review gates for high-risk work.

**Guidelines:**

- MUST perform a reviewer-mode reset after non-trivial implementation: stop editing, reread the request, inspect `git status` and `git diff`, and review only the produced diff.
- MUST apply [Code Review Guideline](.claude/skills/code-review-guideline/SKILL.md) during self-review, including severity labels, file-line evidence, concrete fixes, and an explicit verdict when findings exist.
- MUST load topic-specific review lenses when relevant: maintainability, quality assurance, and security, plus any project-specific lenses defined later.
- MUST judge the actual diff and observed behavior, not the implementation intent.
- MUST fix Critical or Major self-review findings before claiming completion.
- MUST perform a second-pass re-review after fixing any blocking self-review finding.
- MUST report verification evidence before completion: commands run, manual checks, failures, skipped checks, and residual risk.
- MUST escalate high-risk changes to user review, CI/PR review, or an explicitly requested secondary review before calling them merge-ready.
- SHOULD route that escalation through the project's independent-review channel — the posted-review policy in [REVIEW.md](./REVIEW.md).
- SHOULD treat changes to the review/CI infrastructure, the skill index and routing, secret handling, dependency/supply-chain changes, and large cross-skill refactors as high-risk.

### Verification

Verification should match the changed surface. Documentation changes need relative-link and format/lint checks; changes to the harness binding, hooks, or CI need stronger evidence.

**Guidelines:**

- MUST run the relevant verification commands after non-trivial changes, or report why they could not run.
- MUST run `npm run format` and `npm run lint` after content or documentation edits.
- MUST run the relative-link integrity check (`.claude/skills/agent-skills-best-practices/scripts/check-links.sh`) after changing links, file paths, or skill locations.
- SHOULD perform focused manual checks when a skill's routing, cross-links, or frontmatter `description`/`when_to_use` changes — confirm the index and the skill's discovery metadata still match its content.
- MUST report unverified acceptance criteria and residual risk in the final summary.

### Skill Maintenance

Skill maintenance keeps reusable workflow learning close to the project rules. It should happen when a change reveals durable guidance, not after every narrow fix.

**Guidelines:**

- MUST consult [Agent Skills Best Practices](.claude/skills/agent-skills-best-practices/SKILL.md) when adding, renaming, moving, deleting, splitting, or cross-linking skills, changing reference files, or updating this index.
- MUST keep this skill index synchronized when skills are added, renamed, moved, or removed.
- MUST make one skill the source of truth for a rule instead of copying detailed guidance across multiple skills.
- SHOULD propose or implement skill updates when the workflow exposes a reusable convention, outdated guidance, recurring review issue, or missing project rule.
- SHOULD skip skill maintenance when the workflow produced no generalizable learning, and state that it was skipped.

### Communication

User-facing communication should expose decisions, blockers, verification, and outcomes without narrating every local inspection step.

**Guidelines:**

- MUST keep progress updates concise and focused on decisions, blockers, and outcomes.
- MUST summarize changed files, verification status, trade-offs, unresolved risks, and deferred follow-ups at completion.
- MUST state whether skill maintenance was performed, skipped, or blocked when skill guidance governed the work.
- SHOULD include detailed plans, command logs, or iteration logs only when the user asks for auditability or when the outcome depends on them.
- MUST ask a concrete question when progress depends on a product, platform, privacy, or scope decision.
