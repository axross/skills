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

| Skill                                                              | What it gives your agent                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`professional-behavior`](./skills/professional-behavior/SKILL.md) | Keeps it honest about what it actually knows — looking things up instead of guessing, checking current sources instead of trusting memory, asking you instead of deciding for you, and reporting back so you can tell which is which. |

### Delivering a change

| Skill                                                                                                | What it gives your agent                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`loop-engineering`](./skills/loop-engineering/SKILL.md)                                             | Runs a whole change for you — plan, build, verify, fix — pausing for your sign-off before it writes any code, and handing the review to a separate session so it never approves itself.    |
| [`product-requirement-document-authoring`](./skills/product-requirement-document-authoring/SKILL.md) | Turns a vague ask into a spec someone can build from and check against, with acceptance criteria that are actually verifiable.                                                             |
| [`software-development`](./skills/software-development/SKILL.md)                                     | The baseline every project-touching task runs on: keep the change scoped, format and lint it, find out how the project is really run, and describe the result so a reviewer can follow it. |
| [`conventional-commits`](./skills/conventional-commits/SKILL.md)                                     | One header contract for commit messages and pull request titles, with a validator that catches a malformed header before it reaches your history.                                          |
| [`github-operation`](./skills/github-operation/SKILL.md)                                             | Keeps an agent's GitHub writes safe when it shares your login — a default channel with a bounded fallback, comments marked as its own, and history it never rewrites.                      |

### Writing a document

Three skills divide the same territory by tense and by grain, so none of them
overlaps the others. `product-requirement-document-authoring` owns the **diff** —
a spec's sections and the phrasing of a requirement about to be built.
`living-project-documentation` owns the **steady state** — the documents that say
what the project is and how it works now, and the mechanism that corrects them
when a change makes them wrong. `technical-document-authoring` owns the
**sentences** inside whatever you are writing.

| Skill                                                                            | What it gives your agent                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`living-project-documentation`](./skills/living-project-documentation/SKILL.md) | Keeps the docs that describe your project true: read before planning, corrected in the change that made them wrong, with decisions superseded rather than edited — and five small validators for the rot a reader cannot see.     |
| [`technical-document-authoring`](./skills/technical-document-authoring/SKILL.md) | Makes a design doc, RFC, ADR, runbook, or README worth reading: one document type instead of four blurred together, the answer at the top, sentences nobody has to reparse, and words a non-native reader gets on the first pass. |

### Reviewing a change

| Skill                                                      | What it gives your agent                                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`code-review`](./skills/code-review/SKILL.md)             | Reads a diff the way a reviewer would and reports only what holds up: ranked severity, `file:line` evidence, a fix for each finding.      |
| [`quality-assurance`](./skills/quality-assurance/SKILL.md) | Asks whether a change was actually verified rather than merely written — which checks ran, which were skipped, and what risk that leaves. |

### Writing code that lasts

| Skill                                                                    | What it gives your agent                                                                                                                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`code-maintainability`](./skills/code-maintainability/SKILL.md)         | Catches what makes code expensive later: parts bundled into one unit that never belonged together, vague names, sprawling files, magic numbers, dead code, and abstractions reached for too early. |
| [`application-security`](./skills/application-security/SKILL.md)         | An OWASP Top 10 lens for writing and reviewing alike — secrets, untrusted input, injection, SSRF, access control, and what your dependencies drag in.                                              |
| [`software-instrumentation`](./skills/software-instrumentation/SKILL.md) | Makes behavior visible once it is running: structured logs at the right level, errors caught where they can be handled, and events worth tracking.                                                 |

### Testing

| Skill                                                        | What it gives your agent                                                                                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`unit-testing`](./skills/unit-testing/SKILL.md)             | Fast, isolated tests written from the caller's side, so a refactor does not break them and a bug does.                                                                                                             |
| [`end-to-end-testing`](./skills/end-to-end-testing/SKILL.md) | Tests that drive the whole system like a real user — locators that do not rot, no sleeps, and no live network.                                                                                                     |
| [`jest-testing`](./skills/jest-testing/SKILL.md)             | The runner under the first two, on Jest 30: which API expresses a decision, which option makes the suite find and transform your files, and which of its silent failures explains a green run that tested nothing. |
| [`vitest-testing`](./skills/vitest-testing/SKILL.md)         | The runner underneath both, on Vitest 4: which option, which `vi` call, which flag — what a version bump silently stopped reading, and how to drive it without hanging on watch mode.                              |

### Designing a UI

| Skill                                                                          | What it gives your agent                                                                                                                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`wireframe-design`](./skills/wireframe-design/SKILL.md)                       | Grey-box screens and flows, with a self-contained HTML kit, so layout gets settled before anyone argues about color.                                                                  |
| [`high-fidelity-ui-design`](./skills/high-fidelity-ui-design/SKILL.md)         | For when the greys become a real interface — semantic tokens, dark mode, readable type, WCAG contrast, visible focus, and states for every way a control can behave.                  |
| [`react-component-styling`](./skills/react-component-styling/SKILL.md)         | Builds that interface for real: which styles a component owns and which its caller does, tokens that survive a theme swap, and surfaces that hold up at any width, pointer, or gamut. |
| [`react-component-development`](./skills/react-component-development/SKILL.md) | The component underneath the styling: how its files are laid out, what its props promise, where its state lives, how a test reaches it, and when a long list earns virtualizing.      |

