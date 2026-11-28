---
type: Architecture
title: Directory Structure
description: Where skills, installed copies, agent definitions, validators and evaluation materials live and how their responsibilities differ.
---

# Directory Structure

Where a skill's files live, the two tiers a skill can be written in, where a
validator or an agent definition belongs, and how the evaluation subsystem
under `tools/evaluation/` is laid out.

## The Tree

```text
<root>
├── skills/<name>/SKILL.md       # source: every distributable skill's editable copy
│   ├── references/              # detail the body defers to
│   └── scripts/                 # the skill's own validators, if it has any
├── .agents/skills/<name>/       # installed: generated from skills/, Codex reads this
├── .claude/skills/<name>        # installed: a symlink into .agents/skills/<name>/
├── .claude/agents/              # agent definitions — never a skill
├── docs/                        # this tree
├── tools/evaluation/            # the skill evaluation instrument
│   ├── probe.mjs                # takes one measurement: a scenario's probe matrix, one condition and repetition per probe
│   ├── evaluate.mjs             # judges a stored measurement's factors
│   ├── derive.mjs               # computes (or --check verifies) a measurement's derived tier
│   ├── scenario.schema.json     # the one declaration of a scenario.json's shape; src/scenario.mjs evaluates it
│   ├── src/                     # shared modules, by concern: layout, fingerprint, admission, comparability, judge, spawn
│   ├── mocks/                   # the mock projects a probe's workspace is materialized from
│   ├── judgments/<name>.mjs     # a judgment script more than one scenario names, referenced as ../../judgments/<name>.mjs
│   ├── scenarios/<id>/          # one scenario.json, its patch, and any judgment script that scenario alone names
│   └── measurements/            # what probe.mjs, evaluate.mjs, and derive.mjs wrote, judged, and derived
└── tests/                       # the suite that gates all of the above
```

## The Two Skill Tiers

Every skill in this repository is currently **distributable**: its source is
`skills/<name>/SKILL.md`, with any `references/` and `scripts/` beside it, and
it installs into `.agents/skills/` and `.claude/skills/` the way it would
install into any other project. A **repository-local** skill instead encodes
conventions specific to this repository, is committed directly under a skill
root, and is hand-edited in place — never touched by the install CLI or
listed in `skills-lock.json`.

The repository-local tier is currently empty. Registering a local skill means passing its name to the installed-copy check as
`--local <name>` from
[`tests/repository/gates.mjs`](../../tests/repository/gates.mjs), which
otherwise treats an installed skill with no source as drift.

[agent-skill-management](../../skills/agent-skill-management/SKILL.md) covers
which tier a new skill belongs to; the actual install and refresh procedure is
in [Agent Skills](../operations/agent-skills.md).

## Both Installed Roots, and the Symlink Between Them

`.agents/skills/` holds the real, generated files — Codex reads from here.
`.claude/skills/<name>` is a symlink into `.agents/skills/<name>/`, made once
when a skill is added and simply kept afterward rather than regenerated on
every install; this is the form Claude Code's own documentation gives for a
skill entry. Both roots, and `skills-lock.json` alongside them, are tracked
artifacts committed to the repository — not build output to `.gitignore`. A
hand-edit to either installed root is silently discarded the next time the
source is reinstalled.

The installed-copy check compares the source against the symlink root, so one
run catches both a forgotten reinstall and a symlink that stopped resolving.
Every skill is in scope for it; the repository-local tier the check exempts
is currently empty. `.claude/skills/` being a symlink root rather than a
directory of real files is also a trap for anything that walks it — see
[Verification Gates](./verification-gates.md).

## Where a Validator Lives

A validator here ships with the skill that owns it, rather than sitting beside
the repository it happens to be written in — it is an agent utility, the thing
run after doing the work its skill governs, and it doubles as a standalone CLI
with `--help` so a single check can run without the suite. Run it from the
source tier under `skills/`, which is what the suite itself invokes; the
installed roots go stale mid-edit.

The private native-ESM package at
`skills/agent-skill-authoring/scripts/markdownlint/` bundles the shared source
context, protected CLI2 runner and AS001/AS010 rule exports. Its manifest and
modules travel with the skill; consumers install its declared dependencies
locally. [Protected Markdownlint Execution](../../skills/agent-skill-authoring/references/markdownlint-execution.md)
owns that setup and scope. This foundation does not retire the existing
structure validators or move their shared/report/network responsibilities.

A validator earns its place when an author cannot see the defect in the text
being edited, for example because detection requires comparing files,
counting declarations or comparing bytes. Link to vendor documentation for
supported options. Encoding an option list in a regular expression creates
another copy to maintain.

## Where a Scenario's Patch Lives

[Scenario Layout](./scenario-layout.md#scenario-patches) defines patch
ownership and the history changes required when a diff adds or removes files.
Follow [Scenario Patches](../evaluation/scenario-patches.md) to generate and
verify the diff for the current mock.

## Where a Judgment Script Lives

Use the [judgment script placement convention](./scenario-layout.md#judgment-scripts)
to choose between a scenario's private scripts and the shared judgments directory.

## `.claude/agents/` Is the Only Home for an Agent Definition

An agent definition — `.claude/agents/implementer.md`,
`.claude/agents/reviewer.md`, `.claude/agents/investigator.md` — is not a
skill, so `npx skills` does not carry it and it is never installed,
symlinked, or listed in `skills-lock.json`. Only Claude Code is configured
today; [#218](https://github.com/axross/skills/issues/218) tracks the Codex
side for each of them.
