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
- For how skills are authored, structured, named, and cross-linked, consult [Agent Skills Best Practices](.claude/skills/agent-skills-best-practices/SKILL.md). The repository's own guideline and workflow skills ship directly under `.claude/skills/`; the `skills/` source directory holds the source of the distributable skills installed into `.claude/skills/` with `npx skills` — see [Skill Installation](.claude/skills/skill-installation/SKILL.md). The index below routes to all of them.

## Skill Index

`AGENTS.md` is the master routing index for the library's skills. Consult the relevant skill before acting on matching work. Keep this index in sync whenever a skill is added, renamed, moved, or removed.

| Skill                                                                                                    | When to apply                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Agent Skills Best Practices](.claude/skills/agent-skills-best-practices/SKILL.md)                       | Creating, refining, splitting, renaming, deleting, or auditing skills or this skill index                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [Application Security Requirements](.claude/skills/application-security-requirements/SKILL.md)           | Reviewing secrets, environment variables, input validation, injection in rendered content, SSRF/outbound fetching, privacy exposure, or dependency/supply-chain risk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [Code Review](.claude/skills/code-review/SKILL.md)                                                       | Reviewing a diff, pull request, branch or commit-range, local change, or post-implementation self-review — reviewer-mode reset and diff scoping, four-tier severity with fixed floors and a verdict, file-line evidence and diff-style fix snippets, blame-free tone, escalation for high-risk changes, a posted/CI-review overlay, and what-to-flag lenses (correctness, maintainability, security/privacy, testing, performance). Self-contained and installable via `npx skills`; the repository's posted-review policy in [REVIEW.md](./REVIEW.md) overlays it                                                                                                                                                         |
| [Development Guidelines](.claude/skills/development-guidelines/SKILL.md)                                 | Implementing, refactoring, running commands, preparing commits, writing pull request descriptions, adding dependencies, writing source comments or doc-comments, or checking current docs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [E2E Testing Guidelines](.claude/skills/e2e-testing-guidelines/SKILL.md)                                 | Writing, running, reviewing, or maintaining end-to-end tests on any runner (Playwright, Cypress, Maestro, Detox, Vitest) — the e2e directory layout and naming, test-id/role/copy locators, auto-waiting assertions and no-sleep polling, the test environment (real driver, server lifecycle, determinism, auth/data helpers), scenario coverage and its phased gate, or e2e run commands                                                                                                                                                                                                                                                                                                                                 |
| [GitHub Operation Guidelines](.claude/skills/github-operation-guidelines/SKILL.md)                       | Reading from or writing to GitHub — issues, pull requests, comments, labels, reviews, or branches — through a proxied single-operator identity: agent-comment markers, issue-vs-PR targets, commit messages and pull request titles under squash merge, pull request template and description authoring, history preservation (no amend/force-push), untrusted content                                                                                                                                                                                                                                                                                                                                                     |
| [High-Fidelity UI Design](.claude/skills/high-fidelity-ui-design/SKILL.md)                               | Designing, building, or reviewing a high-fidelity (real-token) UI surface — semantic design tokens and dark mode, visual hierarchy and spacing grids, typography, per-theme WCAG contrast and non-color cues, touch targets and interaction states, focus, motion, assistive-tech semantics, and cognitive load                                                                                                                                                                                                                                                                                                                                                                                                            |
| [Loop Engineering](.claude/skills/loop-engineering/SKILL.md)                                             | Driving a change end-to-end through the plan → code → verify → independent-review → address delivery loop — the repository's **default and standard** flow for **every** code change or document update, however small (a GitHub issue, a pull request, or a free-form request), to a review-ready pull request. No size threshold and no self-approval shortcut. Runs model-invoked (no slash command); `handoff` companions it to suspend work across sessions. Self-contained and installable via `npx skills`; defer to a host project's own more-specific delivery workflow if it ships one.                                                                                                                          |
| [Maintainable Code Guidelines](.claude/skills/maintainable-code-guidelines/SKILL.md)                     | Reviewing readability, naming, abstraction boundaries, complexity, dead code, or scope discipline                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [Observability Guidelines](.claude/skills/observability-guidelines/SKILL.md)                             | Writing or reviewing code that logs, throws, catches, reports an error, tracks an event, or configures a logger, error tracker, tracing, or analytics tool — structured logging and log levels, try/catch placement and error propagation, error-reporting capture, breadcrumbs, error boundaries, trace/replay sampling, PII in telemetry, and metrics/product analytics                                                                                                                                                                                                                                                                                                                                                  |
| [Product Requirement Document Authoring](.claude/skills/product-requirement-document-authoring/SKILL.md) | Writing, refining, or reviewing a product requirement document (PRD), feature spec, RFC, plan document, or issue description; owns the canonical seven-section structure (summary; background with goals/non-goals/assumptions; functional requirements with UI and system design plus alternatives considered; non-functional requirements; acceptance criteria; verification strategy; open questions) and each section's craft — problem/outcome framing, "what should be" requirement phrasing, design-section triggers including intricate minor-scoped mechanics, testable acceptance criteria, ordered verification steps, and section omit-rules. Self-contained and installable into any project via `npx skills` |
| [Quality Assurance Guidelines](.claude/skills/quality-assurance-guidelines/SKILL.md)                     | Reviewing verification evidence — lint/format proof, manual checks, skipped checks, and residual risk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [Skill Installation](.claude/skills/skill-installation/SKILL.md)                                         | Installing, refreshing, or removing the `skills/`-sourced skills with the `npx skills` CLI, the committed `.claude/skills/` copies and `skills-lock.json`, and the refresh-and-verify workflow after editing a source skill                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [Unit Test Guidelines](.claude/skills/unit-test-guidelines/SKILL.md)                                     | Writing, refactoring, reviewing, or running unit tests across runners such as Jest or Vitest — explicit test-API imports, colocated specs, describe/case naming, behavior-focused design, fixtures/fakes/mocks, async assertions, snapshot discipline, schema/codec tests, type-only modules, the optional coverage gate, and when to yield to integration or e2e coverage                                                                                                                                                                                                                                                                                                                                                 |
| [Wireframe Design Guidelines](.claude/skills/wireframe-design-guidelines/SKILL.md)                       | Producing a low-fidelity wireframe or breadboard mockup of any client-app UI (mobile or web/desktop) — sketching screens, breadboarding a flow, comparing layout options, or the wireframe round of a design review; the grey breadboard component vocabulary and its device canvases, fidelity discipline, information architecture and hierarchy, flow and annotation, and responsive/platform adaptation (not high-fidelity real-token mockups)                                                                                                                                                                                                                                                                         |

