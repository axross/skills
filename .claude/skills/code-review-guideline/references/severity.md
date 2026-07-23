# Severity Classification

Apply these rules to label every finding before reporting it. Severity drives both the final verdict and the order findings appear in the report.

## Severity Definitions

Four severities order every finding and drive the verdict. Each pairs a merge impact with the class of defect that earns it.

- **Critical** — MUST block merge. A defect that will cause data loss, a security breach, a broken `main` branch (lint/format/link-check failure), or a violation of a developer-facing MUST rule that any consumer of the skill hits on first use.
- **Major** — SHOULD block merge unless deferred deliberately. A defect that degrades correctness, performance, or reliability in a way users notice, or violates a developer-facing SHOULD rule with no documented justification.
- **Minor** — Non-blocking but worth addressing. Readability, naming, or small refactor opportunities; missing-but-non-critical test coverage; non-load-bearing convention drift.
- **Nit** — Optional polish. Style preferences, alternative phrasings, micro-optimizations with no measurable benefit.

**Guidelines:**

- MUST classify every finding as exactly one of the four severities above.
- MUST treat Critical as merge-blocking, and Major as merge-blocking unless deferred deliberately with a stated reason.

## Required Severity Floors

These categories use fixed minimum severities, regardless of perceived "smallness":

| Category                                                                                                                         | Minimum severity |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Hardcoded secret, token, or credential committed to the repo                                                                     | Critical         |
| Lint error introduced (npm run lint would fail)                                                                                  | Critical         |
| A broken relative link introduced (the relative-link check would fail), or a link that misroutes to the wrong skill or reference | Critical         |
| Malformed skill frontmatter (`name`, `description`, `when_to_use`) that breaks the skill's discovery or loading                  | Critical         |
| New dependency added without justification per the project's development guidelines (change-management rules)                    | Major            |
| A skill's `description`/`when_to_use` no longer matches its content, so it misroutes or fails to be discovered                   | Major            |
| A rule duplicated across skills instead of having one source of truth, so the copies can silently diverge                        | Major            |
| `try`/`catch` placed in a nested helper instead of the root call site (in a script)                                              | Major            |
| A swallowed error (caught and ignored) instead of being rethrown or surfaced                                                     | Major            |
| Magic value introduced in a script where a shared constant already exists                                                        | Minor            |
| Inconsistent file/identifier naming (e.g., a file that breaks the directory's established naming convention)                     | Minor            |

**Guidelines:**

- MUST classify each listed category at no lower than its minimum severity.
- MAY raise severity above the floor when the concrete impact is worse than the table's minimum.
- MUST NOT surface CI-enforced rows — any category the project's posted-review policy excludes as CI-enforced, such as the lint-error row — in a **posted** PR review; the policy's do-not-report list excludes them (see the [Repository Review Policy Overlay](../SKILL.md#repository-review-policy-overlay)). The severity floors above govern only internal self-review triage.

## Verdict Mapping

The reviewer MUST emit one of these three verdicts in the report Summary, derived from the severity counts:

- **Request Changes** — at least one Critical finding, OR more than two Major findings.
- **Approve with Nits** — zero Critical, at most two Major, and at least one Minor or Nit.
- **Approve** — zero Critical, zero Major, zero Minor, and at most a few Nits.

**Guidelines:**

- MUST derive the review verdict from the severity counts exactly as mapped above.
- SHOULD, for a **posted** PR review, replace this three-verdict output with the posted-review policy's one-line Important/Nit tally per the [Repository Review Policy Overlay](../SKILL.md#repository-review-policy-overlay).

## When in Doubt

The two directions of misclassification are not symmetric: an over-labeled finding costs a little of the author's attention, while an under-labeled one can ship a production incident.

**Guidelines:**

- SHOULD escalate uncertain severity upward, not downward. A finding labeled Major that turns out to be Minor wastes the author's attention; a Critical mislabeled as Minor causes a production incident.
- MUST state the assumption that drove the severity choice when uncertain (e.g., "Critical because I'm assuming this route is public; downgrade to Major if it's behind admin auth").
