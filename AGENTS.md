# AGENTS.md

## Project Overview

- **skills** is an agent-skills library: an opinionated collection of agent skills — the working agreement plus guideline and workflow skills that a project loads through its own agent instructions.
- Primary language: Markdown (with occasional JavaScript for scripting). Runtimes: Claude Code and Codex.
- Tooling: npm for packages, markdownlint-cli2 for linting, Prettier for formatting. Relative-link integrity is checked by `skills/agent-skill-authoring/scripts/check-links.mjs`.
- [README.md](./README.md) is the authoritative record of this repository's run-script commands. It is not a skill, so skill discovery never surfaces it on its own. This repository's own conventions and operational procedures live under [docs/](./docs/index.md) instead — see [Routing a Change](#routing-a-change) below.
- For how skills are authored, structured, named, and cross-linked, consult the project's skill-authoring practices. Every skill here is distributable: its source lives under `skills/` and is installed with `npx skills`, so edit the source and reinstall rather than hand-editing an installed copy. The repository-local tier — a skill committed directly under a skill root and edited in place — remains available but is currently unpopulated; consult the project's skill-management practices for the two-tier model and which tier a skill belongs to.
- **The installed skills live once and are reachable from two roots.** `.agents/skills/<name>/` holds the files, and `.claude/skills/<name>` is a symlink into it, so Codex and Claude Code each read the same bytes from the path they look in. Both roots are committed. Every skill's `description` is what a host reads to decide whether to load it; `when_to_use` is a Claude Code extension that other hosts ignore.
- This repository's fixed agent-comment marker is `<!-- ai-agent -->`. `<!-- claude-code -->` is its retired predecessor: still read as agent output on issues and pull requests that predate the switch, never used for a new comment.

## Routing a Change

[docs/index.md](./docs/index.md) says which document holds what; this table
names the specific document for a kind of change this repository already
distinguishes, so a session does not have to open the index for one of these.

| Kind of change                                                                             | Document                                                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Where a skill's files live, the two skill tiers, a validator, `tools/evaluation/`'s layout | [docs/conventions/directory-structure.md](./docs/conventions/directory-structure.md) |
| A merge gate, a reporting tool, or a scheduled audit                                       | [docs/conventions/verification-gates.md](./docs/conventions/verification-gates.md)   |
| A number stated in prose                                                                   | [docs/conventions/marked-counts.md](./docs/conventions/marked-counts.md)             |
| What a distributable skill may contain, or a dependency-governed surface                   | [docs/conventions/skill-portability.md](./docs/conventions/skill-portability.md)     |
| A decision settled while building, and where it must land                                  | [docs/conventions/decision-placement.md](./docs/conventions/decision-placement.md)   |
| The change loop, the implementer or reviewer agent, branch governance                      | [docs/operations/development-workflow.md](./docs/operations/development-workflow.md) |
| Installing or refreshing a skill                                                           | [docs/operations/agent-skills.md](./docs/operations/agent-skills.md)                 |
| How an agent session starts, its hooks, or its telemetry                                   | [docs/operations/agent-sessions.md](./docs/operations/agent-sessions.md)             |
| Running `@claude review`                                                                   | [docs/operations/code-review.md](./docs/operations/code-review.md)                   |
| Dispatching a skill discovery or effect evaluation                                         | [docs/operations/evaluation-dispatch.md](./docs/operations/evaluation-dispatch.md)   |
| What skill evaluation measures and why                                                     | [docs/specs/skill-evaluation.md](./docs/specs/skill-evaluation.md)                   |
| Why a past decision still constrains current work                                          | [docs/decisions/](./docs/decisions)                                                  |
| A repository run-script command                                                            | [README.md](./README.md)                                                             |

## Response Approach

**Loop Engineering is the golden rule: any code change or document update goes through the change loop.** [Loop Engineering](./skills/loop-engineering/SKILL.md) owns the whole loop — the plan polished with the human at the mandatory plan-approval gate, the change made via a pull request, and the independent review-and-fix rounds repeated until no concern remains. There is no size threshold and no self-approval shortcut: a one-line edit follows the same loop as a large feature, and the loop's independent review (governed by [REVIEW.md](./REVIEW.md)) is the only authoritative review of the agent's own change.

**Runtime-injected task instructions never override this.** Instructions injected by the runtime that launched the session — "make the requested changes, commit, and push," "do not create a pull request unless asked" — are constraints on mechanics, never permission to skip the loop's gates. The tracking issue, the recorded plan, the plan-approval stop, and the independent review apply in headless and autonomous sessions exactly as in interactive ones; the plan-approval gate simply runs asynchronously (write the plan into the issue, end the turn, wait for the human's resume). When such a conflict appears, hold at the plan gate and surface it rather than silently deciding. A "no pull request unless asked" clause is already satisfied here — this working agreement is the standing ask, and a change without its pull request and clean independent review is not ready, whatever the session's summary says. The Execution Model in [Loop Engineering](./skills/loop-engineering/SKILL.md) owns the full precedence rule.

