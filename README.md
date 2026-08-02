# skills

An opinionated library of agent skills.

These are **agent skills** in the [agentskills.io](https://agentskills.io)
format — self-contained capabilities you install into a coding agent so it
plans, builds, reviews, and verifies work the way you want it done.
The <!-- count:distributable-skills -->twenty-six<!-- /count --> here cover the
whole arc: handling what the agent does not know, turning a request into a spec,
driving that spec to a reviewed pull request, keeping the code maintainable and
secure, testing it, designing and building its UI, standing up the application
around it and the server state behind it, writing the documents that explain it,
and authoring more skills. They install into any agent the
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

Every skill in the library, grouped by what you would reach for it to do. They
all install the same way, and every one of them has its source under
[`skills/`](./skills) — see [Authoring a skill](#authoring-a-skill) if you
contribute here.

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
| [`github-operation`](./skills/github-operation/SKILL.md)                                             | Keeps an agent's GitHub writes safe when it shares your login — one sanctioned channel, comments marked as its own, and history it never rewrites.                                         |

### Writing a document

Sits beside `product-requirement-document-authoring` rather than overlapping it:
that one owns a spec's sections and the phrasing of a requirement, this one owns
the sentences inside whatever document you are writing.

| Skill                                                                            | What it gives your agent                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`technical-document-authoring`](./skills/technical-document-authoring/SKILL.md) | Makes a design doc, RFC, ADR, runbook, or README worth reading: one document type instead of four blurred together, the answer at the top, sentences nobody has to reparse, and words a non-native reader gets on the first pass. |

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

| Skill                                                        | What it gives your agent                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`unit-testing`](./skills/unit-testing/SKILL.md)             | Fast, isolated tests written from the caller's side, so a refactor does not break them and a bug does.                                                                                |
| [`end-to-end-testing`](./skills/end-to-end-testing/SKILL.md) | Tests that drive the whole system like a real user — locators that do not rot, no sleeps, and no live network.                                                                        |
| [`vitest-testing`](./skills/vitest-testing/SKILL.md)         | The runner underneath both, on Vitest 4: which option, which `vi` call, which flag — what a version bump silently stopped reading, and how to drive it without hanging on watch mode. |

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

| Skill                                                                        | What it gives your agent                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`expo-app-development`](./skills/expo-app-development/SKILL.md)             | The Expo app around the components: where files live, how a URL becomes a screen, what the native build contains, and how it reaches a device — checked against the SDK the app actually has.                                                              |
| [`next-app-development`](./skills/next-app-development/SKILL.md)             | The framework layer under the components, on Next.js 16's App Router: which code runs on the server, what reaches the browser, how data is fetched, cached, and invalidated — and, for a reviewer, what each of those seams looks like when it goes wrong. |
| [`tanstack-query-development`](./skills/tanstack-query-development/SKILL.md) | The server state behind all of it, on TanStack Query v5: where a query lives, what identifies it in the cache, when it refetches, what a write invalidates, and how a failure surfaces — plus the review checks for each of those going wrong.             |
| [`sentry-instrumentation`](./skills/sentry-instrumentation/SKILL.md)         | The Sentry layer under all four: which package, which option, which file, which token — what it is allowed to collect, how a minified frame gets a name back, and which of its silent misconfigurations only surface during an incident.                   |
| [`amplitude-instrumentation`](./skills/amplitude-instrumentation/SKILL.md)   | The product-analytics vendor beside it: which Amplitude package, what `init` fixes for good, how identity and sessions resolve, what autocapture already collects, and which mistakes cost money — with a validator for the three that cost most.          |

### Authoring skills

| Skill                                                                | What it gives your agent                                                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [`agent-skill-authoring`](./skills/agent-skill-authoring/SKILL.md)   | How to write a skill an agent will actually find and follow: framing, frontmatter, discovery text, and a validator that checks the structure. |
| [`agent-skill-management`](./skills/agent-skill-management/SKILL.md) | Where a skill's source belongs, how it gets installed and refreshed, and what to do when you want to change one you do not own.               |

## How this library evaluates its skills

