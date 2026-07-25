# skills

A curated, reusable library of Claude Code agent skills.

`skills` collects the working agreement and skills that give
[Claude Code](https://claude.com/claude-code) a structured way to work: a working
agreement in [`CLAUDE.md`](./CLAUDE.md), a set
of guideline skills under [`.claude/skills/`](./.claude/skills) that Claude Code
discovers by their `description`/`when_to_use`, and a
model-invoked change loop (loop-engineering). It
is Markdown-first — the skills _are_ the deliverable — with a little JavaScript
tooling to keep the docs formatted, linted, and link-checked.

## Tech stack

| Area            | Tool                                                          |
| --------------- | ------------------------------------------------------------- |
| Language        | Markdown (with occasional JavaScript for scripting)           |
| Runtime         | Claude Code                                                   |
| Package manager | npm                                                           |
| Formatting      | Prettier                                                      |
| Linting         | markdownlint-cli2                                             |
| Link integrity  | `.claude/skills/agent-skill-authoring/scripts/check-links.sh` |

## Getting started

1. Install dependencies: `npm install`
2. Run the checks: `npm run check` (format check + lint + relative-link check)

There is no dev server — authoring a skill means editing Markdown under
[`skills/`](./skills) (or `.claude/skills/` for a repository-local skill),
reinstalling if it is distributable, and running `npm run check`. In a Claude
Code cloud session,
[`.claude/hooks/session-start.sh`](./.claude/hooks/session-start.sh) installs
dependencies (activating a Node version manager if one is present); the opt-in
format-on-edit and check-before-stop hooks are materialized from
[`.claude/settings.local-example.json`](./.claude/settings.local-example.json).

## Development workflow

Development in this repository is agent-assisted via
[Claude Code](https://claude.com/claude-code). The working agreement lives in
[`CLAUDE.md`](./CLAUDE.md) and routes to the
detailed skills under [`.claude/skills/`](./.claude/skills). Human and agent
contributors follow the same loop: plan → implement → self-review → verify →
report.

### Delivering a unit of work end-to-end

[Loop Engineering](./.claude/skills/loop-engineering/SKILL.md) is the
repository's default change loop. It runs **model-invoked** — there is no
slash command; describe the work (a GitHub issue, a pull request, or a free-form
prompt) and the loop drives it from intake to a merge-ready pull request in a
single continuing session:

1. **Plan** — reads the issue and its thread, asks you the scope questions the
   spec leaves open, and rewrites the issue body into a reviewable plan with
   acceptance criteria. It then **always pauses for your approval**: nothing
   gets built until you review the plan and tell it to continue.
2. **Code + verify** — implements the approved plan on an agent-namespaced
   `claude/` branch, runs the checks the change requires, and self-reviews the
   diff.
3. **Independent review** — opens a draft pull request and requests the CI
   reviewer, a separate bot session, so the change's author never certifies its
   own work.
4. **Address** — fixes review findings and CI failures, tying each resolved
   thread to the resolving commit, for up to eight rounds.
5. **Ready** — flips the pull request to ready once CI is green and the review
   is clean. Merging always stays a human decision.

Kick it off by naming the work — "deliver issue #42", "pick up PR 57", or a
free-form request (with no issue yet, it files a tracking issue first, then
delivers it). To approve a paused plan or resume after a question, continue the
session and tell it to continue.

### `@claude review` — get findings on any PR

Comment **`@claude review`** on a pull request to run this repository's review
policy ([`REVIEW.md`](./REVIEW.md)) — severity-tagged findings with `file:line`
evidence and concrete fixes, posted as inline comments by the CI reviewer
([`claude-review.yaml`](./.github/workflows/claude-review.yaml)). Use it for a
pre-merge check on a hand-written change or a second opinion before merging; the
same review runs automatically against the change loop's pull requests.

The reviewer is inert until a one-time operator setup is done: install the
[Claude GitHub App](https://github.com/apps/claude) and add a
`CLAUDE_CODE_OAUTH_TOKEN` repository secret (generate it with
`claude setup-token`), or set an `ANTHROPIC_API_KEY` secret for pay-as-you-go
billing. See the header of
[`claude-review.yaml`](./.github/workflows/claude-review.yaml) for details.

Changes made without an agent follow the same bar: branch, implement, run the
checks below, open a pull request, and get it reviewed before merge.

## Installable skills

Almost every skill here is **installable**: its source lives under
[`skills/`](./skills) and is copied into `.claude/skills/` with the
[vercel-labs/skills](https://github.com/vercel-labs/skills) CLI (`npx skills`).
Fourteen skills are distributed that way — `agent-skill-authoring`,
`agent-skill-management`, `application-security`, `code-maintainability`,
`code-review`, `end-to-end-testing`, `high-fidelity-ui-design`,
`loop-engineering`, `product-requirement-document-authoring`,
`quality-assurance`, `software-development`, `software-instrumentation`,
`unit-testing`, and `wireframe-design`.

Only `github-operation` remains **repository-local**, committed directly under
[`.claude/skills/`](./.claude/skills) and hand-edited in place. The
[`agent-skill-management`](./skills/agent-skill-management/SKILL.md) skill
documents the two-tier layout, which tier a new skill belongs to, the install,
lockfile, and refresh-and-verify workflow, and how to propose a change to a
skill installed from an upstream you do not own.

## Commands

There is no test suite and no development server — the deliverable is
documentation, so verification is a format check, a Markdown lint, and a
relative-link integrity check. `npm run check` is the aggregate gate, and all
three checks gate a merge via
[`merge-checks.yaml`](./.github/workflows/merge-checks.yaml).

This table is the authoritative list of the repository's commands, for human
contributors and agents alike.

| Command                | What it does                                                                   | When to run it                                                   |
| ---------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `npm install`          | Installs the toolchain (Prettier, markdownlint-cli2) pinned in `package.json`. | Once per checkout, and after `package.json` changes.             |
| `npm run format`       | Rewrites Markdown, JSON, and YAML files in place with Prettier.                | After every set of edits, before committing.                     |
| `npm run format:check` | Reports formatting drift without rewriting anything; exits non-zero on drift.  | In CI, or to check formatting without touching the working tree. |
| `npm run lint`         | Runs markdownlint-cli2 over every Markdown file.                               | After formatting, and fix every reported error before finishing. |
| `npm run links`        | Checks that every relative Markdown link resolves on disk (`check-links.sh`).  | Whenever links, file paths, or skill locations move.             |
| `npm run check`        | The aggregate gate: format check, then lint, then the link check.              | Before opening or updating a pull request.                       |

If a required command cannot be run, say so — naming the command, the reason,
and the residual risk — rather than presenting the change as fully verified.

## Repository gotchas

Three things about this repository are worth knowing before changing it.

**Some dependencies move fast enough that memory is unreliable.** Consult the
current official docs before changing behavior these govern:

| Dependency                   | Refresh docs before changing                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Claude Code                  | Skill format and frontmatter, hook and settings configuration, slash-command behavior, MCP configuration |
| markdownlint-cli2 / Prettier | Lint and format configuration, suppression syntax, rule names                                            |

**Some files fail globally rather than locally.** A small mismatch in one of
these breaks skill discovery or the verification gate outright, not just one
rendered page — so refresh the owning tool's docs before editing one:

- **Claude Code** — any `SKILL.md` frontmatter, `.claude/settings*.json`, and
  the hooks under `.claude/hooks/`.
- **markdownlint-cli2 / Prettier** — `.markdownlint-cli2.jsonc`,
  `.prettierrc.json`, and `.prettierignore`.

**The installed skill copies are generated, not source.** The distributable
skills under [`skills/`](./skills) are the source of truth, and their copies
under `.claude/skills/` are produced by `npx skills`. Edit the source and
reinstall — a hand-edit to an installed copy is silently discarded by the next
install.
