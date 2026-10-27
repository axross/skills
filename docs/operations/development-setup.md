# Development Setup

How to set this repository up for local work and the commands that verify a
change. [Development Workflow](./development-workflow.md) owns how a change
moves from intent to a merged pull request; this document owns the toolchain
and the command reference that workflow's checks run.

## Local setup

1. Install dependencies: `npm install`
2. Run the checks: `npm run check` — see [Commands](#commands) for what each
   one covers

There is no dev server — authoring a skill means editing Markdown under
[`skills/`](../../skills) (or a skill root for a repository-local skill) and
reinstalling if it is distributable; see
[`docs/operations/agent-skills.md`](./agent-skills.md) for
that procedure and
[`docs/operations/agent-sessions.md`](./agent-sessions.md)
for Amp orb provisioning and Claude Code/Codex session startup. The terms this repository
uses, and the constraints it works under with the reasoning beside them, live
in [`docs/`](../index.md), which is checked by the same suite.

| Area              | Tool                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Language          | Markdown (with occasional JavaScript for scripting)                                                                                            |
| Runtimes          | Claude Code, Codex, and Amp                                                                                                                    |
| Node              | 26, pinned in `package.json`'s `engines.node`, which CI reads via `node-version-file`                                                          |
| Package manager   | npm                                                                                                                                            |
| Formatting        | Prettier                                                                                                                                       |
| Linting           | markdownlint-cli2                                                                                                                              |
| Tests             | Vitest                                                                                                                                         |
| Link integrity    | `skills/agent-skill-authoring/scripts/check-links.mjs`                                                                                         |
| Skill structure   | `skills/agent-skill-authoring/scripts/check-skill-{frontmatter,body,references}.mjs`                                                           |
| Installed copies  | `skills/agent-skill-management/scripts/check-installed-copies.mjs`                                                                             |
| Obligation burden | `scripts/report-obligation-burden.mjs` (reports; never gates)                                                                                  |
| Skill evaluation  | `tools/evaluation/{probe,evaluate,derive,compare}.mjs` (reports; never gates); `tools/evaluation/artifacts.mjs` (dispatch packaging/admission) |
| Rule duplication  | `scripts/report-skill-duplication.mjs` (reports; never gates)                                                                                  |
| Link freshness    | `skills/agent-skill-authoring/scripts/link-freshness/check.mjs` (scheduled)                                                                    |
| Project docs      | `skills/living-project-documentation/scripts/check-*.mjs` (three, over `docs/`)                                                                |

## Commands

Verification is a format check, a Markdown lint, and a Vitest suite.
`npm run check` runs all three, and each gates a merge as its own parallel job in
[`merge-checks.yaml`](../../.github/workflows/merge-checks.yaml). The suite is the
wide one — the `npm test` row says what it carries.

This table is the authoritative list of the repository's commands, for human
contributors and agents alike.

The additional W1 foundation uses CLI2 0.23.3/markdownlint 0.41.1 and the private
bundled package described in
[Protected Markdownlint Execution](../../skills/agent-skill-authoring/references/markdownlint-execution.md).
Its AS001/AS010 checks and raw-source/preflight tests run in the fixture suite;
they do not replace the existing repository lint or structure gates. Standard
configuration for this helper is explicit, not inherited from CLI2 config.
`npm test -- tests/validators/skill-markdownlint.test.mjs` runs its targeted
regressions, including the copied/tarball distribution in a clean offline
consumer using the locked runtime dependency graph. Repository dependency
acquisition must have populated the npm tarball cache; cached registry metadata
is not required.

| Command                                                                    | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | When to run it                                                                                                                    |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`                                                              | Installs or updates the toolchain from `package.json`, reconciling `package-lock.json` when needed and reusing existing `node_modules`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | During local dependency development and warm agent setup/restoration.                                                             |
| `npm ci`                                                                   | Installs the toolchain from `package-lock.json` without rewriting the manifest or lockfile; rejects disagreement with `package.json` and replaces existing `node_modules`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | In cold CI jobs, or for a clean local reproduction of the committed dependency graph.                                             |
| `npm run format`                                                           | Rewrites Markdown, JSON, and YAML files in place with Prettier.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | After every set of edits, before committing.                                                                                      |
| `npm run format:check`                                                     | Reports formatting drift without rewriting anything; exits non-zero on drift.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | In CI, or to check formatting without touching the working tree.                                                                  |
| `npm run lint`                                                             | Runs markdownlint-cli2 over every Markdown file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | After formatting, and fix every reported error before finishing.                                                                  |
| `npm run lint:fix`                                                         | Repairs markdownlint's mechanically-fixable violations in place. Carries no glob of its own — pass a path or glob, e.g. `npm run lint:fix -- "skills/**/*.md"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | On a file with a mechanical violation `npm run lint` reports; a residual violation it cannot repair still needs an authoring fix. |
| `npm test`                                                                 | Runs the Vitest suite: the bundled validators against fixtures, this repository's own gate wiring, and — over this repository — the relative-link check, the skill-structure check (the three skill-structure checks over the source and the installed files), the installed-copy drift check, the evaluation instrument's own suite under `tests/evaluation/` (`probe.mjs`, `evaluate.mjs`, `derive.mjs`, `compare.mjs`, and `artifacts.mjs` run for real against stored fixtures, never a live model), the three `docs/` checks, and the marked-count check that holds a number in prose to the file it describes. Advisory `WARN` lines from the structure check never affect the outcome. | After changing any script, any `SKILL.md`, a reference file, or `docs/`.                                                          |
| `npm run check`                                                            | The aggregate gate: format check, lint, then the test suite.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Before opening or updating a pull request.                                                                                        |
| `node tools/evaluation/artifacts.mjs`                                      | Packages `record.json` bundles and admits them before landing. Use `--help` for flags; [Evaluation Dispatch](./evaluation-dispatch.md#artifact-admission-artifactsmjs) owns context, selectors, partial outcomes and offline invocations.                                                                                                                                                                                                                                                                                                                                                                                                                                                     | In dispatch producers/consumers or credential-free offline artifact checks.                                                       |
| `node tools/evaluation/compare.mjs <declaration.json> <observations.json>` | Emits an explicit treatment-comparison JSON report without changing inputs or calling models. [Evaluation Dispatch](./evaluation-dispatch.md) owns the input contract and claim limits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | For offline old/new comparison reporting, not live qualification.                                                                 |

If a required command cannot be run, say so — naming the command, the reason,
and the residual risk — rather than presenting the change as fully verified.

Every command below runs from the source tier under [`skills/`](../../skills) —
what the suite itself invokes; the installed roots go stale mid-edit. See
[`docs/conventions/directory-structure.md`](../conventions/directory-structure.md)
for why each validator ships with the skill that owns it rather than living
here, and when a validator earns its place at all.

```bash
# This repository's own three gates, run over the whole tree by `npm test`:
node skills/agent-skill-authoring/scripts/check-links.mjs
node skills/agent-skill-authoring/scripts/check-skill-frontmatter.mjs --help
node skills/agent-skill-authoring/scripts/check-skill-body.mjs --help
node skills/agent-skill-authoring/scripts/check-skill-references.mjs --help
node skills/agent-skill-management/scripts/check-installed-copies.mjs skills .claude/skills

# W1 foundation only; not a substitute for the three structure checks above:
node skills/agent-skill-authoring/scripts/markdownlint/cli.mjs --help
# All standard rules default on; use --config for an explicit JSON rule object:
node skills/agent-skill-authoring/scripts/markdownlint/cli.mjs --collection skills

# Three more gate this repository's own docs/. They are one set,
# deliberately not one command: each answers for one kind of change, so an
# author who touched one document reads only its findings.
node skills/living-project-documentation/scripts/check-index.mjs docs
node skills/living-project-documentation/scripts/check-references.mjs docs
node skills/living-project-documentation/scripts/check-glossary.mjs docs

# One more ships in a skill and this repository runs it too, from a schedule
# rather than a gate — see docs/conventions/verification-gates.md:
node skills/agent-skill-authoring/scripts/link-freshness/check.mjs --dry-run

# Three others ship inside a skill purely for the projects that install it — this
# repository exercises them only against fixtures:
node skills/conventional-commits/scripts/check-commit-message.mjs --help
node skills/wireframe-design/scripts/check-wireframe.mjs --help
node skills/github-operation/scripts/decode-sanitized-read.mjs --help
```

See [`docs/conventions/verification-gates.md`](../conventions/verification-gates.md)
for what makes a check a gate, a report, or a scheduled audit, and the traps
each can fall into.