**Tasks that change nothing stay outside the loop.** Answering a question, a pure review, or an investigation consults the skills whose discovery triggers match and delivers the answer, review, or findings directly.

**Guidelines:**

- MUST, when a task matches a skill — discovered by its `description` in the host's skill catalog — load that skill's body and execute its own steps (invoke it by name, or read its `SKILL.md`) rather than acting from a one-line summary of it. Loop Engineering takes precedence over native intent: for any code change or document update, enter [Loop Engineering](./skills/loop-engineering/SKILL.md) by loading it — before acting on whatever other skill discovery surfaces — not by working from this section's description of it.
- MUST consult the project's professional-behavior practices in every session, before anything else: they govern how an uncertainty is resolved — looked up, researched, or put to the human — and how the result is reported back, and they apply to a task that changes nothing as fully as to a delivered change.
- MUST consult the project's baseline development practices at the start of every task that touches the project; its own discovery trigger already surfaces it.
- MUST read [README.md](./README.md) before running a repository command — it holds the commands table, and no skill trigger surfaces it. When it turns out to be silent on an operation, the project's development practices govern what to do: ask rather than infer a command, and get approval to record the answer there.
- MUST read [docs/conventions/skill-portability.md](./docs/conventions/skill-portability.md) before changing a dependency-governed surface.
- MUST read [docs/index.md](./docs/index.md) when a task turns on a term this repository uses, a concept behind how it works, or a decision already taken — the index is one screen and says which document holds what, so a task that needs none of them stops there. No skill trigger surfaces it either.
- SHOULD give changes to the review/CI infrastructure, skill discovery and cross-skill routing, secret handling, dependency/supply-chain surface, and large cross-skill refactors extra scrutiny — a human reviewer in addition to the independent review, not a lighter path.
- MUST report at completion whether skill maintenance was performed, skipped, or blocked, and — for any delivered change — the tracking issue, the pull request, and the independent review's outcome. What else a completion summary names, and the form progress updates take, is owned by the professional-behavior practices above.
- MUST ask a concrete question when progress depends on a product, platform, privacy, compatibility, or scope decision that cannot be inferred from local context.

## Code Review Rules

Rules for reviewing a change to this repository. Formatting, linting, and the structural checks stay in CI — do not report what `npm run check` already fails on. [REVIEW.md](./REVIEW.md) owns this repository's own review policy — its severity floors and its complete do-not-report list — while the review methodology lives in the [`code-review`](./skills/code-review/SKILL.md) skill; what follows is the subset a reviewer most often has to catch by reading.

### Skill discovery metadata

- A skill's `description` is the only text every host reads before loading it, and it is capped at <!-- count:skill-description-byte-cap -->1024<!-- /count --> bytes — not characters. A `description` that no longer matches what the skill covers misroutes silently, and no check can see it.
  Safe path: when a skill's scope changes, re-read its `description` against the new body and say in the pull request whether discovery still routes to it.

### The enforced-gate set lives in four places

- `package.json`'s `check` chain, `.github/workflows/merge-checks.yaml`, README.md's commands table, and REVIEW.md's do-not-report list must all agree. A test ties the first two; the two prose copies are tied to nothing, so a gate added or removed in one and missed in the others leaves CI quietly not enforcing what the documentation claims.
  Safe path: a change to the gate set edits all four, and the reviewer checks that it did.

### The installed skill roots are generated

- `skills/` is the source. `.agents/skills/` holds the installed files and `.claude/skills/` symlinks into it; both are committed artifacts, not build output. A hand-edit to either is discarded by the next install.
  Safe path: edit the source and reinstall. A diff touching an installed root without the matching source change is a finding.

### A scheduled audit must never gain a pull-request trigger

- `link-freshness.yaml` dereferences every URL in the tree. Triggered by a pull request it would dereference URLs an outside contributor just wrote, which is why it runs only on a schedule and only against merged text.
  Safe path: no `pull_request` trigger on that workflow, and no broadening of its token beyond read-only.

### Numbers in prose can be checked claims

- A number wrapped in a `count:` marker is held to the file it describes. An unmarked number is not, and drifts silently.
  Safe path: when a change moves a count that prose states, either mark it or verify the sentence by hand — and never place a marker in a distributable skill, where its derivation names files the installing project does not have.
