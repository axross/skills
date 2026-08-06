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
| [`github-operation`](./skills/github-operation/SKILL.md)                                             | Keeps an agent's GitHub writes safe when it shares your login — a default channel with a bounded fallback, comments marked as its own, and history it never rewrites.                      |

### Writing a document

Three skills divide the same territory by tense and by grain, so none of them
overlaps the others. `product-requirement-document-authoring` owns the **diff** —
a spec's sections and the phrasing of a requirement about to be built.
`living-product-specification` owns the **steady state** — the documents that say
what the product is now, and the mechanism that corrects them when a change makes
them wrong. `technical-document-authoring` owns the **sentences** inside whatever
you are writing.

| Skill                                                                            | What it gives your agent                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`living-product-specification`](./skills/living-product-specification/SKILL.md) | Keeps the docs that describe your product true: read before planning, corrected in the change that made them wrong, with decisions superseded rather than edited — and five small validators for the rot a reader cannot see.     |
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
cannot be done by reading it.

**Evaluation in this space, where it exists at all, tends to stop at form** —
that a skill is shaped correctly, not that it works. This library measures the
outcome as well, and commits the measurements: the recorded results live in
[`evals/discovery/baseline.json`](./evals/discovery/baseline.json), so what the
measurement found is something you can read rather than take on trust. That is
the axis worth comparing libraries on — whether the discovery text is _measured_
or merely asserted. It has already produced negative results about this
library's own skills, and those are recorded rather than quietly dropped, which
is the entire point of running it.

