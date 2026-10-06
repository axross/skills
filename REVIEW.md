# Review Instructions

This file defines the required repository review **policy**, complementing the
**methodology** in [Code Review](.claude/skills/code-review/SKILL.md). Where the
two differ about what a posted review reports, this file wins (see that
skill's [Posted and CI Reviews](.claude/skills/code-review/SKILL.md#posted-and-ci-reviews) section).

The CI reviewer ([`claude-review.yaml`](.github/workflows/claude-review.yaml))
routes to this file via its system-prompt bootstrap.
[AGENTS.md](AGENTS.md)'s Code Review Rules directs repository reviewers,
including Codex, here. These entry points state the required behavior; they do
not prove that a hosted provider loaded the file or can replace its native
report format. [Code Review operations](docs/operations/code-review.md) owns
qualification of policy delivery and published output. Unverified capability
does not relax the policy below.

This is a **strict** review: run every mandatory check below, assess the
acceptance criteria the pull request body carries within the scope below, and
report every finding. The criteria a review is measured against are on
the pull request itself; no reviewer here opens the tracking issue to find them.

## Severity Vocabulary for Posted Reviews

A posted review uses the two-label vocabulary — Important and Nit — from
[Code Review](.claude/skills/code-review/SKILL.md)'s
[Posted and CI Reviews](.claude/skills/code-review/SKILL.md#posted-and-ci-reviews)
section, replacing the internal Critical/Major/Minor/Nit triage and the
Approve/Request-Changes verdict for posted output. In this repository a "hard
project rule" — the skill's trigger for labeling a finding Important — is any
MUST rule of a skill whose discovery condition (`description`) matches the
changed files, subject to Code Review's acceptance-criteria finding boundary.

**Guidelines:**

- MUST label as Important a violation of a MUST rule belonging to any skill
  whose `description` matches the changed files, citing the skill and the
  rule.

## Repository Severity Floors

On top of the generic severity floors in
[Code Review](.claude/skills/code-review/SKILL.md), this Markdown-skills
repository fixes minimum severities for its own recurring defect classes. These
govern **internal** self-review triage; a posted review still suppresses any row
the [Do Not Report](#do-not-report) list excludes as CI-enforced, and maps what
remains onto the Important/Nit labels above.

| Category                                                                                                  | Minimum severity |
| --------------------------------------------------------------------------------------------------------- | ---------------- |
| A broken relative link introduced, or a link that misroutes to the wrong skill or reference               | Critical         |
| Malformed skill frontmatter (`name`, `description`) that breaks the skill's discovery/loading             | Critical         |
| A skill's `description` no longer matches its content, so it misroutes or fails to be discovered          | Major            |
| A rule duplicated across skills instead of having one source of truth, so the copies can silently diverge | Major            |
| Inconsistent file/identifier naming that breaks the directory's established convention                    | Minor            |

**Guidelines:**

- MUST classify each listed category at no lower than its minimum severity in
  internal self-review triage.
- MAY raise severity above the floor when the concrete impact is worse.

## Mandatory Checks

Run every check below on every review and raise findings within its scope —
the checks are not skippable. The first two are this repository's specifics
for the mandatory checks in
[Code Review](.claude/skills/code-review/SKILL.md)'s
[Posted and CI Reviews](.claude/skills/code-review/SKILL.md#posted-and-ci-reviews)
section; the refactoring check uses its review lenses, and the subtractive pass
makes the subtractive principle in
[What to Flag: Review Lenses](.claude/skills/code-review/SKILL.md#what-to-flag-review-lenses)'s
maintainability lens mandatory and unconditional here, walking this
repository's own fixed lens list:

- **Skill conformance** — the "project rule" the skill's mandatory checks
  require verifying against is, in this repository, **every skill** whose
  discovery condition (`description`) matches the changed files. Flag any
  deviation from a skill's stated rule, citing the skill and the rule.
- **Acceptance criteria** — the pull request body carries them, under its
  **Acceptance criteria** section. Apply the
  [review lenses](.claude/skills/code-review/references/review-lenses.md)'
  Acceptance Criteria boundary: report code-demonstrable violations as
  **Important**, anchored inline where possible or in the summary's no-line
  entry otherwise. Do not resolve `Closes #<n>` to find criteria; a body stating
  no acceptance criteria remains an **Important** finding.
- **Refactoring opportunities** — apply the review lenses' scoped examination
  of changed code under the existing evidence and severity rules.
- **Subtractive pass** — on every content-adding change, walk this fixed lens
  list:
  1. **Duplicated judgment** — a rule the change states that a tool-agnostic
     neighbour already owns.
  2. **Reproduced upstream** — vendor documentation copied in where a link plus
     the non-obvious caveat would carry it.
  3. **General knowledge** — content the model already holds, restated as
     though it were project-specific.
  4. **Routing concreteness** — a routing bullet that gestures at a fact
     instead of stating it.
  5. **Obligation burden** — the rule count the change adds, set against peer
     skills of comparable scope.

  The list is a floor, not a closed set. A lens added later joins the
  enumeration without changing the check's shape, and a defect matching none of
  them is still a finding.

**Guidelines:**

- MUST run every mandatory check above on every review and report findings
  within its scope.
- MUST walk all five subtractive lenses above on every review of a
  content-adding change, recording each lens's outcome in the internal
  review report; a finding under one lens discharges none of the others,
  and each such finding is reported like any other finding — anchored
  inline and counted in the tally — with nothing written in a posted
  summary about a lens that found nothing.
- MUST give each finding a severity label, `file:line` evidence, and a
  concrete fix, per [Code Review](.claude/skills/code-review/SKILL.md).

## Reading Beyond the Diff

The former entry-file review reminders route to their existing detailed owners:

- When skill scope changes, compare `description` with the new body and state
  in the pull request whether discovery still routes correctly.
- For gate-set changes, check all four records named by
  [Verification Gates](docs/conventions/verification-gates.md).
- For generated skill changes, follow
  [Agent Skills](docs/operations/agent-skills.md); source and installed copies
  belong in the same change, not hand-edited installations.
- For scheduled link audits, apply Verification Gates' schedule-only and
  read-only-token requirements.
- For numbers in prose, apply [Marked Counts](docs/conventions/marked-counts.md).
  Verify an unmarked changed count by hand rather than assuming CI checks it.

[Code Review](.claude/skills/code-review/SKILL.md)'s
[Review Scoping](.claude/skills/code-review/SKILL.md#review-scoping) section
(see [scoping.md](.claude/skills/code-review/references/scoping.md)'s Boundary
Claims section) requires checking every boundary claim a change makes against
the neighbour it names — opening owners and scope-overlapping neighbours
alike, with a file's being outside the diff no exemption. In this repository
the units it governs are skills and their reference files, and the boundary
text is the deferral prose: a routing bullet's "See `x.md` for:" list, or a
sentence citing another skill instead of restating its rule.

## Do Not Report

[Code Review](.claude/skills/code-review/SKILL.md)'s
[Posted and CI Reviews](.claude/skills/code-review/SKILL.md#posted-and-ci-reviews)
section requires a posted review's do-not-report list to be enumerated rather
than generalized, with each entry coextensive with the finding it excludes.
This is that list for this repository:

- The format and lint checks run by the project's merge-checks workflow.
- Relative-link integrity — a relative Markdown link whose target file does not
  resolve on disk.
- A heading-anchor fragment that resolves to no heading in its target file,
  **within a skill's `SKILL.md` or `references/*.md`** — the only files the
  skill-structure checks scan. The scope qualifier is load-bearing: an anchor in
  a repository-root document such as this one is checked by nothing, so keep
  reporting it. A fragment that resolves to the _wrong_ heading is a misroute
  no check can see, and stays in scope everywhere.
- The structural checks `check-skill-frontmatter.mjs`, `check-skill-body.mjs`,
  and `check-skill-references.mjs` enforce: a frontmatter block that
  does not parse; a `name` that is not kebab-case, exceeds 64 characters, or
  does not match its directory; a missing `description`, or one whose UTF-8
  length exceeds <!-- count:skill-description-byte-cap -->1024<!-- /count -->
  **bytes**; a `references/*.md` file that no `SKILL.md` links; a
  routing-section bullet opening with an RFC-2119 keyword; in a `SKILL.md`, a
  `**Guidelines:**` block introduced by reference routing, even when empty
  or containing only read obligations; and an unclosed fenced block in a
  `SKILL.md` or a `references/*.md` file, which hides everything after it
  from every other check.
- The `docs/` checks `check-index.mjs` and `check-glossary.mjs` enforce, over
  `docs/`: a document `index.md` links from nowhere; and a spec with no
  matching glossary heading, or a nested `specs/` path. `check-references.mjs`
  is the third of that set and adds nothing here — relative-link integrity is
  already excluded above. What none of them can see stays in scope: whether a
  glossary entry is self-sufficient, whether a fact sits in the one document
  that owns it, and whether a rule carries the reasoning that makes it
  legible.
- A content mismatch between a `skills/<name>/` source and its generated
  installed copy, or a `.claude/skills/<name>` symlink that does not resolve —
  the drift gate compares the source through the symlink tier, so one run
  covers both.
- Lockfiles and generated files.

Two [Repository Severity Floors](#repository-severity-floors) rows stay **fully
in scope** for exactly the proxy reason above, and are called out so they are
not mistaken for CI-covered:

- **Malformed frontmatter that breaks discovery/loading.**
  `check-skill-frontmatter.mjs`
  checks presence, kebab-case, length caps, and the directory match — a narrow
  subset of what a discovery runtime actually rejects at load time.
- **A missing or wrong `user-invocable`.** CI stopped checking it: it is a host
  extension rather than an Agent Skills field, and the validator that ships to
  other projects cannot require what their host ignores. Nothing mechanical
  covers it now, so it is a reviewer's job to catch. Its companion `when_to_use` is
  no longer carried by any skill here — the trigger lives in `description` —
  so a diff that reintroduces the field is itself the finding.
- **A `description` that no longer matches its content.** Semantic,
  and mechanically undecidable; nothing in CI touches it.

**Guidelines:**

- MUST keep reporting the two rows named above (malformed frontmatter and a
  missing or wrong `user-invocable`) as findings, per
  [Code Review](.claude/skills/code-review/SKILL.md)'s narrow-proxy rule; they
  are not covered by the do-not-report list above, however similar the
  underlying checks look.

## Reporting

[Code Review](.claude/skills/code-review/SKILL.md)'s
[Posted and CI Reviews](.claude/skills/code-review/SKILL.md#posted-and-ci-reviews)
section owns the reporting shape — inline comments anchored to the diff, one
summary comment opening with a tally, findings and explicit limitations without
affirmative enumeration of successful checks. Independent-review completion
and readiness follow
[Loop Engineering](skills/loop-engineering/references/independent-review.md);
reviewer silence does not waive contributor verification or evidence obligations.

**Guidelines:**

- MUST post any pull-request review as a **COMMENT**-type review — never
  APPROVE or REQUEST_CHANGES — per the project's GitHub-operation
  conventions; this reviewer is advisory and does not gate merges.
