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

A posted review uses exactly two labels. The internal Critical/Major/Minor/Nit
triage and the Approve / Request-Changes verdict vocabulary stay out of posted
output — they exist for self-review, not for the pull-request thread.

- **Important** — MUST be addressed before merge: a finding that breaks
  behavior, corrupts persisted state, leaks data, regresses accessibility,
  violates a MUST rule of a matching skill (discovered by its
  `description`/`when_to_use`), or leaves an acceptance criterion unmet or
  unverifiable from the diff.
- **Nit** — safe to defer: style, naming, and refactoring suggestions.

**Guidelines:**

- MUST label every posted finding exactly **Important** or **Nit** — no other
  labels appear in a posted review.
- MUST label as Important every violated MUST rule of a matching
  skill, every acceptance criterion that is unmet or cannot
  be confirmed from the diff, and every mandatory-check miss that breaks a hard
  requirement.
- MUST label style, naming, and refactoring suggestions Nit at most.

## Repository Severity Floors

On top of the generic severity floors in
[Code Review](.claude/skills/code-review/SKILL.md), this Markdown-skills
repository fixes minimum severities for its own recurring defect classes. These
govern **internal** self-review triage; a posted review still suppresses any row
the [Do Not Report](#do-not-report) list excludes as CI-enforced, and maps what
remains onto the Important/Nit labels above.

| Category                                                                                                       | Minimum severity |
| -------------------------------------------------------------------------------------------------------------- | ---------------- |
| A broken relative link introduced, or a link that misroutes to the wrong skill or reference                    | Critical         |
| Malformed skill frontmatter (`name`, `description`, `when_to_use`) that breaks the skill's discovery/loading   | Critical         |
| A skill's `description`/`when_to_use` no longer matches its content, so it misroutes or fails to be discovered | Major            |
| A rule duplicated across skills instead of having one source of truth, so the copies can silently diverge      | Major            |
| Inconsistent file/identifier naming that breaks the directory's established convention                         | Minor            |

**Guidelines:**

- MUST classify each listed category at no lower than its minimum severity in
  internal self-review triage.
- MAY raise severity above the floor when the concrete impact is worse.

## Mandatory Checks

Run both checks on every review and raise a finding for each miss — they are
not skippable. Grade each miss by its real impact: a miss that breaks a hard
requirement is **Important**, a gap that does not is a **Nit**. Cite the owning
skill in the finding.

- **Skill conformance** — verify the change conforms to **every** skill whose
  discovery condition (`description`/`when_to_use`) matches the
  changed files, and flag any deviation from a skill's stated rule, citing the
  skill and the rule. A violated skill **MUST** rule is Important.
- **Acceptance criteria** — verify the diff against **every** acceptance
  criterion in the linked issue (the pull request body's `Closes #<n>`), when
  the pull request links one. Each criterion that is unmet, or that cannot be
  confirmed from the diff, is an **Important** finding named explicitly in the
  summary. If the pull request links no issue, say so in the summary.

**Guidelines:**

- MUST run both mandatory checks on every review and raise a finding for each
  miss.
- MUST give each finding a severity label, `file:line` evidence, and a concrete
  fix, per
  [Code Review](.claude/skills/code-review/SKILL.md).

## Do Not Report

Findings the project's CI already enforces mechanically are noise in a posted
review — CI blocks the merge regardless, so restating them costs the author's
attention without adding a gate. This exclusion governs **posted** reviews
only; internal self-review triage still flags these findings.

The list is **enumerated, not generalized**, and deliberately so: a blanket
"anything CI enforces" silently widens every time a check joins
[`merge-checks.yaml`](.github/workflows/merge-checks.yaml), removing categories
from this reviewer's scope without anyone deciding to. Each entry below names a
check that is **coextensive** with the finding it excludes — the mechanical
check and the finding are the same thing. A check that is only a narrow proxy
for a broader prose rule does **not** silence the reviewer on that rule.

- The format and lint checks run by the project's merge-checks workflow.
- Relative-link integrity — a relative Markdown link whose target file does not
  resolve on disk.
- The structural checks `check-skill.mjs` enforces: a frontmatter block that
  does not parse; a `name` that is not kebab-case, exceeds 64 characters, or
  does not match its directory; a missing `description`, or one over 1,024
  characters; `description` + `when_to_use` over 1,536 characters; a
  `references/*.md` file that no `SKILL.md` links; and a routing-section bullet
  opening with an RFC-2119 keyword.
- A content mismatch between a `skills/<name>/` source and its generated
  `.claude/skills/<name>/` copy.
- Lockfiles and generated files.

Two [Repository Severity Floors](#repository-severity-floors) rows stay **fully
in scope** for exactly the proxy reason above, and are called out so they are
not mistaken for CI-covered:

- **Malformed frontmatter that breaks discovery/loading.** `check-skill.mjs`
  checks presence, kebab-case, length caps, and the directory match — a narrow
  subset of what a discovery runtime actually rejects at load time.
- **A `description`/`when_to_use` that no longer matches its content.** Semantic,
  and mechanically undecidable; nothing in CI touches it.

**Guidelines:**

- MUST NOT report, in a posted review, any finding on the do-not-report list
  above.
- MUST keep reporting a finding whose CI check is only a narrow proxy for a
  broader rule, including the two rows named above; a partial mechanical check
  never removes a prose rule from this reviewer's scope.
- MUST add an entry to the list above only when a new CI check is coextensive
  with the category it would silence, and MUST NOT restore a blanket
  "anything CI enforces" clause in its place.

## Reporting

Anchor each finding as an inline comment on the diff, and post one summary that
opens with a one-line tally (e.g. `2 important, 7 nits`). There is no nit cap
and nothing is summarized away — the tally counts every finding.

**Guidelines:**

- MUST report **every** finding; the same nit repeated across the diff MAY
  share one inline comment that lists each occurrence.
- MUST keep reporting to two shapes — inline comments for the findings, one
  comment for the summary — and MUST NOT scatter individual findings across
  separate top-level conversation comments.
- MUST post any pull-request review as a **COMMENT**-type review — never
  APPROVE or REQUEST_CHANGES — per the project's GitHub-operation
  conventions; this reviewer is advisory and does not gate merges.
