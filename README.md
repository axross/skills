# skills

An opinionated library of agent skills.

These are **agent skills** in the [agentskills.io](https://agentskills.io/home)
format — self-contained capabilities you install into a coding agent so it
plans, builds, reviews, and verifies work the way you want it done.
The <!-- count:distributable-skills -->twenty-nine<!-- /count --> here cover the
whole arc: handling what the agent does not know, turning a request into a spec,
driving that spec to a reviewed pull request, keeping the code maintainable and
secure, testing it, designing and building its UI, standing up the application
around it and the server state behind it, writing the documents that explain it
and keeping them true, and authoring more skills. They install into any agent the
[`skills` CLI](https://github.com/vercel-labs/skills) supports.

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

Replace `<your-agent>` with your agent's identifier — `claude-code`, `codex`,
and around seventy-five others; the CLI's
[supported agents](https://github.com/vercel-labs/skills#supported-agents) list
has them all, along with the directory each installs into. Note that a host
reads only what its own format defines: Codex routes on `description` alone and
caps it at 1,024 bytes. Every skill here therefore states its trigger in
`description` and carries no `when_to_use`, so it routes the same on either
host. Browse what is on offer in the [skill catalog](#skill-catalog)
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
`description` and load it when a task matches, so nothing else is
required. But discovery makes a skill _available_, not _binding_ — if you want
one to govern how work happens rather than merely inform it, say so in your own
agent instructions. This repository's [`CLAUDE.md`](./CLAUDE.md) is a worked
example: it makes `loop-engineering` the mandatory change loop for every change,
rather than one option among several.

## Skill catalog

Every skill in the library, grouped by what you would reach for it to do. They
all install the same way, and every one of them has its source under
[`skills/`](./skills) — see
[`docs/conventions/directory-structure.md`](./docs/conventions/directory-structure.md)
and [`docs/operations/agent-skills.md`](./docs/operations/agent-skills.md) if
you contribute here.

### Working with you

`professional-behavior` stands alone because it applies in every session — a
question answered, a review given, a change delivered — not only to changes.

#### `professional-behavior`

Keeps it honest about what it actually knows — looking things up instead of
guessing, checking current sources instead of trusting memory, asking you
instead of deciding for you, and reporting back so you can tell which is
which. See [`SKILL.md`](./skills/professional-behavior/SKILL.md).

### Delivering a change

These skills span one change's whole path from a vague request to a merged
pull request — writing the spec, running the plan-build-review loop
that carries it there, and the commit and GitHub conventions the result has
to meet.

#### `loop-engineering`

Runs a whole change for you — plan, build, verify, fix — pausing for your
sign-off before it writes any code, and handing the review to a separate
session so it never approves itself. See
[`SKILL.md`](./skills/loop-engineering/SKILL.md).

**Recommended settings for using this skill.** `loop-engineering` drives long,
many-turn runs, so the following two environment variables are worth setting
wherever you run it — not configuration the skill requires, but a way to cut
what a long run spends on carrying context and on work done around the
session rather than on it:

- `CLAUDE_CODE_AUTO_COMPACT_WINDOW=500000` — moves when auto-compaction
  fires. A long-running loop's context grows turn over turn; triggering
  compaction sooner keeps less of it in play on any given turn.
- `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=0` — stops prompt-suggestion
  generation, work done once per turn around a session rather than on it.
  The loop runs many turns to carry one change to a reviewed pull request,
  so that per-turn overhead recurs across the whole run in a way it would
  not for a single-turn task.

Set them in the environment dialog at claude.ai/code for a cloud session, or
in `~/.claude/settings.json` for a local one. `~/.claude/settings.json` does
**not** reach a cloud session — its scope stops at your own machine.

#### `product-requirement-document-authoring`

Turns a vague ask into a spec someone can build from and check against, with
acceptance criteria that are actually verifiable. See
[`SKILL.md`](./skills/product-requirement-document-authoring/SKILL.md).

#### `software-development`

The baseline every project-touching task runs on: keep the change scoped,
format and lint it, hold a comment to what the code cannot say for itself,
find out how the project is really run, and describe the result so a
reviewer can follow it. See
[`SKILL.md`](./skills/software-development/SKILL.md).

#### `conventional-commits`

One header contract for commit messages and pull request titles, with a
validator that catches a malformed header before it reaches your history.
See [`SKILL.md`](./skills/conventional-commits/SKILL.md).

#### `github-operation`

Keeps an agent's GitHub writes safe when it shares your login — a default
channel with a bounded fallback, comments marked as its own, and history it
never rewrites. See [`SKILL.md`](./skills/github-operation/SKILL.md).

### Writing a document

Three skills divide the same territory by tense and by grain, so none of them
overlaps the others. `product-requirement-document-authoring` owns the **diff** —
a spec's sections and the phrasing of a requirement about to be built.
`living-project-documentation` owns the **steady state** — the documents that say
what the project is and how it works now, and the mechanism that corrects them
when a change makes them wrong. `technical-document-authoring` owns the
**sentences** inside whatever you are writing.

#### `living-project-documentation`

Keeps the docs that describe your project true: read before planning,
corrected in the change that made them wrong, with decisions superseded
rather than edited — and five small validators for the rot a reader cannot
see. See [`SKILL.md`](./skills/living-project-documentation/SKILL.md).

#### `technical-document-authoring`

Makes a design doc, RFC, ADR, runbook, or README worth reading: one document
type instead of four blurred together, the answer at the top, sentences
nobody has to reparse, and words a non-native reader gets on the first pass.
See [`SKILL.md`](./skills/technical-document-authoring/SKILL.md).

### Reviewing a change

Two different questions about the same diff: `code-review` judges whether
the change itself is correct and well-designed, while `quality-assurance`
judges whether the verification behind it is adequate.

#### `code-review`

Reads a diff the way a reviewer would and reports only what holds up: ranked
severity, `file:line` evidence, a fix for each finding. See
[`SKILL.md`](./skills/code-review/SKILL.md).

#### `quality-assurance`

Asks whether a change was actually verified rather than merely written —
which checks ran, which were skipped, and what risk that leaves. See
[`SKILL.md`](./skills/quality-assurance/SKILL.md).

### Writing code that lasts

The lenses to run over code once it works: keeping it cheap to change
later, safe against input and dependencies you do not control, and legible
once it is running in production.

#### `code-maintainability`

Catches what makes code expensive later: parts bundled into one unit that
never belonged together, vague names, sprawling files, magic numbers, dead
code, and abstractions reached for too early. See
[`SKILL.md`](./skills/code-maintainability/SKILL.md).

#### `application-security`

An OWASP Top 10 lens for writing and reviewing alike — secrets, untrusted
input, injection, SSRF, access control, and what your dependencies drag in.
See [`SKILL.md`](./skills/application-security/SKILL.md).

#### `software-instrumentation`

Makes behavior visible once it is running: structured logs at the right
level, errors caught where they can be handled, and events worth tracking.
See [`SKILL.md`](./skills/software-instrumentation/SKILL.md).

### Testing

`unit-testing` and `end-to-end-testing` decide what is worth testing and at
what grain; `jest-testing` and `vitest-testing` are the runner mechanics
underneath either one, on Jest and Vitest respectively.

#### `unit-testing`

Fast, isolated tests written from the caller's side, so a refactor does not
break them and a bug does. See [`SKILL.md`](./skills/unit-testing/SKILL.md).

#### `end-to-end-testing`

Tests that drive the whole system like a real user — locators that do not
rot, no sleeps, and no live network. See
[`SKILL.md`](./skills/end-to-end-testing/SKILL.md).

#### `jest-testing`

The runner under the first two, on Jest 30: which API expresses a decision,
which option makes the suite find and transform your files, and which of
its silent failures explains a green run that tested nothing. See
[`SKILL.md`](./skills/jest-testing/SKILL.md).

#### `vitest-testing`

The runner underneath both, on Vitest 4: which option, which `vi` call,
which flag — what a version bump silently stopped reading, and how to drive
it without hanging on watch mode. See
[`SKILL.md`](./skills/vitest-testing/SKILL.md).

### Designing a UI

These skills follow one interface from grey-box layout through a real visual
design system to the component and stylesheet that implement it in React.

#### `wireframe-design`

Grey-box screens and flows, with a self-contained HTML kit, so layout gets
settled before anyone argues about color. See
[`SKILL.md`](./skills/wireframe-design/SKILL.md).

#### `high-fidelity-ui-design`

For when the greys become a real interface — semantic tokens, dark mode,
readable type, WCAG contrast, visible focus, and states for every way a
control can behave. See
[`SKILL.md`](./skills/high-fidelity-ui-design/SKILL.md).

#### `react-component-styling`

Builds that interface for real: which styles a component owns and which its
caller does, tokens that survive a theme swap, and surfaces that hold up at
any width, pointer, or gamut. See
[`SKILL.md`](./skills/react-component-styling/SKILL.md).

#### `react-component-development`

The component underneath the styling: how its files are laid out, what its
props promise, where its state lives, how a test reaches it, and when a
long list earns virtualizing. See
[`SKILL.md`](./skills/react-component-development/SKILL.md).

### Building an app

The framework- and library-specific group. These skills pin a version and state
it, so a rule that inverts on the next major is a rule you can see rather than
one you inherit.

#### `expo-app-development`

The Expo app around the components: where files live, how a URL becomes a
screen, what the native build contains, and how it reaches a device —
checked against the SDK the app actually has. See
[`SKILL.md`](./skills/expo-app-development/SKILL.md).

#### `next-app-development`

The framework layer under the components, on Next.js 16's App Router: which
code runs on the server, what reaches the browser, how data is fetched,
cached, and invalidated — and, for a reviewer, what each of those seams
looks like when it goes wrong. See
[`SKILL.md`](./skills/next-app-development/SKILL.md).

#### `tanstack-query-development`

The server state behind all of it, on TanStack Query v5: where a query
lives, what identifies it in the cache, when it refetches, what a write
invalidates, and how a failure surfaces — plus the review checks for each
of those going wrong. See
[`SKILL.md`](./skills/tanstack-query-development/SKILL.md).

#### `sentry-instrumentation`

The Sentry layer under all four: which package, which option, which file,
which token — what it is allowed to collect, how a minified frame gets a
name back, and which of its silent misconfigurations only surface during an
incident. See [`SKILL.md`](./skills/sentry-instrumentation/SKILL.md).

#### `amplitude-instrumentation`

The product-analytics vendor beside it: which Amplitude package, what
`init` fixes for good, how identity and sessions resolve, what autocapture
already collects, and which mistakes cost money. See
[`SKILL.md`](./skills/amplitude-instrumentation/SKILL.md).

#### `zod-schema`

The type layer over everything untrusted, on Zod 4: where the one parse
goes, why the schema makes the type rather than the other way round, how a
wire format is decoded and encoded back, which coercions quietly lie — and
what a passing parse still does not make safe. See
[`SKILL.md`](./skills/zod-schema/SKILL.md).

### Authoring skills

`agent-skill-authoring` writes a skill's content so an agent actually finds
and follows it; `agent-skill-management` decides where that skill lives, how
it is installed and refreshed, and what to do when one you do not own needs
a fix.

#### `agent-skill-authoring`

How to write a skill an agent will actually find and follow: framing,
frontmatter, discovery text, a validator that checks the structure, and an
audit that catches a cited vendor URL going 404. See
[`SKILL.md`](./skills/agent-skill-authoring/SKILL.md).

#### `agent-skill-management`

Where a skill's source belongs, how it gets installed and refreshed, a
check that fails when an installed copy drifts from it, and what to do when
you want to change one you do not own. See
[`SKILL.md`](./skills/agent-skill-management/SKILL.md).

## How this library evaluates its skills

A skill's usefulness has to be checked rather than assumed, and the checking
cannot be done by reading it. Evaluation in this space, where it exists at
all, tends to stop at a skill's textual properties — that it is shaped
correctly, not that it works. This library measures the skill outcome as
well: an evaluation scenario gives a model a real task inside a real
project, once with the skill under test installed and once without, and
checks the difference against declared, checkable expectations rather than a
generic "did anything change" signal. That is the axis worth comparing
libraries on — whether a skill's usefulness is _measured_ or merely
asserted.

See [`docs/specs/skill-evaluation.md`](./docs/specs/skill-evaluation.md) for
what skill evaluation is, why checking textual properties cannot reach it,
and the scenario model it describes, and
[`docs/operations/evaluation-dispatch.md`](./docs/operations/evaluation-dispatch.md)
for the instrument that runs it, by hand or through its own dispatch
workflow.

## Contributing

Development here is agent-assisted via
[Claude Code](https://claude.com/claude-code), working through this
repository's own change loop; see
[`docs/operations/development-workflow.md`](./docs/operations/development-workflow.md)
for the loop's stages and how it is wired here.

### Local setup

1. Install dependencies: `npm install`
2. Run the checks: `npm run check` — see [Commands](#commands) for what each
   one covers

There is no dev server — authoring a skill means editing Markdown under
[`skills/`](./skills) (or a skill root for a repository-local skill) and
reinstalling if it is distributable; see
[`docs/operations/agent-skills.md`](./docs/operations/agent-skills.md) for
that procedure and
[`docs/operations/agent-sessions.md`](./docs/operations/agent-sessions.md)
for how a Claude Code or Codex session starts here. The terms this repository
uses and the decisions that constrain it live in [`docs/`](./docs/index.md),
which is checked by the same suite.

| Area              | Tool                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------- |
| Language          | Markdown (with occasional JavaScript for scripting)                                   |
| Runtimes          | Claude Code and Codex                                                                 |
| Node              | 26, pinned in `package.json`'s `engines.node`, which CI reads via `node-version-file` |
| Package manager   | npm                                                                                   |
| Formatting        | Prettier                                                                              |
| Linting           | markdownlint-cli2                                                                     |
| Tests             | Vitest                                                                                |
| Link integrity    | `skills/agent-skill-authoring/scripts/check-links.mjs`                                |
| Skill structure   | `skills/agent-skill-authoring/scripts/check-skill-{frontmatter,body,references}.mjs`  |
| Installed copies  | `skills/agent-skill-management/scripts/check-installed-copies.mjs`                    |
| Obligation burden | `scripts/report-obligation-burden.mjs` (reports; never gates)                         |
| Skill evaluation  | `tools/evaluation/{probe,evaluate,derive}.mjs` (reports; never gates)                 |
| Rule duplication  | `scripts/report-skill-duplication.mjs` (reports; never gates)                         |
| Link freshness    | `skills/agent-skill-authoring/scripts/link-freshness/check.mjs` (scheduled)           |
| Project docs      | `skills/living-project-documentation/scripts/check-*.mjs` (five, over `docs/`)        |

### Commands

Verification is a format check, a Markdown lint, and a Vitest suite.
`npm run check` runs all three, and each gates a merge as its own parallel job in
[`merge-checks.yaml`](./.github/workflows/merge-checks.yaml). The suite is the
wide one — the `npm test` row says what it carries.

This table is the authoritative list of the repository's commands, for human
contributors and agents alike.

| Command                | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | When to run it                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`          | Installs the toolchain (Prettier, markdownlint-cli2, Vitest) pinned in `package.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Once per checkout, and after `package.json` changes.                                                                              |
| `npm run format`       | Rewrites Markdown, JSON, and YAML files in place with Prettier.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | After every set of edits, before committing.                                                                                      |
| `npm run format:check` | Reports formatting drift without rewriting anything; exits non-zero on drift.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | In CI, or to check formatting without touching the working tree.                                                                  |
| `npm run lint`         | Runs markdownlint-cli2 over every Markdown file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | After formatting, and fix every reported error before finishing.                                                                  |
| `npm run lint:fix`     | Repairs markdownlint's mechanically-fixable violations in place. Carries no glob of its own — pass a path or glob, e.g. `npm run lint:fix -- "skills/**/*.md"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | On a file with a mechanical violation `npm run lint` reports; a residual violation it cannot repair still needs an authoring fix. |
| `npm test`             | Runs the Vitest suite: the bundled validators against fixtures, this repository's own gate wiring, and — over this repository — the relative-link check, the skill-structure check (the three skill-structure checks over the source and the installed files), the installed-copy drift check, the evaluation instrument's own suite under `tests/evaluation/` (`probe.mjs`, `evaluate.mjs`, and `derive.mjs` run for real against a stored fixture, never a live model), the five `docs/` checks, and the marked-count check that holds a number in prose to the file it describes. Advisory `WARN` lines from the structure check never affect the outcome. | After changing any script, any `SKILL.md`, a reference file, or `docs/`.                                                          |
| `npm run check`        | The aggregate gate: format check, lint, then the test suite.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Before opening or updating a pull request.                                                                                        |

If a required command cannot be run, say so — naming the command, the reason,
and the residual risk — rather than presenting the change as fully verified.

Every command below runs from the source tier under [`skills/`](./skills) —
what the suite itself invokes; the installed roots go stale mid-edit. See
[`docs/conventions/directory-structure.md`](./docs/conventions/directory-structure.md)
for why each validator ships with the skill that owns it rather than living
here, and when a validator earns its place at all.

```bash
# This repository's own three gates, run over the whole tree by `npm test`:
node skills/agent-skill-authoring/scripts/check-links.mjs
node skills/agent-skill-authoring/scripts/check-skill-frontmatter.mjs --help
node skills/agent-skill-authoring/scripts/check-skill-body.mjs --help
node skills/agent-skill-authoring/scripts/check-skill-references.mjs --help
node skills/agent-skill-management/scripts/check-installed-copies.mjs skills .claude/skills

# Five more gate this repository's own docs/. They are one set,
# deliberately not one command: each answers for one kind of change, so an
# author who touched one document reads only its findings.
node skills/living-project-documentation/scripts/check-index.mjs docs
node skills/living-project-documentation/scripts/check-references.mjs docs
node skills/living-project-documentation/scripts/check-glossary.mjs docs
node skills/living-project-documentation/scripts/check-decision-naming.mjs docs
node skills/living-project-documentation/scripts/check-decision-supersede.mjs docs

# One more ships in a skill and this repository runs it too, from a schedule
# rather than a gate — see docs/conventions/verification-gates.md:
node skills/agent-skill-authoring/scripts/link-freshness/check.mjs --dry-run

# Three more ship inside a skill purely for the projects that install it — this
# repository exercises them only against fixtures:
node skills/conventional-commits/scripts/check-commit-message.mjs --help
node skills/wireframe-design/scripts/check-wireframe.mjs --help
node skills/github-operation/scripts/decode-sanitized-read.mjs --help
```

See [`docs/conventions/verification-gates.md`](./docs/conventions/verification-gates.md)
for what makes a check a gate, a report, or a scheduled audit, and the traps
each can fall into.

## Documentation

Everything else about this repository — its directory structure and skill
tiers, its verification gates, its `count:` marker, what a distributable
skill may not contain, how a change moves through the loop, installing and
refreshing a skill, how an agent session starts here, running `@claude
review`, dispatching an evaluation, its product specification, and its
decision log — lives under [`docs/`](./docs/index.md). Start at
[`docs/index.md`](./docs/index.md), which says which document holds what.
