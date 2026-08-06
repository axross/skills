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
  `description`), or leaves an acceptance criterion unmet or
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

Run all three checks on every review and raise a finding for each miss — they
are not skippable. Grade each miss by its real impact: a miss that breaks a hard
requirement is **Important**, a gap that does not is a **Nit**. Cite the owning
skill in the finding.

- **Skill conformance** — verify the change conforms to **every** skill whose
  discovery condition (`description`) matches the
  changed files, and flag any deviation from a skill's stated rule, citing the
  skill and the rule. A violated skill **MUST** rule is Important.
- **Acceptance criteria** — verify the diff against **every** acceptance
  criterion in the linked issue (the pull request body's `Closes #<n>`), when
  the pull request links one. Each criterion that is unmet, or that cannot be
  confirmed from the diff, is an **Important** finding named explicitly in the
  summary. If the pull request links no issue, say so in the summary.
- **Subtractive pass** — on a change that adds content, say what should be
  **cut** and why. The other two checks ask whether what is present is correct;
  only this one can see what should not be present at all. Silence here is a
  claim rather than a default: every review of a content-adding change walks
  each lens below in its summary and records either a finding or an explicit
  "checked, none". Finding something under one lens discharges none of the
  others.
  1. **Duplicated judgment** — a rule the change states that a tool-agnostic
     neighbour already owns.
  2. **Reproduced upstream** — vendor documentation copied in where a link plus
     the non-obvious caveat would carry it.
  3. **General knowledge** — content the model already holds, restated as
     though it were project-specific.
  4. **Routing concreteness** — a routing bullet that gestures at a fact
     instead of stating it.
  5. **Obligation load** — the rule count the change adds, set against peer
     skills of comparable scope.

  The list is a floor, not a closed set. A lens added later joins the
  enumeration without changing the check's shape, and a defect matching none of
  them is still a finding.

**Guidelines:**

- MUST run all three mandatory checks on every review and raise a finding for
  each miss.
- MUST enumerate every subtractive lens in the summary of any review of a
  content-adding change, recording a finding or an explicit "checked, none"
  against each; a review lacking that enumeration is invalid whatever it
  reported, and a finding under one lens discharges none of the others.
- MUST give each finding a severity label, `file:line` evidence, and a concrete
  fix, per
  [Code Review](.claude/skills/code-review/SKILL.md).

## Reading Beyond the Diff

A change that adds or edits a skill makes claims about its own boundaries — the
neighbours it names as owners, the rules it says it defers to rather than
restates. Those claims are checkable only against the neighbour's text, which by
construction is not in the diff. A review confined to changed files can confirm
that a deferral was written; it cannot confirm the deferral is true, and it
cannot see the sections that should have had one and do not.

**Guidelines:**

- MUST open every skill the change's own boundary text names as an owner, and
  compare the change against what that owner actually states, section by
  section.
- MUST additionally open any skill whose declared scope overlaps the change's
  topic, whether or not the change names it; a change that duplicates without
  deferring names no owner to follow, and is the case this check most needs to
  reach.
- MUST treat a file being outside the diff as no exemption from reading it;
  opening a neighbour is the cost of checking a boundary claim, not extra
  scope.
- MUST NOT generalize from one compliant instance to the whole change — a
  single correct deferral is evidence about that section and no other.
- MUST report a duplicated rule as a finding even where the change cites the
  owner, whenever the citation sits beside a restatement instead of replacing
  it.

## What Is Not Evidence

The author's own account of a change cannot corroborate it. A verification
table, a criteria checklist, and a disclosed figure are all products of the same
loop that produced the diff, so agreement between them and the change is
self-consistency, not correctness. A review that re-runs the author's checks and
confirms the author's numbers has audited the arithmetic, not the change.

Self-authored acceptance criteria carry a specific blind spot worth naming.
Criteria asserting that something is **present** are monotone in content: adding
text can satisfy them but never violate them. A change can therefore meet every
criterion and still be substantially duplication and bloat.

**Guidelines:**

- MUST NOT treat the pull request body's verification table as evidence of
  correctness; that the diff matches the numbers in the description is a
  consistency check the author already ran.
- MUST NOT treat "all acceptance criteria met" as sufficient when the criteria
  were authored in the same loop as the change; search separately for what
  presence-only criteria cannot detect — duplication, bloat, and content that
  should have been cut.
- MUST compare the actual against any expected numeric band stated in a linked
  issue or plan, and raise a finding when it falls outside; the author having
  disclosed the miss does not discharge it.
- MUST treat a fired tripwire as a finding wherever the expectation was
  recorded — a band that lived only in issue prose still binds the review.
- SHOULD re-derive a figure the review relies on rather than quoting the
  author's, and say so in the summary when it could not be re-derived.

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
- The corpus checks `check-index.mjs`, `check-glossary.mjs`,
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
