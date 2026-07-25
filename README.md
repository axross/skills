# skills

A curated, reusable library of agent skills.

`skills` is a library of **agent skills** in the
[agentskills.io](https://agentskills.io) format — self-contained capabilities
you install into a coding agent so it plans, builds, reviews, and verifies work
the way you want it done. Fifteen of them cover the whole arc: turning a request
into a spec, driving that spec to a reviewed pull request, keeping the code
maintainable and secure, testing it, designing its UI, and authoring more skills.
They install into any agent the [`skills`
CLI](https://github.com/vercel-labs/skills) supports.

The library is Markdown-first — the skills _are_ the deliverable — with a little
JavaScript tooling to keep them formatted, linted, and link-checked.

## Getting started

Install skills into your own project with the
[vercel-labs/skills](https://github.com/vercel-labs/skills) CLI. Take them one at
a time — each is self-contained, and several are opinionated enough to be worth
choosing deliberately:

```bash
npx skills add axross/skills --agent <your-agent> --skill code-review
```

Replace `<your-agent>` with your agent's identifier; the CLI's
[supported agents](https://github.com/vercel-labs/skills#supported-agents) list
has them all. Browse what is on offer in the [skill catalog](#skill-catalog)
below, or ask the CLI:

```bash
npx skills add axross/skills --list
```

To take the whole library, or to install into every agent you have set up, pass
`'*'` in place of a name:

```bash
npx skills add axross/skills --agent '*' --skill '*'
```

Add `--copy` if your environment does not support symlinks — the skills then
land as real directories instead of links.

**Wiring them in.** An installed skill is discovered on its own: agents read its
`description`/`when_to_use` and load it when a task matches, so nothing else is
required. But discovery makes a skill _available_, not _binding_ — if you want
one to govern how work happens rather than merely inform it, say so in your own
agent instructions. This repository's [`CLAUDE.md`](./CLAUDE.md) is a worked
example: it makes `loop-engineering` the mandatory change loop for every change,
rather than one option among several.

## Skill catalog

Every skill in the library, grouped by what you would reach for it to do. All
fifteen install the same way; the ✱ marks where a skill's source lives in _this_
repository, which matters only if you contribute here.

### Delivering a change

| Skill                                                                                                | What it gives your agent                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`loop-engineering`](./skills/loop-engineering/SKILL.md)                                             | Runs a whole change for you — plan, build, verify, fix — pausing for your sign-off before it writes any code, and handing the review to a separate session so it never approves itself. |
| [`product-requirement-document-authoring`](./skills/product-requirement-document-authoring/SKILL.md) | Turns a vague ask into a spec someone can build from and check against, with acceptance criteria that are actually verifiable.                                                          |
| [`software-development`](./skills/software-development/SKILL.md)                                     | The baseline every task runs on: keep the change scoped, format and lint it, find out how the project is really run, and write a commit message that survives history.                  |
| [`github-operation`](./.claude/skills/github-operation/SKILL.md) ✱                                   | Keeps an agent's GitHub writes safe when it shares your login — one sanctioned channel, comments marked as its own, and history it never rewrites.                                      |

### Reviewing a change

| Skill                                                      | What it gives your agent                                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`code-review`](./skills/code-review/SKILL.md)             | Reads a diff the way a reviewer would and reports only what holds up: ranked severity, `file:line` evidence, a fix for each finding.      |
| [`quality-assurance`](./skills/quality-assurance/SKILL.md) | Asks whether a change was actually verified rather than merely written — which checks ran, which were skipped, and what risk that leaves. |

### Writing code that lasts

| Skill                                                                    | What it gives your agent                                                                                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`code-maintainability`](./skills/code-maintainability/SKILL.md)         | Catches what makes code expensive later: vague names, sprawling files, magic numbers, dead code, and abstractions reached for too early.              |
| [`application-security`](./skills/application-security/SKILL.md)         | An OWASP Top 10 lens for writing and reviewing alike — secrets, untrusted input, injection, SSRF, access control, and what your dependencies drag in. |
| [`software-instrumentation`](./skills/software-instrumentation/SKILL.md) | Makes behavior visible once it is running: structured logs at the right level, errors caught where they can be handled, and events worth tracking.    |

### Testing

| Skill                                                        | What it gives your agent                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| [`unit-testing`](./skills/unit-testing/SKILL.md)             | Fast, isolated tests written from the caller's side, so a refactor does not break them and a bug does.         |
| [`end-to-end-testing`](./skills/end-to-end-testing/SKILL.md) | Tests that drive the whole system like a real user — locators that do not rot, no sleeps, and no live network. |

### Designing a UI

| Skill                                                                  | What it gives your agent                                                                                                                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`wireframe-design`](./skills/wireframe-design/SKILL.md)               | Grey-box screens and flows, with a self-contained HTML kit, so layout gets settled before anyone argues about color.                                                 |
| [`high-fidelity-ui-design`](./skills/high-fidelity-ui-design/SKILL.md) | For when the greys become a real interface — semantic tokens, dark mode, readable type, WCAG contrast, visible focus, and states for every way a control can behave. |

### Authoring skills

| Skill                                                                | What it gives your agent                                                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [`agent-skill-authoring`](./skills/agent-skill-authoring/SKILL.md)   | How to write a skill an agent will actually find and follow: framing, frontmatter, discovery text, and a validator that checks the structure. |
| [`agent-skill-management`](./skills/agent-skill-management/SKILL.md) | Where a skill's source belongs, how it gets installed and refreshed, and what to do when you want to change one you do not own.               |

✱ `github-operation`'s source is committed under
[`.claude/skills/`](./.claude/skills); every other skill is sourced under
[`skills/`](./skills). That split is an authoring detail of this repository —
see [Authoring a skill](#authoring-a-skill) — and has no bearing on how you
install them.

## Contributing

Development here is agent-assisted via
[Claude Code](https://claude.com/claude-code). The working agreement lives in
[`CLAUDE.md`](./CLAUDE.md) and routes to the detailed skills under
[`.claude/skills/`](./.claude/skills). Human and agent contributors follow the
same loop: plan → implement → self-review → verify → report.

### Local setup

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

| Area            | Tool                                                          |
| --------------- | ------------------------------------------------------------- |
| Language        | Markdown (with occasional JavaScript for scripting)           |
| Runtime         | Claude Code                                                   |
| Package manager | npm                                                           |
| Formatting      | Prettier                                                      |
| Linting         | markdownlint-cli2                                             |
| Link integrity  | `.claude/skills/agent-skill-authoring/scripts/check-links.sh` |

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

### Authoring a skill

Skills live in two tiers. Fourteen are **distributable**: their source is
[`skills/<name>/SKILL.md`](./skills) (with any `references/` and `scripts/`
beside it), and the installed copies under `.claude/skills/` are generated from
it with the [vercel-labs/skills](https://github.com/vercel-labs/skills) CLI:

```bash
npx skills add ./skills --agent claude-code --skill '*' --yes --copy
```

Commit the regenerated `.claude/skills/<name>/` copies and `skills-lock.json`
alongside the source — they are tracked artifacts, not build output to ignore.

`github-operation` is **repository-local**: it encodes conventions specific to
this repository's harness, so its source is committed directly under
[`.claude/skills/`](./.claude/skills), hand-edited in place, and never touched
by the CLI or listed in `skills-lock.json`.

[Agent Skill Management](./skills/agent-skill-management/SKILL.md) covers which
tier a new skill belongs to and the full install, lockfile, and
refresh-and-verify workflow;
[Agent Skill Authoring](./skills/agent-skill-authoring/SKILL.md) covers how to
write the skill itself. Both are in the catalog above, so you can install them
into your own project too.

### Commands

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

### Repository gotchas

Four things about this repository are worth knowing before changing it.

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

**`npx skills` can fail to resolve the CLI.** In some environments — a fresh
container with no local install, or a stale npx cache — both `npx skills …` and
`npx --yes skills …` abort with `npm error could not determine executable to
run`, which reads like a broken command rather than a resolution failure. An
explicit version specifier fixes it:

```bash
npx --yes skills@latest add ./skills --agent claude-code --skill '*' --yes --copy
```

The plain `npx skills` form stays canonical — reach for the specifier only after
seeing that error, since pinning `@latest` on every run fetches the newest CLI
build each time.
