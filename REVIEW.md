# Review Instructions

Review **policy** for this repository — the highest-priority, review-only
instructions. Every reviewer entry point reads this file: a managed review
product (e.g. Claude Code's managed Code Review) natively, and the CI
reviewer ([`claude-review.yaml`](.github/workflows/claude-review.yaml)) via a
system-prompt bootstrap. This file overrides reviewer defaults and complements
the review
**methodology** in
[Code Review](.claude/skills/code-review/SKILL.md); where
the two differ about what a posted review reports, this file wins (see that
skill's [Posted and CI Reviews](.claude/skills/code-review/SKILL.md#posted-and-ci-reviews) section).

This is a **strict** review: run every mandatory check below, verify the linked
issue's acceptance criteria, and report every finding — do not wave anything
through.

## Severity Vocabulary for Posted Reviews

A posted review uses the two-label vocabulary — Important and Nit — from
[Code Review](.claude/skills/code-review/SKILL.md)'s
[Posted and CI Reviews](.claude/skills/code-review/SKILL.md#posted-and-ci-reviews)
section, replacing the internal Critical/Major/Minor/Nit triage and the
Approve/Request-Changes verdict for posted output. In this repository a "hard
project rule" — the skill's trigger for labeling a finding Important — is any
MUST rule of a skill whose discovery condition (`description`) matches the
changed files.

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

Run all three checks below on every review and raise a finding for each
miss — they are not skippable. The first two are this repository's specifics
for the mandatory checks in
[Code Review](.claude/skills/code-review/SKILL.md)'s
[Posted and CI Reviews](.claude/skills/code-review/SKILL.md#posted-and-ci-reviews)
section; the third makes the subtractive principle in
[What to Flag: Review Lenses](.claude/skills/code-review/SKILL.md#what-to-flag-review-lenses)'s
maintainability lens mandatory and unconditional here, walking this
repository's own fixed lens list:

- **Skill conformance** — the "project rule" the skill's mandatory checks
  require verifying against is, in this repository, **every skill** whose
  discovery condition (`description`) matches the changed files. Flag any
  deviation from a skill's stated rule, citing the skill and the rule.
- **Acceptance criteria** — the linked issue is the one named by the pull
  request body's `Closes #<n>`. Verify the diff against **every** acceptance
  criterion there; each one unmet, or unconfirmable from the diff, is an
  **Important** finding named explicitly in the summary. If the pull request
  links no issue, say so in the summary.
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

- MUST run all three mandatory checks on every review and raise a finding for
  each miss.
- MUST enumerate every one of the five subtractive lenses above in the summary
  of any review of a content-adding change, recording a finding or an explicit
  "checked, none" against each; a review lacking that enumeration is invalid
  whatever it reported, and a finding under one lens discharges none of the
  others.
- MUST give each finding a severity label, `file:line` evidence, and a concrete
  fix, per
  [Code Review](.claude/skills/code-review/SKILL.md).

## Reading Beyond the Diff

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
  **bytes**; a `references/*.md` file that no `SKILL.md` links; and a
  routing-section bullet opening with an RFC-2119 keyword.
- The `docs/` checks `check-index.mjs`, `check-glossary.mjs`,
  `check-decision-naming.mjs`, and `check-decision-supersede.mjs` enforce, over
  `docs/`: a document `index.md` links from nowhere, and a decision record
  indexed individually instead of through its directory; a spec with no matching
  glossary heading, and a nested `specs/` path; a decision filename that is not
  `YYYY-MM-DD-<decision-in-kebab-case>.md` or whose date is not real; and a
  record declaring no `status` or one whose `status` is neither `accepted` nor
  `superseded`, a `status` and `superseded_by` that disagree in either
  direction, a `superseded_by` naming no record, or a document still citing
  replaced rationale. `check-references.mjs`
  is the fifth of that set and adds nothing here — relative-link integrity is
  already excluded above. What none of them can see stays in scope: whether a
  glossary entry is self-sufficient, whether a fact sits in the one document
  that owns it, and whether a decision record was owed at all.
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
summary comment opening with a tally, nothing summarized away.

**Guidelines:**

- MUST post any pull-request review as a **COMMENT**-type review — never
  APPROVE or REQUEST_CHANGES — per the project's GitHub-operation
  conventions; this reviewer is advisory and does not gate merges.