A skill only earns its place if an agent actually reaches for it at the right
moment. That is an **outcome**, and it is the part that is hard to check: it does
not follow from a skill being well-formed, and no amount of structural validation
will surface it. Nearly everything a tool can check cheaply is **form** —
frontmatter shape, section anatomy, link integrity, whether an installed copy
still matches its source. Every form check in this repository gates a merge, and
not one of them can tell you whether a skill _works_. A skill can be immaculately
structured and never get picked up, or get picked up for the wrong prompt.

**Evaluation in this space, where it exists at all, tends to stop at form** — that
a skill is shaped correctly, not that it works. This library measures the outcome
as well, and commits the measurements: the recorded results live in
[`evals/discovery/baseline.json`](./evals/discovery/baseline.json), so what the
measurement found is something you can read rather than take on trust. That is the
axis worth comparing libraries on — whether the discovery text is _measured_ or
merely asserted. It has already produced negative results about this library's own
skills, and those are recorded rather than quietly dropped, which is the entire
point of running it. Two tools do the measuring, and deliberately neither of them
gates.

**Does discovery surface the right skill?** An installed skill is found by its
`description`/`when_to_use` pair and nothing else, so that pair is what is worth
measuring. The discovery evaluation runs a fixture of labelled prompts through
the real Claude Code CLI in a scratch workspace and records which skills got
selected. Each prompt names the skills it should surface and the ones it should
not, and repeated runs of the same prompt give a distribution rather than a
single verdict, because selection is not deterministic. The assertion is plain
set membership — was this skill selected or not — so no model is ever asked to
grade another model's prose.

**The two directions are judged differently, on purpose.** A skill that should
surface has to appear **at least once** across the repeats: never appearing is a
miss, while appearing in a minority of runs is weak rather than broken. A skill
that should _not_ surface is only called spurious when it appears in **a
majority** of runs. That asymmetry is there because this library deliberately
labels skills that compete — `wireframe-design`, `high-fidelity-ui-design`, and
`react-component-styling` each disclaim the others in their own discovery text. A
prompt two of them could legitimately answer splits the distribution, so a
symmetric majority rule would report correct behaviour as a failure, and would do
it worst on exactly the cases that carry the most information. For a prompt
naming more than one acceptable skill, the report also prints how many runs
picked at least one of them — which is what tells healthy contention from a real
gap.

**A result is reported as a delta, not a score.** A bare number would say nothing
you could act on, so a run is expressed as the change against a recorded
baseline. That holds only while the baseline and the current run are comparable,
and there are two ways they stop being:

- **The model changed.** A result is not durable across models — it moves when a
  new model ships, with no change to this repository at all. The report
  suppresses the delta entirely and says why, rather than printing a comparison
  that looks meaningful and is not.
- **The corpus changed.** Every installed skill goes into the workspace, so a
  skill added — or an existing skill's discovery text rewritten — competes for
  the same selection whether or not the fixture names it. Here the report
  **marks** the affected comparisons as unattributable and still renders them,
  because a repository that ships skill edits weekly would otherwise have a
  permanently unusable baseline.

**The corpus fingerprint covers only what discovery reads.** The baseline records
a short digest of each skill's `description` and `when_to_use` and nothing else,
so editing a skill's body never invalidates a measurement, and a rename shows up
as one removal plus one addition. When the corpus matches, the report says
nothing at all — a notice that fires on every run is one that gets skipped on the
run that matters.

**A finding carries the prior it is measured against.** A verdict alone cannot
tell a marginal result from a broken one: a miss fires at zero selections, so a
skill that genuinely sits at one run in five draws zero about a third of the time
and reports a finding that is noise. Every finding therefore states what the
baseline recorded, and — where that baseline fingerprinted its corpus — the
chance of a result at least this extreme had the rate not moved, integrating over
the uncertainty in a rate measured from a handful of probes. Where the repeat
counts make the question unanswerable in principle, the line says **that**
instead of a verdict that was never in doubt; and where the baseline recorded
nothing, no prior is invented.

**Whether repeats are independent is now measurable.** Every such probability
assumes a case's probes are independent draws from a fixed rate, and until now
nothing had checked it — they run in sequence against a warm prompt cache, so
they may cluster. A determinism mode repeats one case against an unchanged corpus
and reports whether they do. It has not been run yet, so nothing here claims a
measured noise floor.

