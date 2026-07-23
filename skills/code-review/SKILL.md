---
name: code-review
description: A complete, self-contained methodology for reviewing a code change — a pull request, a branch or commit-range diff, or your own work before you call it done. Covers the reviewer-mode reset and diff scoping; a four-tier severity scale with fixed severity floors and a verdict mapping; evidence-based reporting with file-line citations and diff-style fix snippets; constructive, blame-free tone; escalation and decision-deferral for high-risk changes; a posted/CI-review overlay that collapses to an Important/Nit, comment-only report; and what-to-flag review lenses for correctness, maintainability, security and privacy, testing and verification, and performance and reliability. Self-contained — it references no other skill and no repository-root file, so it works installed on its own.
when_to_use: Apply at the start of EVERY code review — a pull request, a branch or commit-range diff, or a post-implementation self-review of your own change before claiming it is done. Invoke as `/code-review` (optionally with a PR reference, branch name, or commit range; empty reviews the working tree against the base branch). Not for writing the change itself — only for judging a change that already exists.
user-invocable: true
argument-hint: "[pr-url | branch | commit-range] (empty = working tree vs base)"
---

# Code Review

Apply these rules at the start of every code review, whatever the change type, language, or domain. The skill is self-contained: every rule it needs lives here, so it stays correct when installed on its own without any companion skill.

A review has one job — decide whether a change is safe to merge and say why, with evidence — and one output: a report. It does not rewrite the code. Keep finding problems separate from fixing them.

## Core Review Loop

A review is only trustworthy when the reviewer inspects the actual change as if someone else wrote it, rather than re-affirming the reasoning that produced it. This matters most for self-review, where the author and reviewer are the same agent: without a deliberate reset, self-review just re-runs the implementation's own justifications.

**Guidelines:**

- MUST stop editing before reviewing; a review phase produces a report, not a patch.
- MUST reread the original request and the change's acceptance criteria before inspecting any code.
- MUST run `git status` and inspect the relevant `git diff` before opening surrounding files, so the change's true scope is established from the diff, not from memory.
- MUST judge only the diff and its observable behavior, not the author's stated intent.
- MUST treat prior implementation reasoning as unverified until the diff and verification evidence support it.
- MUST fix Critical or Major findings in a later implementation phase, then perform a second-pass re-review of the new diff.
- MUST report verification evidence, or explicitly named skipped checks and residual risk, before calling a change reviewed.

## Review Scoping

See [scoping.md](./references/scoping.md) for:

- performing the reviewer-mode reset and establishing scope from `git status` / `git diff` / a PR diff
- distinguishing in-scope (the diff) from out-of-scope (pre-existing) code
- reading the full file and every caller/callee around a changed hunk
- handling untracked files, an empty or unclear diff, and generated / tool-managed files

## Severity Classification

See [severity.md](./references/severity.md) for:

- the Critical / Major / Minor / Nit definitions, each pairing a merge impact with a defect class
- the fixed severity floors for categories such as committed secrets, missing access control, unsanitized input, and introduced test or lint failures
- mapping severity counts to an Approve / Approve with Nits / Request Changes verdict
- resolving uncertain severity by escalating upward and stating the assumption

## What to Flag: Review Lenses

See [review-lenses.md](./references/review-lenses.md) for:

- the correctness lens: logic errors, edge cases, error and async handling, contract changes
- the maintainability lens: naming, organization, abstraction boundaries, complexity, dead code, scope discipline
- the security and privacy lens: secrets, input validation, access control, injection, SSRF, auth, data exposure, supply chain
- the testing and verification lens: coverage, stable test hooks, snapshots, flakiness, manual checks
- the performance and reliability lens: data-access cost, concurrency, caching, asset and bundle weight, failure modes

## Evidence and Reporting

See [evidence-and-reporting.md](./references/evidence-and-reporting.md) for:

- the mandatory `file:line` citation on every finding and quoting the offending code
- diff-style (`-`/`+`) fix snippets for every Critical and Major finding
- the exact review-report section order, from Summary through Recommended Actions
- what counts as evidence versus assertion, and how to mark findings the reviewer could not verify

## Review Tone

See [tone.md](./references/tone.md) for:

- addressing the code, not the author, and stating the concrete risk behind each finding
- acknowledging real strengths without inflating trivial ones
- keeping style and preference out of blocking severities
- flagging assumptions explicitly and leaving human-authored copy to its authors

## Escalation and Decisions

See [escalation.md](./references/escalation.md) for:

- keeping the review reporting-only — no code mutation, no delegating the review away
- making each fix trivially applicable and pairing it with its verification step
- escalating high-risk changes to an external gate instead of self-approving them
- deferring genuine trade-offs back to the caller as enumerated Decision-needed entries

## Posted and CI Reviews

See [posted-review-policy.md](./references/posted-review-policy.md) for:

- when a review is _posted_ to a pull request (a CI reviewer or a managed review product) rather than kept as internal self-review
- collapsing the internal four-tier triage to a two-label Important / Nit report with a one-line tally
- running the repository's mandatory checks and honoring its do-not-report exclusions
- keeping a posted review advisory: comment-only, never an approving or blocking formal review
