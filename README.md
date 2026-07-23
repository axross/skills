# Claude Loop Engineering Template

A reusable, **framework-agnostic** starting point for giving **Claude Code** a
structured working agreement and a library of skills.

It is extracted from a production setup and stripped of stack-specific detail,
leaving a generic core you adapt to any project — web, mobile, CLI, library, or
service. The system is built for Claude Code: the skill core, the `/address`
and `/handoff` skills, and the example GitHub Actions all target
it, with the working agreement kept in `AGENTS.md` and loaded through
`CLAUDE.md`.

## What's inside

```
.
├── INIT.md                  # how to adapt this template (start here)
├── init.sh                  # metacharacter-safe {{TOKEN}} substitution + gates
├── tokens.json              # machine-readable manifest of every {{TOKEN}}
├── README.template.md       # seed for the initialized project's README (finalized in INIT Step 7)
├── package.json             # npm scripts: format / lint / links / check (Prettier + markdownlint)
├── package-lock.json        # pinned Markdown toolchain (Prettier + markdownlint-cli2)
├── .prettierrc.json         # Prettier config (proseWrap: preserve)
├── .prettierignore          # keeps node_modules out of Prettier
├── .markdownlint-cli2.jsonc # markdownlint rules tuned for long-form skill prose
├── .gitignore               # ignores node_modules + settings.local.json + .env.local
├── AGENTS.md                # master routing index + working agreement
├── CLAUDE.md                # @AGENTS.md — Claude Code's binding to AGENTS.md
├── REVIEW.md                # fixed: posted-review policy for the independent-review channel (configured, never removed)
├── skills/                  # source of truth for skills installed via `npx skills` (ships empty)
├── .github/
│   └── workflows/           # fixed: CI reviewer + merge checks (GitHub Actions + Claude Code);
│                            # plus template-checks.yaml, this repo's own Markdown-QA CI (deleted during INIT)
└── .claude/
    ├── skills/              # skill core (13 guideline skills) + fixed /address + /handoff entry points
    │   ├── address/         # fixed: /address delivery entry point (Claude Code)
    │   ├── agent-skills-best-practices/  # ships scripts/check-links.sh (relative-link integrity)
    │   ├── application-security-requirements/
    │   ├── code-review-guideline/
    │   ├── development-guidelines/
    │   ├── e2e-testing-guidelines/
    │   ├── github-operation-guidelines/
    │   ├── handoff/         # fixed: /handoff session-suspend entry point (rides with /address)
    │   ├── maintainable-code-guidelines/
    │   ├── observability-guidelines/
    │   ├── performance-and-reliability-requirements/
    │   ├── product-requirement-guidelines/
    │   ├── quality-assurance-guidelines/
    │   ├── skill-installation/  # installs skills/ sources into .claude/skills/ (npx skills)
    │   └── unit-test-guidelines/
    ├── hooks/               # session-start (always on), format + check (opt-in)
    ├── settings.json        # wires the SessionStart hook + default effort level (always on)
    └── settings.local-example.json  # opt-in: copied to settings.local.json (by session-start) to wire format + check
```

The skill core covers cross-project workflow: how to author and install skills,
frame product requirements, develop and review changes, test (unit + e2e),
operate GitHub, and review for maintainability, security,
performance/reliability, observability, and QA evidence. Project-specific skills
(structure, components, routing, UI, domain) are intentionally **not** shipped —
you add them during adaptation.