**The second tool measures cost instead of outcome.** It answers "how many rules
is an agent holding right now?" — the concurrent RFC-2119 obligation count across
a set of skills, as a **range**: the floor when only the `SKILL.md` bodies are
read, and the ceiling once every reference file is read too. It defines **no
threshold** and never fails. There is no evidence for a defensible limit in this
corpus yet, and a threshold nobody can defend becomes either a rule people route
around or a warning people stop reading.

**Neither tool gates, and that is deliberate.** The discovery evaluation is
non-deterministic, it costs real money every run, and it needs a secret that fork
pull requests never receive — and a flaky merge gate gets bypassed or deleted
rather than fixed. The obligation report has no threshold to gate on in the first
place. Neither belongs to an npm script, a workflow gate, or a hook, and a test
keeps both out of the enforced set, so wiring either one in has to be a
deliberate act rather than an accident.

**What the measurement cannot tell you** is worth knowing before you trust it:

- **One turn per probe.** It captures what discovery selects immediately, so
  repeats give a distribution rather than a set of skills used together.
- **The fixture is a judgment product.** A wrong label produces a "finding" that
  is really a labelling error — which is why every case carries a written
  rationale a human can disagree with without reading code.
- **The evaluation workspace carries no `CLAUDE.md`.** This repository's own
  working agreement mandates skills in every session, so measuring inside this
  checkout would measure that agreement instead of discovery, and would do it
  silently.
- **The workspace does not bound what the CLI loads.** A machine's own skills,
  and whatever a managed environment injects, compete in every probe alongside
  the installed corpus. A run strips the tier it can and **records** the rest, so
  a recorded baseline says what it ran against — and a run that could not isolate
  itself refuses to produce one at all.
- **A universal-application claim is informational for now.** A skill can claim
  in its own `when_to_use` that it applies to every session; whether that holds
  under a one-turn measurement is an open question, so a shortfall is reported
  rather than counted as a finding.

