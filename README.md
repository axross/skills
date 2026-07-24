# skills

A curated, reusable library of Claude Code agent skills.

`skills` collects the working agreement and skills that give
[Claude Code](https://claude.com/claude-code) a structured way to work: a master
routing index in [`AGENTS.md`](./AGENTS.md) (loaded through `CLAUDE.md`), a set
of guideline skills under [`.claude/skills/`](./.claude/skills), and a
model-invoked delivery loop (loop-engineering) with a `/handoff` companion. It
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
`.claude/skills/` and running `npm run check`. In a Claude Code cloud session,
[`.claude/hooks/session-start.sh`](./.claude/hooks/session-start.sh) installs
dependencies (activating a Node version manager if one is present); the opt-in
format-on-edit and check-before-stop hooks are materialized from
[`.claude/settings.local-example.json`](./.claude/settings.local-example.json).

## Development workflow

Development in this repository is agent-assisted via
[Claude Code](https://claude.com/claude-code). The working agreement lives in
[`AGENTS.md`](./AGENTS.md) (loaded through `CLAUDE.md`) and routes to the
detailed skills under [`.claude/skills/`](./.claude/skills). Human and agent
contributors follow the same loop: plan → implement → self-review → verify →
report.

### Delivering a unit of work end-to-end

[Loop Engineering](./.claude/skills/loop-engineering/SKILL.md) is the
repository's default delivery flow. It runs **model-invoked** — there is no
slash command; describe the work (a GitHub issue, a pull request, or a free-form
prompt) and the flow drives it from intake to a merge-ready pull request in a
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
delivers it). To approve a paused plan, resume after a question, or take over a
`/handoff` package, continue the session (or start a fresh one with the package
attached) and tell it to continue.

### `@claude review` — get findings on any PR

Comment **`@claude review`** on a pull request to run this repository's review
policy ([`REVIEW.md`](./REVIEW.md)) — severity-tagged findings with `file:line`
evidence and concrete fixes, posted as inline comments by the CI reviewer
([`claude-review.yaml`](./.github/workflows/claude-review.yaml)). Use it for a
pre-merge check on a hand-written change or a second opinion before merging; the
same review runs automatically against the delivery flow's pull requests.

The reviewer is inert until a one-time operator setup is done: install the
[Claude GitHub App](https://github.com/apps/claude) and add a
`CLAUDE_CODE_OAUTH_TOKEN` repository secret (generate it with
`claude setup-token`), or set an `ANTHROPIC_API_KEY` secret for pay-as-you-go
billing. See the header of
[`claude-review.yaml`](./.github/workflows/claude-review.yaml) for details.

### `/handoff` — suspend work for another session

[`/handoff`](./.claude/skills/handoff/SKILL.md) packages in-progress work — goal,
current state, remaining to-dos, uncommitted changes — into a downloadable
`handoff-<epoch>.md` (plus an optional zip of supporting files). Use it when a
session is running low on context, or to park work for later; a fresh session
takes the package over by continuing the delivery flow with it attached.

Changes made without an agent follow the same bar: branch, implement, run the
checks below, open a pull request, and get it reviewed before merge.

## Installable skills

Most skills are committed directly under
[`.claude/skills/`](./.claude/skills). A second, **installable** form lives
under [`skills/`](./skills) — the source of truth for skills copied into
`.claude/skills/` with the
[vercel-labs/skills](https://github.com/vercel-labs/skills) CLI (`npx skills`).
It currently holds the `code-review`, `end-to-end-testing`,
`high-fidelity-ui-design`, `loop-engineering`, `observability-guidelines`,
`product-requirement-document-authoring`, `unit-testing`, and
`wireframe-design-guidelines` skills; the
[`skill-installation`](./.claude/skills/skill-installation/SKILL.md) skill
documents the install, lockfile, and refresh-and-verify workflow.

## Testing

There is no test suite — the deliverable is documentation. Verification is a
format check, a Markdown lint, and a relative-link integrity check; all three
gate a merge via [`merge-checks.yaml`](./.github/workflows/merge-checks.yaml).

| Check          | Command                                               |
| -------------- | ----------------------------------------------------- |
| Format         | `npm run format` (check-only: `npm run format:check`) |
| Lint           | `npm run lint`                                        |
| Link integrity | `npm run links`                                       |
| All three      | `npm run check`                                       |

Run format + lint after every change, and the link check whenever links or file
paths move — see the Verification section of [`AGENTS.md`](./AGENTS.md).