Skills come in two forms. The guideline and workflow skills above are committed
directly under `.claude/skills/`. A second, **installable** form lives under
`skills/` (the source of truth) and is copied into `.claude/skills/` with the
[vercel-labs/skills](https://github.com/vercel-labs/skills) CLI (`npx skills`);
`skills/` ships empty, and the
[`skill-installation`](./.claude/skills/skill-installation/SKILL.md) skill
documents the install, lockfile, and refresh-and-verify workflow. Because the
skills are Markdown, the template maintains its own tree with an npm toolchain —
`npm run check` runs Prettier's format check, markdownlint, and the relative-link
checker.

A fixed **independent-review channel** ships alongside the core: `REVIEW.md`
(the posted-review policy), the `/address` entry-point skill in `.claude/skills/`,
and the `.github/workflows/`. INIT configures and adapts it — it is never
removed (a project that wants no automated loop leaves it dormant); INIT Step 4
covers the configuration. Its CI reviewer needs a one-time secret setup before
it runs — see [Getting started](#getting-started).
A **`/handoff`** skill also
ships in `.claude/skills/`: it suspends in-progress work into a downloadable
handoff package (a `handoff-<unix epoch>.md` plus an optional zip of supporting
files) that a fresh session takes over with `/address continue` — so it rides
along with the `/address` entry point rather than standing alone.

## How it works

- **`AGENTS.md`** is the source of truth: a skill index plus a working
  agreement (plan → implement → self-review → verify → report).
- **`.claude/skills/**`** hold the detailed, progressively-disclosed rules each
  index entry routes to.
- **`CLAUDE.md`** plus **`.claude/`** bind Claude Code to `AGENTS.md`, loading
  the working agreement and skills into every session.
- **`package.json`** wires the Markdown toolchain: run `npm install` once, then
  `npm run check` (Prettier format check + markdownlint + relative-link check)
  to keep the skill tree formatted and its cross-links honest.

## Getting started

This repository is a GitHub **template repository**, so you start from a copy of
it rather than cloning it.

1. Get the template into your repository:
   - **New repository** — on GitHub, click **Use this template → Create a new
     repository**. Your repository starts as a copy of this one, so the files
     below — including this `README.md` — are already in place; there is nothing
     to copy by hand. Skip to step 2.
   - **Existing repository** — copy the template's files into it: the
     adaptation tooling (`INIT.md`, `init.sh`, `tokens.json`), the README seed
     (`README.template.md`), the Markdown toolchain (`package.json`,
     `package-lock.json`, `.prettierrc.json`, `.prettierignore`,
     `.markdownlint-cli2.jsonc`), the working agreement, skills, and ignore
     rules (`AGENTS.md`, `CLAUDE.md`, `.claude/`, `skills/`, `.gitignore`), and
     the fixed `.github/` and `REVIEW.md`.
2. Open **[INIT.md](./INIT.md)** and follow it — or hand the repo to Claude Code
   and ask it to "run INIT". INIT reconciles any files a scaffold already
   generated (e.g. an existing `AGENTS.md`), interviews you about the project
   kind, frameworks, architecture (directory structure, business-logic
   structure, state management, database layer, styling, theming), and goal,
   then fills the `{{TOKENS}}` via `./init.sh`. The `/address` + `/handoff`
   commands and the independent-review loop (`REVIEW.md`, the workflows,
   `github-operation-guidelines`) are **fixed** — INIT never asks whether to keep
   them. For each _other_ optional capability — unit tests, e2e, observability —
   it asks whether to **add** it (and with which tool) or skip it, rather than
   assuming it should be deleted, and it adds project-specific skills.
3. When adaptation is complete, INIT finalizes `README.template.md` into your
   project's `README.md` — a README covering the project summary, tech stack,
   getting started, the development workflow (`/address`), testing strategy and
   commands, and related links — replacing this template README, and deletes
   `INIT.md`.
4. **Enable the CI reviewer.** The fixed independent-review channel's GitHub
   Actions reviewer
   ([`claude-review.yaml`](./.github/workflows/claude-review.yaml)) needs a
   one-time operator setup before it runs: install the
   [Claude GitHub App](https://github.com/apps/claude) and add a
   `CLAUDE_CODE_OAUTH_TOKEN` repository secret — generate it locally with
   `claude setup-token` — under **Settings → Secrets and variables → Actions**,
   or set an `ANTHROPIC_API_KEY` secret instead for pay-as-you-go API billing.
   Until both are in place the workflow no-ops. The workflow file's header
   comment documents the exact steps.

Placeholders use the `{{TOKEN}}` convention so they are easy to find and replace;
the full token list lives in [INIT.md](./INIT.md).
