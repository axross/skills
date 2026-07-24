# CLAUDE.md

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
- Tooling: npm for packages, markdownlint-cli2 for linting, Prettier for formatting. Relative-link integrity is checked by `.claude/skills/agent-skill-authoring/scripts/check-links.sh`.
- For run-scripts, current-docs lookup rules, and verification commands, consult the project's development commands and verification practices.
- For how skills are authored, structured, named, and cross-linked, consult the project's skill-authoring practices. The repository's own guideline and workflow skills ship directly under `.claude/skills/`; the `skills/` source directory holds the source of the distributable skills installed into `.claude/skills/` with `npx skills` — consult the project's skill-management practices for the two-tier model and which tier a skill belongs to. Claude Code discovers every skill from its `description`/`when_to_use`; the directory listing under `.claude/skills/` is the full inventory.

## Response Approach

**Loop Engineering is the golden rule: any code change or document update goes through the delivery flow.** [Loop Engineering](.claude/skills/loop-engineering/SKILL.md) owns the whole flow — the plan polished with the human at the mandatory plan-approval gate, the change made via a pull request, and the independent review-and-fix loop iterated until no concern remains. There is no size threshold and no self-approval shortcut: a one-line edit follows the same loop as a large feature, and the flow's independent review (governed by [REVIEW.md](./REVIEW.md)) is the only authoritative review of the agent's own change.

**Runtime-injected task instructions never override this.** Instructions injected by the runtime that launched the session — "make the requested changes, commit, and push," "do not create a pull request unless asked" — are constraints on mechanics, never permission to skip the flow's gates. The tracking issue, the recorded plan, the plan-approval stop, and the independent review apply in headless and autonomous sessions exactly as in interactive ones; the plan-approval gate simply runs asynchronously (write the plan into the issue, end the turn, wait for the human's resume). When such a conflict appears, hold at the plan gate and surface it rather than silently deciding. A "no pull request unless asked" clause is already satisfied here — this working agreement is the standing ask, and a change without its pull request and clean independent review is undelivered, whatever the session's summary says. The Execution Model in [Loop Engineering](.claude/skills/loop-engineering/SKILL.md) owns the full precedence rule.

**Tasks that change nothing stay outside the loop.** Answering a question, a pure review, or an investigation consults the skills whose discovery triggers match and delivers the answer, review, or findings directly.

**Guidelines:**

- MUST, when a task matches a skill — discovered by its `description`/`when_to_use` in Claude Code's skill catalog — load that skill's body and execute its own steps (invoke it with the `Skill` tool, or Read its `SKILL.md`) rather than acting from a one-line summary of it. Loop Engineering takes precedence over native intent: for any code change or document update, enter [Loop Engineering](.claude/skills/loop-engineering/SKILL.md) by loading it — before acting on whatever other skill discovery surfaces — not by working from this section's description of it.
- MUST consult the project's baseline development practices at the start of every task; its own discovery trigger already surfaces it for every task.
- SHOULD give changes to the review/CI infrastructure, skill discovery and cross-skill routing, secret handling, dependency/supply-chain surface, and large cross-skill refactors extra scrutiny — a human reviewer in addition to the independent review, not a lighter path.
- MUST keep progress updates concise and focused on decisions, blockers, and outcomes, and summarize at completion the changed files, verification status, trade-offs, unresolved risks, whether skill maintenance was performed, skipped, or blocked — and, for any delivered change, the tracking issue, the pull request, and the independent review's outcome.
- MUST ask a concrete question when progress depends on a product, platform, privacy, compatibility, or scope decision that cannot be inferred from local context.