Two instruments do the measuring.
[`docs/specs/skill-evaluation.md`](./docs/specs/skill-evaluation.md) explains
what skill evaluation is, why form checking cannot reach it, and what each
instrument answers. [`evals/discovery/README.md`](./evals/discovery/README.md)
carries the discovery instrument itself — the fixture format, how a verdict is
reached, when to re-record the baseline, and the limits of what a run can
conclude. [Reporting, not gating](#reporting-not-gating) has the commands for
both.

## Contributing

Development here is agent-assisted via
[Claude Code](https://claude.com/claude-code). The working agreement lives in
[`CLAUDE.md`](./CLAUDE.md) and routes to the detailed skills under
[`skills/`](./skills). Every change goes through the same loop —
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
[`skills/`](./skills) (or a skill root for a repository-local skill),
reinstalling if it is distributable, and running `npm run check`. The terms this
repository uses and the decisions that constrain it live in
[`docs/`](./docs/index.md), which is checked by the same suite. In a Claude
Code cloud session,
[`.claude/hooks/session-start.sh`](./.claude/hooks/session-start.sh) installs
dependencies (activating a Node version manager if one is present); the opt-in
format-on-edit and check-before-stop hooks are materialized from
[`.claude/settings.local-example.json`](./.claude/settings.local-example.json).
A Codex session runs the same session-start and check scripts through
[`.codex/hooks.json`](./.codex/hooks.json); format-on-edit is not wired there,
because `format.sh` reads the edited path from a Claude Code payload field.

| Area             | Tool                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------- |
| Language         | Markdown (with occasional JavaScript for scripting)                                   |
| Runtimes         | Claude Code and Codex                                                                 |
| Node             | 26, pinned in `package.json`'s `engines.node`, which CI reads via `node-version-file` |
| Package manager  | npm                                                                                   |
| Formatting       | Prettier                                                                              |
| Linting          | markdownlint-cli2                                                                     |
| Tests            | Vitest                                                                                |
| Link integrity   | `skills/agent-skill-authoring/scripts/check-links.mjs`                                |
| Skill structure  | `skills/agent-skill-authoring/scripts/check-skill-{frontmatter,body,references}.mjs`  |
| Installed copies | `skills/agent-skill-management/scripts/check-installed-copies.mjs`                    |
| Obligation load  | `scripts/report-obligation-load.mjs` (reports; never gates)                           |
| Skill discovery  | `scripts/discovery-eval/run.mjs` (reports; never gates)                               |
| Rule duplication | `scripts/report-skill-duplication.mjs` (reports; never gates)                         |
| Link freshness   | `skills/agent-skill-authoring/scripts/link-freshness/check.mjs` (scheduled)           |
| Product spec     | `skills/living-product-specification/scripts/check-*.mjs` (five, over `docs/`)        |

### Commands

Verification is a format check, a Markdown lint, and a Vitest suite.
`npm run check` runs all three, and each gates a merge as its own parallel job in
[`merge-checks.yaml`](./.github/workflows/merge-checks.yaml). The suite is the
wide one — the `npm test` row says what it carries.

This table is the authoritative list of the repository's commands, for human
contributors and agents alike.

| Command                | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | When to run it                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm install`          | Installs the toolchain (Prettier, markdownlint-cli2, Vitest) pinned in `package.json`.                                                                                                                                                                                                                                                                                                                                                                                                         | Once per checkout, and after `package.json` changes.                     |
| `npm run format`       | Rewrites Markdown, JSON, and YAML files in place with Prettier.                                                                                                                                                                                                                                                                                                                                                                                                                                | After every set of edits, before committing.                             |
| `npm run format:check` | Reports formatting drift without rewriting anything; exits non-zero on drift.                                                                                                                                                                                                                                                                                                                                                                                                                  | In CI, or to check formatting without touching the working tree.         |
| `npm run lint`         | Runs markdownlint-cli2 over every Markdown file.                                                                                                                                                                                                                                                                                                                                                                                                                                               | After formatting, and fix every reported error before finishing.         |
| `npm test`             | Runs the Vitest suite: the bundled validators against fixtures, this repository's own gate wiring, and — over this repository — the relative-link check, the skill-structure check (the three skill-structure checks over the source and the installed files), the installed-copy drift check, the five corpus checks over `docs/`, and the marked-count check that holds a number in prose to the file it describes. Advisory `WARN` lines from the structure check never affect the outcome. | After changing any script, any `SKILL.md`, a reference file, or `docs/`. |
| `npm run check`        | The aggregate gate: format check, lint, then the test suite.                                                                                                                                                                                                                                                                                                                                                                                                                                   | Before opening or updating a pull request.                               |

If a required command cannot be run, say so — naming the command, the reason,
and the residual risk — rather than presenting the change as fully verified.

**Every validator lives in the skill that owns it.** A validator here is an agent
utility — the thing you run after doing the work its skill governs — so it ships
with that skill rather than sitting beside the repository it happens to be
written in. Each is also a standalone CLI with `--help`, so a single check can
run without the suite. Run them from the source tier under [`skills/`](./skills)
— what the suite itself invokes; the installed roots go stale mid-edit.

```bash
# This repository's own three gates, run over the whole tree by `npm test`:
node skills/agent-skill-authoring/scripts/check-links.mjs
node skills/agent-skill-authoring/scripts/check-skill-frontmatter.mjs --help
node skills/agent-skill-authoring/scripts/check-skill-body.mjs --help
node skills/agent-skill-authoring/scripts/check-skill-references.mjs --help
node skills/agent-skill-management/scripts/check-installed-copies.mjs skills .claude/skills

# Five more gate this repository's own docs/ corpus. They are one set,
# deliberately not one command: each answers for one kind of change, so an
# author who touched one document reads only its findings.
node skills/living-product-specification/scripts/check-index.mjs docs
node skills/living-product-specification/scripts/check-references.mjs docs
node skills/living-product-specification/scripts/check-glossary.mjs docs
node skills/living-product-specification/scripts/check-decision-naming.mjs docs
node skills/living-product-specification/scripts/check-decision-supersede.mjs docs

# One more ships in a skill and this repository runs it too, from a schedule
# rather than a gate — see "Scheduled, and off the merge path" below:
node skills/agent-skill-authoring/scripts/link-freshness/check.mjs --dry-run

# Three more ship inside a skill purely for the projects that install it — this
# repository exercises them only against fixtures:
node skills/conventional-commits/scripts/check-commit-message.mjs --help
node skills/wireframe-design/scripts/check-wireframe.mjs --help
node skills/github-operation/scripts/decode-sanitized-read.mjs --help
```

A validator earns its place when the defect it finds is **not visible in the text
its author just wrote** — because it spans files, because it counts, or because
it compares bytes. Four scripts that failed that test were removed rather than
rehomed: two mirrored a vendor's option surface in regular expressions, which is
the same staleness [#179](https://github.com/axross/skills/issues/179) is moving
the vendor skills away from and less visible, since a pattern never renders; and
two re-checked rules an agent holding the skill can see in the file in front of
it. What each of those skills teaches is unchanged — only the claim that this
repository ships a runnable checker for it is gone.

#### Reporting, not gating

The <!-- count:first-reporting-tool-ordinal -->fifteenth<!-- /count -->,
the <!-- count:second-reporting-tool-ordinal -->sixteenth<!-- /count -->, and
the <!-- count:third-reporting-tool-ordinal -->seventeenth<!-- /count --> scripts
report instead of judging. None belongs to a gate, an npm script, or a hook, and
`tests/repository/reporting-tools.test.mjs` keeps all three out of the enforced
set on purpose, so wiring any of them in has to be a deliberate act.

The <!-- count:first-reporting-tool-ordinal -->fifteenth<!-- /count --> reports a
number:

```bash
node scripts/report-obligation-load.mjs --mandated
node scripts/report-obligation-load.mjs --help
```

`report-obligation-load.mjs` answers "how many rules is an agent holding right
now?" — the concurrent RFC-2119 obligation count across a set of skills, as a
**range**: the floor those skills cost with only their `SKILL.md` bodies read,
and the ceiling once every `references/*.md` is read too. Pass skills by path,
by name, or via `--mandated` for the set [`CLAUDE.md`](./CLAUDE.md) requires —
reported in the **three cumulative tiers** its Response Approach actually scopes
that set to, because only one of the three skills applies to every session:
`professional-behavior` always, `software-development` once a task touches the
project, and `loop-engineering` once it changes something. The first tier is
what a question-answering session carries and the last is what a
change-delivering one does; reading the last as the always-on cost overstates it
several times over. It reads the obligation definition from the same module
`check-skill-body.mjs` does, so the two never disagree about what a rule is.

It defines **no threshold** and never fails: it exits 0 on every valid
invocation however large the numbers. There is no evidence for a defensible
limit in this corpus yet, and a threshold nobody can defend becomes either a
rule people route around or a warning people stop reading.

The <!-- count:second-reporting-tool-ordinal -->sixteenth<!-- /count --> reports a
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

The <!-- count:third-reporting-tool-ordinal -->seventeenth<!-- /count --> reports a
ranking:

```bash
node scripts/report-skill-duplication.mjs
node scripts/report-skill-duplication.mjs --help
```

`report-skill-duplication.mjs` answers "which rule is stated in more than one
skill?" — a question the skill-structure checks structurally cannot ask, because
they validate one skill directory at a time and are host-agnostic. Two rules are
compared as sets of content words, cross-skill only, and every pair above the
similarity floor is listed with both `file:line` sites and both rules in full.
It reads the obligation definition from the same module `check-skill-body.mjs`
does,
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

#### Scheduled, and off the merge path

One more script neither gates nor merely reports. It **can** fail, it runs on a
schedule rather than on a pull request, and — unlike the three above — it ships
inside a skill, because it is an agent utility like every other validator here:

```bash
node skills/agent-skill-authoring/scripts/link-freshness/check.mjs --dry-run
node skills/agent-skill-authoring/scripts/link-freshness/check.mjs --help
```

`link-freshness/check.mjs` answers "do the URLs this repository cites
still resolve?" — a question nothing here asked before, because
`check-links.mjs` resolves relative `.md` targets on disk and ignores
`http(s)://` entirely. It exists because the vendor skills are moving off
reproduced option tables and onto a link plus the non-obvious caveat, which
trades a table that goes stale **visibly** for a link that rots **silently**.

**Only a link confirmed dead fails it** — a 404 or 410 that survives a retry. A
host that rate-limits, blocks datacentre egress, or times out is reported as
`unverifiable` and never affects the outcome, and a permanent redirect is
reported as `moved` without failing. That split is the design: this corpus cites
~80 hosts, several of which refuse CI traffic by policy, and an audit that went
red whenever a publisher throttled a runner would be red most weeks — the same
argument that keeps the three tools above out of every gate.

It lives in
[`agent-skill-authoring`](./skills/agent-skill-authoring/SKILL.md) rather than at
this repository's root: the rot it catches is a rot in _cited skill prose_, which
is that skill's subject, and the same skill already warns when a version-pinning
document cites nothing at all. What cannot travel with it is this repository's
wiring, so the skill states the schedule-only, never-`pull_request` rule as a
`MUST NOT` of its own — a consuming project inherits the argument, not just the
code.

It runs from
[`link-freshness.yaml`](./.github/workflows/link-freshness.yaml) weekly, and
that workflow **must never gain a pull-request trigger**. The reason is the
mirror of [`@claude review`](#claude-review--get-findings-on-any-pr)'s
`--disallowedTools "WebFetch,WebSearch,Task"` denial: a job that dereferences
every URL in the tree, triggered by a pull request, dereferences URLs an outside
contributor just wrote. Scheduled, it only ever probes text already merged.
`tests/repository/scheduled-audit-tools.test.mjs` holds all of that
mechanically — the trigger shape, the read-only token, and its absence from
every gate, npm script, and hook.

Being merged makes a URL reviewed; it does not make the **host** honest, and the
audit follows redirects by hand so it can tell a permanent move from a temporary
one. A citation that was ordinary at review time can start redirecting to an
internal address weeks later, so every hop — the first included — is
re-validated against its `address-guard.mjs`, which refuses
loopback, RFC 1918, carrier-grade NAT, link-local (`169.254.169.254`), and their
IPv6 and IPv4-mapped equivalents. A refused hop is reported as `unverifiable`
and does not fail the run. That file also states the DNS-rebinding window the
check does **not** close, and why the residual risk is bounded to blind
reachability probing.

Because scheduled workflows run only from the default branch, the audit does not
run on the pull request that changes it. `--dry-run` is the offline preview, and
it is what `npm test` exercises: no test in this repository probes a URL.

### Repository gotchas

There are <!-- count:repository-gotchas -->eight<!-- /count --> things about this
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
The <!-- count:distributable-skills -->twenty-nine<!-- /count --> here cover the
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

**The installed skills live once and are read from two roots.** The
distributable skills under [`skills/`](./skills) are the source of truth.
`npx skills` installs them into `.agents/skills/`, where Codex reads them, and
each `.claude/skills/<name>` is a **symlink** into that directory, which is the
form Claude Code documents for a skill entry. Both roots are committed. Edit the
source and reinstall — a hand-edit to an installed copy is silently discarded by
the next install. The installed-copy check inside `npm test` compares the source
against the symlink root, so one run catches both a forgotten reinstall and a
symlink that stopped resolving. Every skill is in scope for it; the
repository-local tier that the check exempts is currently empty.

**A symlinked skill root is invisible to a naive directory walk.**
`Dirent.isDirectory()` is false for a symlink pointing at a directory, so code
that filters on it sees an empty root — and an empty root reports `All 0
skill(s) passed` or `no drift`, which is indistinguishable from a real pass.
Every enumeration here stats through the link instead. Anything new that walks a
skill root has to do the same, or it will silently check nothing.

**Codex reads less of a skill than Claude Code does.** It reads `name` and
`description`; `when_to_use` is a Claude Code extension it ignores, and no skill
here carries one. It refuses
to load a skill whose `description` exceeds 1,024 bytes —
`check-skill-frontmatter.mjs`
enforces that in bytes rather than characters for the reason its comment gives —
and it truncates per-skill descriptions to fit the whole listing into a context
budget, so the front of a `description` is the part that reliably arrives. Its
default sandbox also runs commands with **network disabled**, which of the
bundled scripts affects only `link-freshness/check.mjs`; `--dry-run` needs no
network.

**`npx skills` can fail to resolve the CLI.** In some environments — a fresh
container with no local install, or a stale npx cache — both `npx skills …` and
`npx --yes skills …` abort with `npm error could not determine executable to
run`, which reads like a broken command rather than a resolution failure. An
explicit version specifier fixes it:

```bash
npx --yes skills@latest add ./skills --agent codex --skill '*' --yes
```

The plain `npx skills` form stays canonical — reach for the specifier only after
seeing that error, since pinning `@latest` on every run fetches the newest CLI
build each time.

### Authoring a skill

Skills live in two tiers. Every skill here is currently **distributable**: its
source is [`skills/<name>/SKILL.md`](./skills) (with any `references/` and
`scripts/` beside it), and the installed files under `.agents/skills/` are
generated from it with the
[vercel-labs/skills](https://github.com/vercel-labs/skills) CLI:

```bash
npx skills add ./skills --agent codex --skill '*' --yes
```

That writes `.agents/skills/<name>/`. The CLI copies rather than symlinks when
the source is a local path — `--copy`'s "instead of symlinking" governs remote
and `node_modules`-mediated installs — so the `.claude/skills/<name>` links are
made once and simply kept:

```bash
for d in .agents/skills/*/; do
  n=$(basename "$d")
  ln -sfn "../../.agents/skills/$n" ".claude/skills/$n"
done
```

Commit both roots and `skills-lock.json` alongside the source — they are tracked
artifacts, not build output to ignore. A skill added or removed needs the
corresponding link added or removed with it; the installed-copy check fails on
either half being missed.

**Confirm both hosts actually load them.** The suite checks that the files are
well-formed and in the right place; it cannot check that a host read them, and
each host is loaded at session start, so neither is observable from inside the
session that changed the tree. Verify each once, in a fresh session:

- **Codex** — run `/skills` and confirm the library is listed. Codex warns when
  the listing exceeds its context budget and truncates descriptions to fit, so
  read the warning rather than only the names.
- **Claude Code** — run `/context` and confirm the skills appear, which is what
  proves the `.claude/skills/<name>` symlinks resolved.

The second tier is **repository-local**: a skill that encodes conventions
specific to this repository would have its source committed directly under a
skill root, hand-edited in place, and never touched by the CLI or listed in
`skills-lock.json`. No skill is in that tier today —
`github-operation` was the last one and is now distributable — so the tier is
available rather than in use. Registering one means passing its name to the
installed-copy check as `--local <name>` from
[`tests/repository/gates.mjs`](./tests/repository/gates.mjs), which otherwise
treats an installed skill with no source as drift.

[Agent Skill Management](./skills/agent-skill-management/SKILL.md) covers which
tier a new skill belongs to and the full install, lockfile, and
refresh-and-verify workflow;
[Agent Skill Authoring](./skills/agent-skill-authoring/SKILL.md) covers how to
write the skill itself. Both are in the catalog above, so you can install them
into your own project too.

### Delivering a unit of work end-to-end

[Loop Engineering](./.claude/skills/loop-engineering/SKILL.md) is the
repository's default change loop, and this repository mandates it: every change
here goes through it, whatever its size. It runs **model-invoked** — there is no
slash command. Name the work and it drives that work to a merge-ready pull
request in one continuing session, stopping for you wherever a decision is
yours to make. The skill states its stages, where it stops, and what it caps.

Kick it off by naming what to deliver — "deliver issue #42", "pick up PR 57", or
a description of the change with no issue behind it yet. To carry on after it
stops, continue the session and tell it to.

**Implementation runs in a subagent here, and that subagent is also the worked
example.**
[`.claude/agents/implementer.md`](./.claude/agents/implementer.md) pins a
lower-cost model and effort — a worker that inherits the session's runs at the
main actor's cost, which defeats the point — and states the delivery boundary in
its own body rather than closing it by withdrawing a tool: commits stay local,
and pushing, publishing, and anything else that speaks outward belongs to
whoever asked, a rule the file asks the worker to honor rather than one the host
enforces. It carries nothing else: the decision boundary, the verification
obligation, the commit rules, and the receipt shape all arrive per run in the
task package, so a definition restating them would only drift from it. It does
not mention the loop at all, which is the point: it says
what an implementation agent is and what it may not decide, so the same file
works for a caller that has never heard of `loop-engineering` and is worth
copying into a project that runs its subagents some other way. What it leaves
out, and why, is explained host-neutrally in
[`implementation-worker.md`](./skills/loop-engineering/references/implementation-worker.md).
Delete the file and the loop keeps delegating — to a generic
implementation-capable agent at the session's inherited model — rather than
returning to single-agent execution, with no gate weakened. Single-agent
execution is what a host exposing no capable agent at all produces.

**The optional pre-flight review has its own worked example, and the interesting
part is what it does _not_ take away.**
[`.claude/agents/reviewer.md`](./.claude/agents/reviewer.md) denies two things —
editing, and spawning another agent — and nothing else. The obvious move is to
give a reviewer a short list of permitted tools, since its job sounds narrow. It
is not: judging a change means confirming what was asked and not only what was
written, which reaches the issue, any artifact the plan points at, and the
documentation behind a factual claim. A reviewer missing one of those does not
fail to start; it runs, cannot check what it cannot reach, and returns a report
short by exactly those checks — and an under-equipped review reads exactly like a
clean one. So the asymmetry between the two definitions is now in both _what_
each denies and _how_: the things `implementer.md` must never do are few and
nameable, and it asks them in prose rather than closing them with a withdrawn
tool; the things a reader needs are open-ended, which is why `reviewer.md` still
enforces its own short deny-list with tools instead. Neither restriction is
complete, and the file says so — `Bash` remains, so mutation is enforced
against the editing tools and not against the shell, and reporting rather than
publishing stays a rule it is asked to honor. Delete this file and the stage is
skipped rather than performed by the main actor, which is what keeps it from
degrading into self-review.

`.claude/agents/` is the only home for either file — they are agent definitions,
not skills, so `npx skills` does not carry them. Only Claude Code is configured
today; [#218](https://github.com/axross/skills/issues/218) tracks the Codex side
for both.

One check backs the loop from outside any session:
[`branch-governance-audit.yaml`](./.github/workflows/branch-governance-audit.yaml)
sweeps hourly and flags any `claude/` branch pushed ahead of the default branch
with no open pull request — work delivered outside the loop, and so never
independently reviewed. It is deliberately a scheduled sweep rather than a
push-triggered gate, because implementation legitimately pushes before the pull
request opens; a grace window skips a branch whose latest commit is still fresh.

### `@claude review` — get findings on any PR

Comment **`@claude review`** on a pull request to run this repository's review
policy ([`REVIEW.md`](./REVIEW.md)) — severity-tagged findings with `file:line`
evidence and concrete fixes, posted as inline comments by the CI reviewer
([`claude-review.yaml`](./.github/workflows/claude-review.yaml)). Use it for a
pre-merge check on a hand-written change or a second opinion before merging. It
is the same reviewer the change loop relies on: the loop requests it by
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
