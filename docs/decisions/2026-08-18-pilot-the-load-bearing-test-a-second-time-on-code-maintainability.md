---
status: superseded
superseded_by: 2026-08-18-trade-the-load-bearing-hoist-for-a-conditional-read-obligation.md
---

# Pilot the load-bearing test a second time on code-maintainability

## Context

`2026-08-17-keep-a-load-bearing-rule-in-skill-md-not-behind-a-reference-pointer.md`
established a test for where a rule belongs in a split skill — load-bearing
in `SKILL.md`, elaboration in `references/` — and piloted it on exactly one
section of one skill, `react-component-styling`'s `Style Property Order`.
That record measured its own pilot and found the measurement inconclusive
(no probe in the replication run invoked the skill under test at all), and
it says plainly that nothing in it licenses rewriting the other twenty-five
skills that carry a `references/` directory. A later proposal to apply the
test more broadly has to make its own case from its own evidence, not borrow
that one's.

This is that later proposal, and its own case is narrower than the rule it
applies. A request arrived proposing three additions to `code-maintainability`:
a cohesion test for what belongs in one unit, a fallback identifier
vocabulary, and a comment discipline built on a self-explanatory
implementation. Checking the request against the skill before planning found
all three already present in `references/`, several of them down to the same
worked examples the request itself used. `node scripts/report-obligation-burden.mjs`,
re-run from this branch before any edit, reported `code-maintainability` at
2 obligations from `SKILL.md` alone against 73 with every reference read;
both of the two `SKILL.md`-only obligations were the deferral meta-rules, so
every rule the request named was among the 71 reachable only by opening a
reference. That is the same shape 2026-08-17 measured a probe failing to
reach.

A request proposing to add material a skill already states, examples
included, is a signal that the material was not visible to that reader at
the depth an agent reads by default. It is inference about one reader's
encounter with the skill, not a second measurement of the mechanism
2026-08-17 already measured and left unresolved — no evaluation probe ran
against this change, and none is claimed here.

## The decision

Apply the load-bearing test to exactly three sections of `code-maintainability`,
each moved the same way: the rule's own statement and its RFC-2119 bullets
move into `SKILL.md`; the reference keeps rationale, worked examples, and
edge cases, and restates none of the moved bullets.

- **Cohesion**, from `references/abstraction-boundaries.md`: the seven-level
  cohesion table, the name-test table, and all six bullets move into
  `SKILL.md`. The reference keeps why a weak grouping costs every later
  reader, and gains a statement that the scale is non-linear — functional
  cohesion far stronger than the rest, coincidental and logical far weaker
  than the intermediate levels.
- **Default Vocabulary**, from `references/naming-and-organization.md`: the
  five-pattern table and all six bullets move into `SKILL.md`, with
  `isProcessing` added to the `is<Adjective>` row so a present-participle
  state name is covered. The reference keeps why a stated vocabulary is
  worth having and the precedence framing that subordinates it to a project
  convention, an owning capability, or a platform API.
- **Self-Explanatory Implementation**, from `references/complexity-and-readability.md`:
  all five bullets, including the boundary doc-comment criterion, move into
  `SKILL.md`. The reference keeps the paragraph on a comment being the
  fallback rather than the plan, and gains a precision-or-intuition test for
  what a comment must add and a diagnostic that a boundary doc-comment
  leaning on implementation detail is evidence of a shallow interface, not
  of a well-documented one.

No other section of `code-maintainability` moved, and no rule's obligation
changed strength — a MUST stayed a MUST. Both installed skill roots and
`skills-lock.json` were regenerated in the same change.

## What was rejected

- **Only the four content refinements, leaving placement alone.** Cheapest,
  and it touches nothing 2026-08-17 fenced off. Rejected because it would
  leave every rule the request cared about at the depth an agent reads by
  default without ever holding it — the refinements would sharpen text
  nothing loads.
- **Moving every section of `code-maintainability`.** The same test
  arguably reaches file naming, the complexity budget, and dead code.
  Rejected as wider than both the request and the evidence; a corpus-wide
  edit in one step would leave nothing to attribute a later reading to, for
  the same reason 2026-08-17 rejected rewriting all twenty-six skills at
  once.
- **A digest in `SKILL.md` with the full rule left in the reference.**
  Rejected already by 2026-08-17: a digest that drifts from what it
  summarizes is a second failure mode the no-duplication convention did not
  previously have.
- **Making the routing pointer imperative instead of moving anything.**
  Rejected for the reason 2026-08-17 gave for the same alternative — whether
  an imperative pointer is followed is exactly as unmeasured as a
  descriptive one.

## Consequences

`code-maintainability`'s `SKILL.md`-only obligation count is 19, up from 2;
the with-every-reference count stays 73, both measured with
`node scripts/report-obligation-burden.mjs` after this change. That is a
structural claim about where the rules sit, not a claim about what a model
does with them once they are there.

No evaluation instrument ran against this change, and 2026-08-17's own
pilot supplies the reason not to claim one would have settled anything:
its replication run had no `skill-present` probe invoke
`react-component-styling` at all, so whether relocating a rule changes what
a probe produces stayed untested even for the pilot that measured itself.
This change inherits that same open question for `code-maintainability` and
does not claim to have closed it.

This record licenses none of the following: rewriting any other section of
`code-maintainability` (File Naming, Directory Tier, Route File Layout, the
rest of Identifier Naming, Complexity Budget, Magic Values, Dead Code,
Comments and Doc-Comments, Type Reuse, Control Flow, and all of Scope
Discipline stay exactly where they were); rewriting any other skill in the
library; or a claim that this relocation, or 2026-08-17's, has been measured
to change what a model produces. A future proposal to extend the test
further has to make its own case from its own evidence, exactly as
2026-08-17 required of this one.
