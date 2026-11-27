---
type: Procedure
title: Agent Skills
description: Install and refresh distributed skills, check discovery, source identity and active content across hosts, and register adopted deviations from a skill rule.
---

# Agent Skills

Installing and refreshing a skill in this repository, checking discovery in
Codex and Claude Code, inspecting the active source and content in Claude Code
and Amp, and keeping the register of departures from a skill rule that the
maintainer adopted.
[Directory Structure](../conventions/directory-structure.md)
covers where the source and the two installed roots live;
[agent-skill-management](../../skills/agent-skill-management/SKILL.md) covers
the general lifecycle and evidence model these host procedures apply.

For an installed-rule finding or a bounded project exception, use management's
[installed-rule change guidance](../../skills/agent-skill-management/references/installed-rule-changes.md).
It distinguishes local conventions, approved deviations, and upstream proposals.
This operation keeps the [register](#register) of adopted deviations in that
guidance's format, and adds no exception policy of its own.

## Installing and Refreshing

Regenerate `.agents/skills/` from the source under `skills/` with the
`vercel-labs/skills` CLI. `skills@1.7.6` is the version that writes this
repository's `skills-lock.json`; a plain `npx skills` resolves the registry's
latest release, whose refresh rewrites every hash and the lockfile schema
(observed with 1.9.0), so every command here names the version:

```bash
npx --yes skills@1.7.6 add ./skills --agent codex --skill '*' --yes
```

For a targeted refresh, replace `'*'` with the intended skill name. For example:

```bash
npx --yes skills@1.7.6 add ./skills --agent codex --skill agent-skill-management --yes
```

Inspect the installer summary and generated diff before committing. A targeted
refresh MUST NOT become a bulk update or unrelated lockfile cleanup.

The CLI copies rather than symlinks when the source is a local path —
`--copy`'s "instead of symlinking" in the CLI's own help text governs a
remote or `node_modules`-mediated install, not this one — so
`.claude/skills/<name>` is not written by this command. Those links are made
once and simply kept:

```bash
for d in .agents/skills/*/; do
  n=$(basename "$d")
  ln -sfn "../../.agents/skills/$n" ".claude/skills/$n"
done
```

Commit both roots and `skills-lock.json` alongside the source in the same
change — they are tracked artifacts, not build output to leave uncommitted.

## Keeping the Symlink Root in Step

Claude Code's `.claude/skills/` root contains <!-- count:claude-skill-symlinks -->29<!-- /count -->
symlinks into `.agents/skills/`. Claude Code follows each skill directory link
to its `SKILL.md`; the installed bytes remain in one root.

A skill added or removed needs the corresponding `.claude/skills/<name>` link
added or removed with it; the installed-copy check
(`skills/agent-skill-management/scripts/check-installed-copies.mjs`) fails on
either half being missed on its own.

## Check discovery in Codex and Claude Code

Apply [the management evidence model](../../skills/agent-skill-management/references/active-loading.md)
using the current host's inspection route. Codex and Claude Code expose these
discovery checks in a fresh session:

- **Codex** — run `/skills` and inspect the listing and any context-budget
  warnings, not only names.
- **Claude Code** — run `/context` and inspect the skills listed there.

A catalog listing establishes discovery. To check what Claude Code delivered,
inspect a native activation in the actor that needed the skill. Active loading
in Codex remains unverified by the listing.

## Diagnose a same-name skill in Claude Code

1. Record the Claude Code version and consult its [skill location and precedence
   rules](https://code.claude.com/docs/en/skills#choose-where-skills-load).
   Among ordinary enterprise, personal and project roots the documented order is
   enterprise, then personal, then project. A same-name personal install can
   therefore mask a project pin. Plugin-qualified names have a distinct scope.
2. Identify the intended source revision. Compare its body and applicable
   references with the project installation, inspect the relevant
   `skills-lock.json` entry and compare any same-name personal candidate.
   Resolve symlinks before calling two paths different roots.
3. In a fresh session, inspect the intended actor's skill activation and its
   returned `Base directory for this skill:` line where available. Compare the
   resolved directory and the delivered body independently against the declared
   source and expected content. Check delivery of any applicable reference
   separately before relying on its revision. A parent's activation, a
   successful file read or the lockfile hash alone leaves native selection in
   a child unknown.
4. Choose the effective source for the deployment. A project-owned pin can
   govern after the owner resolves a competing personal install. If the
   personal copy is intentional, synchronize its contents with the pin and
   record that the personal root wins. Inspect fresh actor evidence again
   after an authorized change. Record the unchanged-content baseline
   in the comparison before changing the skill, then compare the new
   revision at the same effective level.

Apply these controls to an isolated fixture with identifiable revisions. They
describe expected observations; a fixture cannot qualify a live host.

| Expected test input                       | Source observation                | Content observation                                  |
| ----------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| Expected root and current body delivered  | Matches after resolving any alias | Matches expected body                                |
| A different same-name root wins           | Different resolved root           | Compare independently; synchronized copies can match |
| Expected root but previous body delivered | Matches                           | Stale                                                |
| Catalog or disk inventory only            | Active selection unknown          | Delivery unknown                                     |

A visible base directory with no observable body qualifies only the source.
Keep missing actor, reference or delivery evidence unknown. For an adopter
comparison, retain private paths and transcripts locally and share the result
and its limits in aggregate.

## Verify Amp's selected source and content

Use [Amp's skill documentation](https://ampcode.com/docs/customize/skills)
and check the active session's tool contracts. A child session can expose
different tools from its parent.

Consult the linked documentation for Amp's current precedence when diagnosing
a collision. A local global skill can mask this project.
The `.claude/skills/` name is not a compatibility defect; this repository's
links resolve to the existing `.agents/skills/` content.

After an authorized refresh, verify the intended skill in the active thread:

1. Record the expected source path and a distinguishing passage from the updated
   body. Compare the installed files against source and inspect the lockfile
   diff. For `agent-skill-management`, the installed root is
   `.agents/skills/agent-skill-management`; the `.claude/skills/` link resolves
   there too.
2. Ask Amp to list the available skills and where each came from. For a separate
   shell inventory, use `amp skills list --json`; that inventory does not prove
   the existing thread's state.
3. Use the active thread's `reload_skills` tool. It rescans local directories and
   refreshes server-managed skills. Running `amp skills list` in a shell does
   **not** reload the thread.
4. Invoke the intended skill with the thread's skill-loading tool. Compare the
   returned base directory and body with the expected source and distinguishing
   passage recorded in step 1 for this refresh.
5. Evaluate the returned evidence using the management model linked above.

When the result is missing or unexpected, diagnose before changing files:

- Inspect same-name sources and symlink targets; different path strings can
  resolve to the same content. Identify the actual selected source rather than
  treating every alias as a collision.
- Check `amp.skills.disableClaudeCodeSkills` when only a Claude-compatible
  location is missing. Disabled compatibility discovery does not disable this
  repository's `.agents/skills/` root and does not justify adding another tree.
- Check broken links, source access, and metadata diagnostics separately. Keep
  standard metadata rules with skill authoring. For host extensions, consult
  the active host's documentation rather than removing another host's fields
  merely because Amp does not use them.
- Treat plugin-bundled names such as `<plugin-name>:<skill-name>` as qualified
  names, not bare-name collisions. Do not change plugin registration to repair
  this library's installation.

## Exercise failure cases without changing global skills

Run this matrix when changing the host integration or the loading evidence
model. An ordinary skill-content refresh uses the applicable host procedure
above and does not require this matrix.

Use an isolated test installation and distinct body passages to distinguish
the expected and unexpected sources. Do not edit personal/global skills or
settings for a test without authorization. Exercise the following cases through
the available host, recording its scope separately from static walkthroughs:

| Case                                                | Expected observation                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| Install passes, another same-name source wins       | Installation passes; active source mismatch                                       |
| Disk changes while the session retains the old body | Source agreement passes; active body remains stale until reload and re-invocation |
| Compatibility discovery is disabled                 | Claude-compatible candidate absent; no duplicate tree created                     |
| Source or load evidence is hidden                   | Active verification unavailable, not success                                      |

If an isolated host run is unavailable, record the unexecuted case and its
residual risk. A fixture or walkthrough cannot prove the live host's precedence
or reload behavior.

## When `npx skills` Fails to Resolve

In some environments — a fresh container with no local install, or a stale
npx cache — a bare `npx skills …` aborts with
`npm error could not determine executable to run`, which reads like a broken
command rather than a resolution failure. The commands above name
`skills@1.7.6`, the version recorded for this repository's lockfile, so run them
as written.

If `npx --yes skills@1.7.6 …` itself fails to resolve, report the failure and
what was tried. Do not substitute `skills@latest`: its refresh can rewrite the
lockfile, as [Installing and Refreshing](#installing-and-refreshing) records, so
moving to it is a deliberate, separately scoped change rather than a fallback.

## Register

This register lists the departures from a skill rule that this repository's
maintainer adopted and that travel with its Claude Code files and review
workflow. Each entry follows management's
[deviation register format](../../skills/agent-skill-management/references/installed-rule-changes.md#deviation-register).
It names the rule by its heading path and the commit the rule was re-read at,
a counterexample, what this repository does instead, why, the scope, the
adoption evidence, and when to reassess it. An entry does not quote the skill,
because the skill's text changes with each refresh.

The register is not exhaustive. This repository has not audited its other
documents for departures from a skill rule, and declaring the register
exhaustive without that audit would turn every unlisted departure into a
finding. A departure no entry lists is judged under the validity rules in
management's [installed-rule change guidance](../../skills/agent-skill-management/references/installed-rule-changes.md#distinguish-addition-exception-and-proposal),
not reported for being unlisted.

Adoption evidence follows management's
[installed-rule change guidance](../../skills/agent-skill-management/references/installed-rule-changes.md#distinguish-addition-exception-and-proposal).
In Claude Code the plan approval and the answers to open questions arrive as an
`AskUserQuestion` answer in the session. The answer leaves no human-authored
record on the tracking issue, and the operator login is shared, so the answer is
provenance only. Each entry's adoption evidence is the maintainer's merge of the pull request that resolves
[#770](https://github.com/axross/skills/issues/770), whose body lists each
departure with its rule, counterexample and scope. Where the maintainer posts a
comment on #770 naming the accepted departures, that comment becomes the primary
locator.

Each entry's status and the index follow the
[register format](../../skills/agent-skill-management/references/installed-rule-changes.md#deviation-register).

### Index of Active entries

- [Deviation — combined plan-gate confirmation](#deviation--combined-plan-gate-confirmation)
- [Deviation — the explicit request is asked again, not carried forward](#deviation--the-explicit-request-is-asked-again-not-carried-forward)
- [Deviation — watching conditioned on the human's confirmation](#deviation--watching-conditioned-on-the-humans-confirmation)
- [Deviation — the CI reviewer runs with the Claude App token](#deviation--the-ci-reviewer-runs-with-the-claude-app-token)
- [Deviation — Claude Code host mechanics restated in CLAUDE.md](#deviation--claude-code-host-mechanics-restated-in-claudemd)

### Deviation — combined plan-gate confirmation

- **Rule:** `professional-behavior` › Asking the Human › Decisions in One
  Prompt, checked at 6d01295.
- **Counterexample:** the plan-gate confirmation puts plan approval, delivery of
  the draft pull request, the post-push review route and watching in one prompt.
  The answer "neither" to the delivery question makes the route and watching
  answers inapplicable, so one answer changes what the others mean.
- **What this repository does instead:** [`CLAUDE.md`](../../CLAUDE.md)
  "Confirming Delivery at the Plan Gate" asks all four in one `AskUserQuestion`
  call of at most four questions.
- **Why:** Claude Code conditions pull request creation and subagent spawning on
  the user's explicit request, and the plan-approval exchange is where the human
  is already answering. It is not a skill change because the question tool and
  the host's explicit-request condition are Claude Code mechanics, which
  [Skill Portability](../conventions/skill-portability.md) keeps out of a skill;
  this repository places that guidance in `CLAUDE.md`.
- **Scope:** the plan-gate confirmation only. Every other decision a run puts to
  the human follows the skill's rule, in dependency order.
- **Adoption evidence:** the maintainer's approval at #770's plan gate
  (provenance), confirmed by the maintainer's merge of the pull request that
  resolves #770. Origin only, not evidence here: `axross/claude-loop-template#79`
  and `axross/claude-loop-template#80`, where the template adopted the same
  confirmation.
- **Reassess when:** the skill's section changes, `CLAUDE.md` changes the
  confirmation's questions, or Claude Code stops conditioning those operations
  on the user's explicit request.
- **Status:** Active.

### Deviation — the explicit request is asked again, not carried forward

- **Rule:** `loop-engineering` › Run State and Reporting › Scoped Operation
  Grants, and `loop-engineering` › Phase Progression › Injected Instructions and
  Gates, both checked at 6d01295. The grants section carries a matching grant
  forward and asks only for an absent or expanded effect, and keeps host
  permission prompts and tool usage conditions as boundaries that no grant
  overrides.
- **Counterexample:** in each of three cases the skill carries the matching
  grant forward and asks only for an absent or expanded effect, while this
  repository asks again. The human confirmed delivery and the plan is then
  revised. A fresh session resumes the run with the confirmation recorded in run
  state. The human granted a subagent spawn needed before the plan gate, and the
  roles after the gate need the same kind of spawn.
- **What this repository does instead:** where Claude Code conditions pull
  request creation or a subagent spawn on the user's explicit request, the run
  asks it again in three cases: with every revised plan; once, before any
  further change, in a fresh session whose own conversation lacks the
  confirmation; and, for a subagent needed before the plan gate, once at that
  first need and again at the plan gate for the roles after it.
- **Why:** the host decides what counts as the user's explicit request and
  judges it in the current conversation, so a recorded answer cannot stand in
  for it. The skill itself keeps that host boundary above any grant. An
  unobtained request leaves the gate it serves reported unmet. It is not a skill
  change because the condition belongs to the host, not to the loop.
- **Scope:** operations Claude Code conditions on the user's explicit request,
  that is, opening the pull request and spawning a subagent. Every other effect
  a valid grant covers is carried forward as the skill states.
- **Adoption evidence:** the maintainer's approval at #770's plan gate
  (provenance), confirmed by the maintainer's merge of the pull request that
  resolves #770. Origin only, not evidence here: `axross/claude-loop-template#79`
  and `axross/claude-loop-template#80`.
- **Reassess when:** the skill's sections change, or Claude Code changes what it
  accepts as the user's explicit request.
- **Status:** Active.

### Deviation — watching conditioned on the human's confirmation

- **Rule:** `loop-engineering` › Post-Push Review and Readiness › Waiting Bound,
  checked at 6d01295, which requires using a subscription route when one exists.
- **Counterexample:** the human declines watching at the plan gate while the
  pull request activity subscription exists. The skill requires subscribing;
  this repository does not.
- **What this repository does instead:** the run subscribes only when watching
  was confirmed. When it was declined, each CI or review result becomes a human
  wait and nothing is scheduled in its place; `CLAUDE.md` states the rule and
  its narrow exception.
- **Why:** the maintainer's policy makes watching a question put to the human at
  the plan gate, among the explicit requests the run collects there. It is not a
  skill change because the subscription tools and the plan-gate question are
  Claude Code mechanics.
- **Scope:** the pull request activity subscription. Once watching is confirmed,
  the skill's waiting rule applies as written, including its ban on a scheduled
  check-in beside a subscription.
- **Adoption evidence:** the maintainer's approval at #770's plan gate
  (provenance), confirmed by the maintainer's merge of the pull request that
  resolves #770. Origin only, not evidence here: `axross/claude-loop-template#80`.
- **Reassess when:** the skill's section changes, or `CLAUDE.md` changes the
  watching question.
- **Status:** Active.

### Deviation — the CI reviewer runs with the Claude App token

- **Rule:** `code-review` › Posted and CI Reviews › Running a Reviewer Safely in
  CI, checked at 6d01295, which requires scoping the reviewer's credentials to
  read code and write review comments, and never granting it write access to
  repository contents.
- **Counterexample:** the reviewer's shell holds a token that can push.
  [`claude-review.yaml`](../../.github/workflows/claude-review.yaml) sets
  `contents: read`, which bounds only the workflow token. The action exchanges
  OIDC for a Claude GitHub App installation token, and the action documents that
  token's permissions as including contents read and write.
- **What this repository does instead:** the workflow keeps `contents: read`
  and the base-ref checkout. The reviewer's prompt forbids pushing, committing
  and changing repository contents, which is an instruction, not a technical
  restriction. [Code Review](./code-review.md#run-the-claude-reviewer) states the
  remaining gap. The follow-up
  [#773](https://github.com/axross/skills/issues/773) evaluates the action's
  `github_token` input, which skips the App-token exchange; its documentation
  does not say which identity then posts, whether the code-review plugin's inline
  comments still work, or whether `id-token: write` stays needed.
- **Why:** passing the workflow token is unverified and changes the identity the
  review posts under, so it needs its own evaluation before it replaces the App
  token. It is not a skill change because the skill's rule is right; the
  workflow is the part that falls short of it.
- **Scope:** [`claude-review.yaml`](../../.github/workflows/claude-review.yaml)
  only, and only the contents-write exposure. The rule's other requirements stay
  binding on the workflow.
- **Adoption evidence:** the maintainer's approval at #770's plan gate
  (provenance), confirmed by the maintainer's merge of the pull request that
  resolves #770.
- **Reassess when:** #773 concludes, the action changes its token exchange, the
  App installation's grant changes, or the workflow's token inputs change.
- **Status:** Active.

### Deviation — Claude Code host mechanics restated in CLAUDE.md

- **Rule:** `agent-skill-management` › Agent entry-file contract › What an entry
  file carries, checked at 6d01295, which forbids an entry file from restating a
  rule that a loaded skill owns. `CLAUDE.md` is an entry file in that sense:
  Claude Code loads it in every session and it imports `AGENTS.md`.
- **Counterexample:** `CLAUDE.md` "Waiting on a Pull Request" unsubscribes at
  four points: the ready transition, the round cap, the waiting bound, or the end
  of a run that cannot be marked ready. The skill's Waiting Bound names three
  stops: the ready transition, non-convergence at the round cap, and the waiting
  bound. The two lists already diverge, and the fourth stop is adopted with the
  passage.
- **What this repository does instead:** `CLAUDE.md` keeps five passages that
  each pair a host tool with a rule a skill owns, and routes to the skill for the
  rest:
  1. the subscription bullets in "Waiting on a Pull Request", which restate
     Waiting Bound's teardown rule;
  2. the scheduling-tool list in the same section, which restates Waiting
     Bound's check-in rule;
  3. the Host Mechanics bullet that a subagent returns an unresolved decision to
     the main agent, which restates Asking the Human › Returning a Question You
     Cannot Ask;
  4. the answers "Subagents Before the Plan Gate" and "Confirming Delivery at
     the Plan Gate" record in run state, which restate Run State and Reporting's
     recording rule;
  5. the "Reviewer Instances" subsection, which pairs the agent id, `/tasks` and
     the host's task-stop tool with Loop Engineering › Selecting Review
     Workflows › Review Session and Thread Cleanup.
- **Why:** each passage names the host instrument that carries the rule, which a
  skill may not name, and this repository places Claude Code guidance in
  `CLAUDE.md`. Keeping the passages as the template has them keeps later syncs
  with it mechanical. It is not a skill change because the tool names are host
  mechanics that [Skill Portability](../conventions/skill-portability.md) keeps
  out of a skill.
- **Scope:** the five passages above. A restatement elsewhere in `CLAUDE.md` is
  judged under the validity rules this register's introduction states, not
  covered by this entry.
- **Adoption evidence:** the maintainer's approval at #770's plan gate
  (provenance), confirmed by the maintainer's merge of the pull request that
  resolves #770. Origin only, not evidence here: `axross/claude-loop-template#79`
  and `axross/claude-loop-template#80`, where the template added the file.
- **Reassess when:** the entry-file contract or any of the skill sections the
  five passages restate changes, or `CLAUDE.md` changes one of the passages.
- **Status:** Active.