[`evals/discovery/README.md`](./evals/discovery/README.md) carries the fixture
format, the exact verdict table, the known limits in full, and when to re-record
the baseline. [Reporting, not gating](#reporting-not-gating) has the commands for
both tools.

## Contributing

Development here is agent-assisted via
[Claude Code](https://claude.com/claude-code). The working agreement lives in
[`CLAUDE.md`](./CLAUDE.md) and routes to the detailed skills under
[`.claude/skills/`](./.claude/skills). Every change goes through the same loop —
**plan → approve → code → verify → independent review → address → ready** —
stepped through under
[Delivering a unit of work end-to-end](#delivering-a-unit-of-work-end-to-end).
Working without an agent does not lower the bar: branch, implement, run the
[checks](#commands), open a pull request following
[the template](./.github/pull_request_template.md), and get it reviewed before
merge.

### Local setup

1. Install dependencies: `npm install`
2. Run the checks: `npm run check` — see [Commands](#commands) for what each
   one covers

There is no dev server — authoring a skill means editing Markdown under
[`skills/`](./skills) (or `.claude/skills/` for a repository-local skill),
reinstalling if it is distributable, and running `npm run check`. In a Claude
Code cloud session,
[`.claude/hooks/session-start.sh`](./.claude/hooks/session-start.sh) installs
dependencies (activating a Node version manager if one is present); the opt-in
format-on-edit and check-before-stop hooks are materialized from
[`.claude/settings.local-example.json`](./.claude/settings.local-example.json).

| Area             | Tool                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------- |
| Language         | Markdown (with occasional JavaScript for scripting)                                   |
| Runtime          | Claude Code                                                                           |
| Node             | 26, pinned in `package.json`'s `engines.node`, which CI reads via `node-version-file` |
| Package manager  | npm                                                                                   |
| Formatting       | Prettier                                                                              |
| Linting          | markdownlint-cli2                                                                     |
| Tests            | Vitest                                                                                |
| Link integrity   | `skills/agent-skill-authoring/scripts/check-links.mjs`                                |
| Skill structure  | `skills/agent-skill-authoring/scripts/check-skill.mjs`                                |
| Installed copies | `scripts/check-installed-copies.mjs`                                                  |
| Obligation load  | `scripts/report-obligation-load.mjs` (reports; never gates)                           |
| Skill discovery  | `scripts/discovery-eval/run.mjs` (reports; never gates)                               |
| Rule duplication | `scripts/report-skill-duplication.mjs` (reports; never gates)                         |

### Commands

Verification is a format check, a Markdown lint, and a Vitest suite.
`npm run check` runs all three, and each gates a merge as its own parallel job in
[`merge-checks.yaml`](./.github/workflows/merge-checks.yaml). The suite is the
wide one — the `npm test` row says what it carries.

This table is the authoritative list of the repository's commands, for human
contributors and agents alike.

| Command                | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                          | When to run it                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm install`          | Installs the toolchain (Prettier, markdownlint-cli2, Vitest) pinned in `package.json`.                                                                                                                                                                                                                                                                                                                                                                | Once per checkout, and after `package.json` changes.             |
| `npm run format`       | Rewrites Markdown, JSON, and YAML files in place with Prettier.                                                                                                                                                                                                                                                                                                                                                                                       | After every set of edits, before committing.                     |
| `npm run format:check` | Reports formatting drift without rewriting anything; exits non-zero on drift.                                                                                                                                                                                                                                                                                                                                                                         | In CI, or to check formatting without touching the working tree. |
| `npm run lint`         | Runs markdownlint-cli2 over every Markdown file.                                                                                                                                                                                                                                                                                                                                                                                                      | After formatting, and fix every reported error before finishing. |
| `npm test`             | Runs the Vitest suite: the bundled validators against fixtures, this repository's own gate wiring, and — over this repository — the relative-link check, the skill-structure check (`check-skill.mjs` over both roots, with the Claude Code field opt-in), the installed-copy drift check, and the marked-count check that holds a number in prose to the file it describes. Advisory `WARN` lines from the structure check never affect the outcome. | After changing any script, any `SKILL.md`, or a reference file.  |
| `npm run check`        | The aggregate gate: format check, lint, then the test suite.                                                                                                                                                                                                                                                                                                                                                                                          | Before opening or updating a pull request.                       |

If a required command cannot be run, say so — naming the command, the reason,
and the residual risk — rather than presenting the change as fully verified.

Each validator is also a standalone CLI with `--help`, so a single check can run
without the suite. Run them from the source tier under [`skills/`](./skills) —
what the suite itself invokes; the `.claude/skills/` copies go stale mid-edit.

```bash
# This repository's own three gates, run over the whole tree by `npm test`:
node skills/agent-skill-authoring/scripts/check-links.mjs
node skills/agent-skill-authoring/scripts/check-skill.mjs --help
node scripts/check-installed-copies.mjs

# Six more ship inside a skill, for the projects that install it — this
# repository exercises them only against fixtures:
node skills/amplitude-instrumentation/scripts/check-amplitude-wiring.mjs --help
node skills/conventional-commits/scripts/check-commit-message.mjs --help
node skills/end-to-end-testing/scripts/scenario-coverage-gate.mjs --help
node skills/react-component-styling/scripts/check-component-styles.mjs --help
node skills/sentry-instrumentation/scripts/check-sentry-wiring.mjs --help
node skills/wireframe-design/scripts/check-wireframe.mjs --help
```

#### Reporting, not gating

The <!-- count:first-reporting-tool-ordinal -->tenth<!-- /count -->,
the <!-- count:second-reporting-tool-ordinal -->eleventh<!-- /count -->, and
the <!-- count:third-reporting-tool-ordinal -->twelfth<!-- /count --> scripts
report instead of judging. None belongs to a gate, an npm script, or a hook, and
`tests/repository/reporting-tools.test.mjs` keeps all three out of the enforced
set on purpose, so wiring any of them in has to be a deliberate act.

The <!-- count:first-reporting-tool-ordinal -->tenth<!-- /count --> reports a
number:

```bash
node scripts/report-obligation-load.mjs --mandated
node scripts/report-obligation-load.mjs --help
```

`report-obligation-load.mjs` answers "how many rules is an agent holding right
now?" — the concurrent RFC-2119 obligation count across a set of skills, as a
**range**: the floor those skills cost with only their `SKILL.md` bodies read,
and the ceiling once every `references/*.md` is read too. Pass skills by path,
by name, or via `--mandated` for the always-on set [`CLAUDE.md`](./CLAUDE.md)
requires in every session. It reads the obligation definition from the same
module `check-skill.mjs` does, so the two never disagree about what a rule is.

It defines **no threshold** and never fails: it exits 0 on every valid
invocation however large the numbers. There is no evidence for a defensible
limit in this corpus yet, and a threshold nobody can defend becomes either a
rule people route around or a warning people stop reading.

The <!-- count:second-reporting-tool-ordinal -->eleventh<!-- /count --> reports a
routing outcome:

```bash
node scripts/discovery-eval/run.mjs --dry-run
node scripts/discovery-eval/run.mjs --help
```

`scripts/discovery-eval/run.mjs` answers "does a prompt actually surface the
right skills?" — the first check here that measures an **outcome** rather than
form. It runs a labelled prompt fixture through the real Claude Code CLI in a
scratch workspace and reports which expected skills were missed and which
unexpected ones fired, as a delta against a recorded baseline. It cannot gate
for three independent reasons: it is non-deterministic, it costs real money per
run (`--dry-run` prints the current estimate), and it needs a secret that fork
pull requests do not receive.

Run it in CI from the Actions tab by dispatching
[`discovery-eval.yaml`](./.github/workflows/discovery-eval.yaml) — the only
workflow allowed to invoke it, and **manual dispatch is its only trigger**, so
nothing a pull request does can start it or spend money. Give the dispatch a
pull request number to evaluate that branch's changed skills and have the report
posted as a comment; leave it blank to evaluate the default branch and read the
report in the job log. Check `emit_baseline` — which no dispatch naming a pull
request may combine with — to have the run also produce a proposed baseline as a
downloadable artifact, which is how the baseline gets re-recorded without a local
CLI or local credentials. Give it a case id in `determinism` instead to repeat
that one case against an unchanged corpus and measure whether its probes behave
as independent draws; that combines with a pull request but not with
`emit_baseline`, since one case cannot produce a fixture-wide document.
`--dry-run` validates the fixture with no model call and
no secret. See
[`evals/discovery/README.md`](./evals/discovery/README.md) for the fixture
format, how a verdict is reached, and how to re-record the baseline.

`npm test` reads the two JSON files under `evals/discovery/` to confirm every
skill they name still exists, and that every fixture case is either measured or
declared unmeasured — a deterministic data check that never invokes the runner.
A fixture or baseline naming a renamed skill would otherwise rot in silence.

The <!-- count:third-reporting-tool-ordinal -->twelfth<!-- /count --> reports a
ranking:

```bash
node scripts/report-skill-duplication.mjs
node scripts/report-skill-duplication.mjs --help
```

`report-skill-duplication.mjs` answers "which rule is stated in more than one
skill?" — a question `check-skill.mjs` structurally cannot ask, because it
validates one skill directory at a time and is host-agnostic. Two rules are
compared as sets of content words, cross-skill only, and every pair above the
similarity floor is listed with both `file:line` sites and both rules in full.
It reads the obligation definition from the same module `check-skill.mjs` does,
so the three tools never disagree about what a rule is.

Its reason for never gating is the strongest of the three, and it is not a
missing threshold: **the defect is not decidable from the text.**
[`scoping-and-mece.md`](./skills/agent-skill-authoring/references/scoping-and-mece.md)'s
Portable Source Exception lets a self-contained distributable skill restate a
rule another skill owns, and every skill here is distributable — so two
identical bullets may be one rule with two sources of truth (which
[`REVIEW.md`](./REVIEW.md) rates Major) or a portable skill standing on its own
(which is correct). Only intent separates them, and intent is not in the corpus.
The ranking is a place to look; a human decides.

### Repository gotchas

There are <!-- count:repository-gotchas -->six<!-- /count --> things about this
repository worth knowing before changing it.

**Some dependencies move fast enough that memory is unreliable.** Consult the
current official docs before changing behavior these govern:

| Dependency                   | Refresh docs before changing                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Claude Code                  | Skill format and frontmatter, hook and settings configuration, slash-command behavior, MCP configuration |
| markdownlint-cli2 / Prettier | Lint and format configuration, suppression syntax, rule names                                            |
| Vitest                       | Suite configuration, runner and matcher APIs, CLI flags                                                  |

**Some files fail globally rather than locally.** A small mismatch in one of
these breaks skill discovery or the verification gate outright, not just one
rendered page — so refresh the owning tool's docs before editing one:

- **Claude Code** — any `SKILL.md` frontmatter, `.claude/settings*.json`, and
  the hooks under `.claude/hooks/`.
- **markdownlint-cli2 / Prettier** — `.markdownlint-cli2.jsonc`,
  `.prettierrc.json`, and `.prettierignore`.
- **Vitest** — `vitest.config.mjs`, which every gate inside `npm test` runs
  through.
- **The gate set itself** — `package.json`'s `check` chain and
  [`merge-checks.yaml`](./.github/workflows/merge-checks.yaml)'s jobs.

That last pair is only half the problem. The enforced-gate set lives in **four**
places — those two, the commands table above, and [`REVIEW.md`](./REVIEW.md)'s
do-not-report list — and all four must agree or CI quietly stops enforcing
something the documentation still claims it does.
`tests/repository/gate-consistency.test.mjs` ties the first two mechanically:
add a gate to one, forget the other, and the suite fails. The two prose copies
are tied to nothing, so changing the gate set means editing this file and
`REVIEW.md` by hand — and a reviewer checking that you did.

**Session telemetry is tagged here, and cannot be checked from inside a
session.** [`.claude/settings.json`](./.claude/settings.json) carries an `env`
block stamping `repository=skills` and the session's launch surface onto the
OpenTelemetry metrics Claude Code exports, so this repository's usage separates
from every other repository sharing an account or a cloud environment. It
configures nothing else — no endpoint, no credential, no
`CLAUDE_CODE_ENABLE_TELEMETRY` — so a contributor who has never set telemetry up
sees no behavior change from it. Verifying a change to that block is the catch:
Claude Code does not pass `OTEL_*` variables to the subprocesses it spawns, so
`echo $OTEL_RESOURCE_ATTRIBUTES` inside a session prints nothing even when the
exporter holds the value. Confirm it in the metrics backend instead, against a
session started _after_ the change — an already-running session read its
configuration at startup.

**A number in prose can be a checked claim.** Wrap one in a `count:` marker and
`npm test` holds it to the file it describes — the skill count at the top of
this page, the round cap it quotes from a skill, the empty tallies in the
discovery baseline. The marker is invisible once rendered:

```markdown
The <!-- count:distributable-skills -->twenty-six<!-- /count --> here cover the
whole arc.
```

Each key is registered in
[`tests/repository/documented-counts.mjs`](./tests/repository/documented-counts.mjs)
alongside the derivation that proves it, and the failure names the file, the
claim, the truth, and what else moves with the number. Three rules the check
enforces:

- **A marker sits inline, whole, on one line, and never at the start of one.** A
  line beginning with `<!--` is an HTML block in CommonMark, so a marker placed
  there splits the paragraph in two.
- **A marker never appears in a distributable skill.** Those install into other
  people's projects, where the derivation names files that do not exist.
- **A registered key with no marker fails**, so a derivation cannot outlive the
  sentence it was written for.

Marking is opt-in, which is the deliberate limit: a number nobody wrapped still
drifts silently, and stays a reviewer's job. Grepping prose for digits was the
alternative, and it both misses a count spelled as a word and fires on every
unrelated number. Note that a marker is only invisible in _prose_ — inside a
fenced block it renders as text, so a code sample a reader copies carries none
(the sample above is a real, checked claim, which is why it has one).

**The installed skill copies are generated, not source.** The distributable
skills under [`skills/`](./skills) are the source of truth, and their copies
under `.claude/skills/` are produced by `npx skills`. Edit the source and
reinstall — a hand-edit to an installed copy is silently discarded by the next
install. The installed-copy check inside `npm test` fails on any mismatch, so a
forgotten reinstall is caught before merge rather than discovered later. Every
skill is in scope for it; the repository-local tier that the check exempts is
currently empty.

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

### Authoring a skill

Skills live in two tiers. Every skill here is currently **distributable**: its
source is [`skills/<name>/SKILL.md`](./skills) (with any `references/` and
`scripts/` beside it), and the installed copies under `.claude/skills/` are
generated from it with the
[vercel-labs/skills](https://github.com/vercel-labs/skills) CLI:

```bash
npx skills add ./skills --agent claude-code --skill '*' --yes --copy
```

Commit the regenerated `.claude/skills/<name>/` copies and `skills-lock.json`
alongside the source — they are tracked artifacts, not build output to ignore.

The second tier is **repository-local**: a skill that encodes conventions
specific to this repository would have its source committed directly under
[`.claude/skills/`](./.claude/skills), hand-edited in place, and never touched
by the CLI or listed in `skills-lock.json`. No skill is in that tier today —
`github-operation` was the last one and is now distributable — so the tier is
available rather than in use. Registering one means adding its name to
`REPOSITORY_LOCAL` in
[`scripts/check-installed-copies.mjs`](./scripts/check-installed-copies.mjs),
which otherwise treats an installed skill with no source as drift.

[Agent Skill Management](./skills/agent-skill-management/SKILL.md) covers which
tier a new skill belongs to and the full install, lockfile, and
refresh-and-verify workflow;
[Agent Skill Authoring](./skills/agent-skill-authoring/SKILL.md) covers how to
write the skill itself. Both are in the catalog above, so you can install them
into your own project too.

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
   thread to the resolving commit, for up
   to <!-- count:address-review-round-cap -->eight<!-- /count --> rounds.
5. **Ready** — flips the pull request to ready once CI is green and the review
   is clean. Merging always stays a human decision.

Kick it off by naming the work — "deliver issue #42", "pick up PR 57", or a
free-form request (with no issue yet, it files a tracking issue first, then
delivers it). To approve a paused plan or resume after a question, continue the
session and tell it to continue.

One check backs the loop from outside any session:
[`branch-governance-audit.yaml`](./.github/workflows/branch-governance-audit.yaml)
sweeps hourly and flags any `claude/` branch pushed ahead of the default branch
with no open pull request — work delivered outside the loop, and so never
independently reviewed. It is deliberately a scheduled sweep rather than a
push-triggered gate, because step 2 legitimately pushes before step 3 opens the
pull request; a grace window skips a branch whose latest commit is still fresh.

### `@claude review` — get findings on any PR

Comment **`@claude review`** on a pull request to run this repository's review
policy ([`REVIEW.md`](./REVIEW.md)) — severity-tagged findings with `file:line`
evidence and concrete fixes, posted as inline comments by the CI reviewer
([`claude-review.yaml`](./.github/workflows/claude-review.yaml)). Use it for a
pre-merge check on a hand-written change or a second opinion before merging. It
is the same reviewer the change loop relies on: step 3 above requests it by
posting that comment itself, so no review starts without one.

Two things make it stay silent. It answers **repository owners, members, and
collaborators only**, gating on the commenting author's association and skipping
everyone else — so an outside contributor's request looks like nothing happened
at all. And it is inert everywhere until a one-time operator setup is done:
install the [Claude GitHub App](https://github.com/apps/claude) and add a
`CLAUDE_CODE_OAUTH_TOKEN` repository secret (generate it with
`claude setup-token`), or set an `ANTHROPIC_API_KEY` secret for pay-as-you-go
billing. See the header of
[`claude-review.yaml`](./.github/workflows/claude-review.yaml) for details.

A third pair of names is optional, and telemetry stays off until you add it.
Set the repository variable `CLAUDE_OTEL_EXPORTER_OTLP_ENDPOINT` and the
repository secret `CLAUDE_OTEL_EXPORTER_OTLP_HEADERS`, and every review session
exports its Claude Code metrics and events to that OTLP collector; leave them
unset and the workflow disables telemetry outright rather than starting an
exporter that fails, so the reviewer behaves exactly as it does today. The
`CLAUDE_` prefix is deliberate: a project cloning this workflow may already keep
`OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` for its own
application telemetry, and neither configuration should overwrite the other.
Scope the ingestion token to writing metrics and logs and nothing else — the
reviewer is allowed broad `Bash`, so it can read any value the job holds.