### Workflow Entry Points

Unlike the guideline skills above, a workflow entry point is human-launchable as `/<name>` and carries `user-invocable: true` with an `argument-hint` per [Agent Skills Best Practices](.claude/skills/agent-skills-best-practices/SKILL.md). The delivery loop itself — [Loop Engineering](.claude/skills/loop-engineering/SKILL.md), in the index above — is the repository's default code/document update flow and runs model-invoked (no slash command); `handoff` is the one human-launched workflow, pairing with it to suspend work across sessions.

| Skill                                      | What it drives                                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Handoff](.claude/skills/handoff/SKILL.md) | Suspending in-progress work into a downloadable package that a fresh-context session takes over by re-entering the delivery flow ([Loop Engineering](.claude/skills/loop-engineering/SKILL.md)) with the package attached |

## Response Approach

**Any code change or document update goes through the delivery flow.** [Loop Engineering](.claude/skills/loop-engineering/SKILL.md) is the repository's default and standard workflow for _every_ change, however small: polish the plan with the human at the plan-approval gate, make the change via a pull request, and iterate the independent review-and-fix loop until no concern remains. There is no size threshold and no self-approval shortcut — a one-line edit follows the same loop as a large feature.

The decision sequence below is the shape of the work _within_ that flow's phases, and the whole of it only for tasks that change nothing — answering a question, a pure review, an investigation. Across both, the agent is the only long-lived actor and owns planning, implementation, investigation, verification, and reporting directly; the one thing it never owns is the authoritative review of its own change, which the delivery flow routes to an independent reviewer.

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

A single agent cannot provide true independent review of its own change. This project does not rely on self-review for that: **every** code or document change goes through the delivery flow's independent review — a separate reviewer session, on separate infrastructure, applying [REVIEW.md](./REVIEW.md) — not just high-risk ones. The reviewer-mode self-check below is a pre-pull-request gate that catches trivial hand-backs; it never substitutes for the independent review.

**Guidelines:**

- MUST perform a reviewer-mode reset after implementing a change: stop editing, reread the request, inspect `git status` and `git diff`, and review only the produced diff.
- MUST apply [Code Review](.claude/skills/code-review/SKILL.md) during self-review, including severity labels, file-line evidence, concrete fixes, and an explicit verdict when findings exist.
- MUST load topic-specific review lenses when relevant: maintainability, quality assurance, and security, plus any project-specific lenses defined later.
- MUST judge the actual diff and observed behavior, not the implementation intent.
- MUST fix Critical or Major self-review findings before opening the pull request.
- MUST perform a second-pass re-review after fixing any blocking self-review finding.
- MUST report verification evidence before completion: commands run, manual checks, failures, skipped checks, and residual risk.
- MUST route every change through the delivery flow's independent review before calling it merge-ready, and let [REVIEW.md](./REVIEW.md) govern that review; never self-approve a change on the strength of self-review alone.
- SHOULD give changes to the review/CI infrastructure, the skill index and routing, secret handling, dependency/supply-chain changes, and large cross-skill refactors extra scrutiny — a human reviewer in addition to the independent review, not a lighter path.

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
