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

No skill is in the repository-local tier today. `github-operation` was the
last one and is now distributable, so the tier is available rather than in
use. Registering one means passing its name to the installed-copy check as
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

A validator earns its place when the defect it finds is **not visible in the
text its author just wrote** — because it spans files, because it counts, or
because it compares bytes. Four scripts that failed that test were removed
rather than rehomed: two mirrored a vendor's option surface in regular
expressions, which is the same staleness
[#179](https://github.com/axross/skills/issues/179) is moving the vendor
skills away from and less visible, since a pattern never renders; and two
re-checked rules an agent holding the skill can already see in the file in
front of it. What each of those skills teaches is unchanged — only the claim
that this repository ships a runnable checker for it is gone.

## Where a Scenario's Patch Lives

A scenario's `patch` — the unified diff that brings its own defect into an
otherwise sound mock, per [Skill Evaluation](../specs/skill-evaluation.md) and
[`tools/evaluation/mocks/README.md`](../../tools/evaluation/mocks/README.md) —
lives inside its own `scenarios/<id>/` directory, beside `scenario.json` and
`scripts/`, never under `mocks/` and never shared between scenarios:
[`tools/evaluation/src/scenario.mjs`](../../tools/evaluation/src/scenario.mjs)
resolves the `patch` field relative to that scenario's own directory, and a
patch belongs to exactly one scenario.

Generate it against the mock as it currently ships rather than hand-writing
hunks: check the target file out at its current committed state, edit it into
the state the scenario needs, and let `git diff` (or, for a file the patch
adds, `git diff --no-index` against `/dev/null`) produce the unified diff. A
hand-edited patch that only looks right is exactly the failure
[the patch-materialization test](../../tests/repository/patch-materialization.test.mjs)
exists to catch, but regenerating one correctly is still cheaper than
debugging one that merely happens to apply.

A patch rots the moment a file it touches changes elsewhere in the mock, and
nothing catches that until the next materialization: offline, in the
patch-materialization test just linked, or — if that test is ever skipped —
inside a paid probe that has already spent money reaching it. Regenerating a
rotted patch is the same procedure as authoring it the first time: diff the
mock's new state into the patch's intended result again, and confirm with
`git apply --check` that the regenerated file still applies before committing
it.

A patch that changes the file set — adding or removing one — MUST maintain
its mock's own `history.jsonc` in that same diff:
[`tools/evaluation/src/mock-workspace.mjs`](../../tools/evaluation/src/mock-workspace.mjs)
refuses a mock whose tree and history disagree in either direction, so an
added file with no matching `history.jsonc` entry, or a removed file still
named in one, fails materialization rather than silently landing wrong. A
patch that only edits a file already in the tree — never adding or removing
one — needs no `history.jsonc` change at all.

A patch file MUST stay out of this repository's own format and lint gates,
which run over Markdown, JSON, and YAML files respectively — a patch
reformatted by a house-style formatter would stop applying, and its file
extension alone already keeps it out of both.

## Where a Judgment Script Lives

A factor's `judgment.script` resolves relative to its own scenario's
directory — `join(scenarioDir, factor.judgment.script)` in
[`tools/evaluation/src/factor-judgment.mjs`](../../tools/evaluation/src/factor-judgment.mjs)
— but where the script named there physically lives depends on how many
scenarios name it. A script used by exactly one scenario lives in that
scenario's own `scenarios/<id>/scripts/`, named relative to it (e.g.
`"scripts/check-something.mjs"`). A script named by more than one scenario
lives once in `tools/evaluation/judgments/` instead, and every scenario that
uses it references the shared copy as `"../../judgments/<name>.mjs"` — a
relative path `scenarioRelativePath`'s own pattern already accepts, since it
rejects only an absolute one.

A `patch`, unlike a script, is never shared: [Where a Scenario's Patch
Lives](#where-a-scenarios-patch-lives) above is unchanged by this — a
scenario's defect is its own, even when the fix two scenarios need happens to
read alike. Nothing enforces the one-script-per-name rule across
`scenarios/`; a same-named script under two scenario directories again is a
defect a reviewer catches by reading, the way the drift this convention
replaces was caught in the first place.

## `.claude/agents/` Is the Only Home for an Agent Definition

An agent definition — `.claude/agents/implementer.md`,
`.claude/agents/reviewer.md`, `.claude/agents/investigator.md` — is not a
skill, so `npx skills` does not carry it and it is never installed,
symlinked, or listed in `skills-lock.json`. Only Claude Code is configured
today; [#218](https://github.com/axross/skills/issues/218) tracks the Codex
side for all three.
