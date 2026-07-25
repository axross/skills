# `skills/` — installable skill sources

This directory is the **source of truth** for distributable agent skills that
are installed into `.claude/skills/` with the
[vercel-labs/skills](https://github.com/vercel-labs/skills) CLI (`npx skills`).
Only `github-operation` remains repository-local, living directly under
[`.claude/skills/`](../.claude/skills) and not managed by `npx skills`.

Currently sourced here:

- `agent-skill-authoring` — how to author, structure, name, split, and audit
  agent skills in the agentskills.io format: frontmatter and discovery
  metadata, section anatomy, progressive disclosure, topic-based
  cross-references, and runnable link and structure validators.
- `agent-skill-management` — a self-contained, project-agnostic account of the
  two-tier author/install model this directory embodies: choosing a tier,
  the `npx skills` install and refresh workflow, the `skills-lock.json`
  lockfile, and how to propose a change to a skill depending on whether you own
  its source (edit and reinstall) or installed it from an upstream you do not
  own (an upstream feature-request issue).
- `application-security` — building and reviewing code through an OWASP Top
  10:2025 lens: secrets and environment boundaries, input validation, output
  encoding and injection, SSRF, access control and data exposure, and
  dependency supply-chain risk.
- `code-maintainability` — keeping changed code readable and cheap to change:
  naming and file organization, abstraction boundaries, complexity and
  readability limits, magic numbers, dead code, scope control, and
  SOLID/DRY/KISS/YAGNI judgment.
- `code-review` — a self-contained, portable code-review methodology:
  reviewer-mode reset, severity-ranked findings with file-line evidence and fix
  snippets, a merge verdict, and a posted/CI-review overlay.
- `end-to-end-testing` — the ability to author, run, review, and maintain
  end-to-end tests across browser (Playwright, Cypress), mobile (Maestro,
  Detox), and protocol-level runners: locators, auto-waiting, determinism, and
  scenario coverage with a runnable coverage gate.
- `high-fidelity-ui-design` — the design vocabulary and research-grounded rules
  for high-fidelity (real-token) UI/visual design: semantic tokens and dark
  mode, layout and type, per-theme WCAG contrast, interaction states, focus,
  motion, and accessibility.
- `loop-engineering` — a self-contained change loop that drives one unit
  of work from intake to a review-ready pull request (plan → code →
  independent review).
- `product-requirement-document-authoring` — a self-contained, portable skill
  for writing and reviewing product requirement documents (PRDs), feature specs,
  and plan documents.
- `quality-assurance` — the reviewer's pass on whether a change carries
  adequate verification evidence: command evidence for the format and lint
  gate, changes to the gate's own configuration, manual checks matched to
  changed surfaces, and residual risk from skipped checks.
- `software-development` — the baseline discipline every task runs on: the
  format/lint loop, scoped and incremental change management, mapping a change
  to the surfaces it risks, consulting the project's own documentation (and
  closing gaps in it), Conventional Commits with a runnable header validator,
  and pull request descriptions.
- `software-instrumentation` — the ability to instrument software so its
  behavior is observable: structured logging with log levels, error handling and
  error tracking (breadcrumbs, trace/replay sampling, PII), product/usage
  analytics, and signal-selection and decision flows.
- `unit-testing` — framework-agnostic conventions for writing, structuring,
  reviewing, and running unit tests across runners such as Jest or Vitest,
  including a decision diagram for unit-vs-integration/e2e scope.
- `wireframe-design` — a self-contained, project-agnostic capability for
  low-fidelity wireframe, breadboard, and wireflow mockups of any client-app UI
  (mobile or web/desktop), with a runnable self-containment/placeholder
  validator.

Author a distributable skill here as `skills/<name>/SKILL.md` (with its
`references/` beside it), then install it so Claude Code can load it:

```bash
npx skills add ./skills --agent claude-code --skill '*' --yes --copy
```

The installed copies under `.claude/skills/<name>/` and the generated
`skills-lock.json` are committed alongside this source. See the
[Agent Skill Management](./agent-skill-management/SKILL.md) skill for the
two-tier model and the full install, lockfile, and refresh-and-verify workflow,
and [Agent Skill Authoring](./agent-skill-authoring/SKILL.md) for how to author
the skill itself.