### Building an app

The framework- and library-specific group. These skills pin a version and state
it, so a rule that inverts on the next major is a rule you can see rather than
one you inherit.

| Skill                                                                        | What it gives your agent                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`expo-app-development`](./skills/expo-app-development/SKILL.md)             | The Expo app around the components: where files live, how a URL becomes a screen, what the native build contains, and how it reaches a device — checked against the SDK the app actually has.                                                                                |
| [`next-app-development`](./skills/next-app-development/SKILL.md)             | The framework layer under the components, on Next.js 16's App Router: which code runs on the server, what reaches the browser, how data is fetched, cached, and invalidated — and, for a reviewer, what each of those seams looks like when it goes wrong.                   |
| [`tanstack-query-development`](./skills/tanstack-query-development/SKILL.md) | The server state behind all of it, on TanStack Query v5: where a query lives, what identifies it in the cache, when it refetches, what a write invalidates, and how a failure surfaces — plus the review checks for each of those going wrong.                               |
| [`sentry-instrumentation`](./skills/sentry-instrumentation/SKILL.md)         | The Sentry layer under all four: which package, which option, which file, which token — what it is allowed to collect, how a minified frame gets a name back, and which of its silent misconfigurations only surface during an incident.                                     |
| [`amplitude-instrumentation`](./skills/amplitude-instrumentation/SKILL.md)   | The product-analytics vendor beside it: which Amplitude package, what `init` fixes for good, how identity and sessions resolve, what autocapture already collects, and which mistakes cost money.                                                                            |
| [`zod-schema`](./skills/zod-schema/SKILL.md)                                 | The type layer over everything untrusted, on Zod 4: where the one parse goes, why the schema makes the type rather than the other way round, how a wire format is decoded and encoded back, which coercions quietly lie — and what a passing parse still does not make safe. |

### Authoring skills

| Skill                                                                | What it gives your agent                                                                                                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`agent-skill-authoring`](./skills/agent-skill-authoring/SKILL.md)   | How to write a skill an agent will actually find and follow: framing, frontmatter, discovery text, a validator that checks the structure, and an audit that catches a cited vendor URL going 404. |
| [`agent-skill-management`](./skills/agent-skill-management/SKILL.md) | Where a skill's source belongs, how it gets installed and refreshed, a check that fails when an installed copy drifts from it, and what to do when you want to change one you do not own.         |

## How this library evaluates its skills

A skill's usefulness has to be checked rather than assumed, and the checking
cannot be done by reading it. Evaluation in this space, where it exists at
all, tends to stop at a skill's textual properties — that it is shaped
correctly, not that it works. This library measures the skill outcome as
well, and commits the measurements: every probe's verbatim transcript lives
under [`tools/evaluation/data/discovery/`](./tools/evaluation/data/discovery/README.md) and
[`tools/evaluation/data/effect/`](./tools/evaluation/data/effect/README.md), so what the measurement
found is something you can read rather than take on trust. That is the axis
worth comparing libraries on — whether the discovery text is _measured_ or
merely asserted. It has already produced negative results about this
library's own skills, and those are recorded rather than quietly dropped,
which is the entire point of running it.

See [`docs/specs/skill-evaluation.md`](./docs/specs/skill-evaluation.md) for
what skill evaluation is, why checking textual properties cannot reach it,
and what each of the two instruments answers, and
[`docs/operations/evaluation-dispatch.md`](./docs/operations/evaluation-dispatch.md)
for how to run either one.

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
| Skill discovery   | `tools/evaluation/readings/discovery/evaluate.mjs` (reports; never gates)             |
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

| Command                | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | When to run it                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm install`          | Installs the toolchain (Prettier, markdownlint-cli2, Vitest) pinned in `package.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Once per checkout, and after `package.json` changes.                     |
| `npm run format`       | Rewrites Markdown, JSON, and YAML files in place with Prettier.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | After every set of edits, before committing.                             |
| `npm run format:check` | Reports formatting drift without rewriting anything; exits non-zero on drift.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | In CI, or to check formatting without touching the working tree.         |
| `npm run lint`         | Runs markdownlint-cli2 over every Markdown file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | After formatting, and fix every reported error before finishing.         |
| `npm test`             | Runs the Vitest suite: the bundled validators against fixtures, this repository's own gate wiring, and — over this repository — the relative-link check, the skill-structure check (the three skill-structure checks over the source and the installed files), the installed-copy drift check, the discovery-evaluation summary drift check and its declared-patch check, the five `docs/` checks, and the marked-count check that holds a number in prose to the file it describes. Advisory `WARN` lines from the structure check never affect the outcome. | After changing any script, any `SKILL.md`, a reference file, or `docs/`. |
| `npm run check`        | The aggregate gate: format check, lint, then the test suite.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Before opening or updating a pull request.                               |

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
