---
status: accepted
---

# Keep a load-bearing rule in SKILL.md, not behind a reference pointer

## Context

This library's [`agent-skill-authoring`](../../skills/agent-skill-authoring/SKILL.md)
skill teaches progressive disclosure: a parent `SKILL.md` that agents load by
default, and `references/` files an agent opens only on demand. Four rules in
[`progressive-disclosure.md`](../../skills/agent-skill-authoring/references/progressive-disclosure.md)
governed that split before this change, each defensible taken alone:

| Rule                                                                                                       | What it required                                   |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| "MUST move detailed rule content into reference files once progressive disclosure is introduced"           | the rule leaves `SKILL.md`                         |
| "MUST put normative requirement bullets in the detailed reference file, not in the parent routing section" | the obligation leaves `SKILL.md`                   |
| "MUST keep parent routing bullets descriptive; do not use RFC-2119-style requirement keywords"             | nothing in `SKILL.md` may say an obligation exists |
| "MUST NOT put detailed normative rules in both the index and a reference file"                             | and it may not be restated there either            |

Composed, these four rules guarantee that an agent which loads a split
`SKILL.md` and opens no reference receives a list of topics and no statement
anywhere that it is under an obligation. That is not a prompting accident; it
is what the rules, taken together, mandate — and it is the designed behaviour
of a convention nobody had measured against a real task until now.

**The measurement.** Issue #411 dispatched this library's evaluation
instrument against `give-the-empty-post-list-a-real-empty-state`, a scenario
targeting [`react-component-styling`](../../skills/react-component-styling/SKILL.md).
Five of six probes completed (the sixth was lost to an unrelated teardown
defect, filed as #413). The scenario's outcome factor
`follows-the-taught-property-group-order` — whether the CSS a probe wrote
follows the fifteen-group property order that skill teaches — came out
**`false` in all five probes, both conditions**. The factor script was
checked by hand against a probe's actual output and is correct: the CSS
genuinely violates the taught order.

The decisive check was not the script. `react-component-styling`'s `SKILL.md`
did not carry the group order; it carried a routing pointer to
`references/style-property-order.md`. Grepping every `skill-present`
transcript for strings that appear only inside that reference file —
`"Placement in the parent"`, `"Interaction and reset"` — returned **0
occurrences across all three**. Not one probe opened the reference. Two of
the three invoked the skill, read `SKILL.md`, saw the pointer, and never
followed it; the third reached for a peer skill instead. The rule did not
fail to persuade — it never reached the model.

**How much of the library sits behind the same shape.** Counted from the
source tier at commit `7235afe`, the base this change and #411's measurement
both work from:

|                                                   |                                          |
| ------------------------------------------------- | ---------------------------------------- |
| Skills, and skills with a `references/` directory | 29, of which 26                          |
| Reference files                                   | 281                                      |
| `SKILL.md` prose, all skills                      | 325,427 bytes                            |
| `references/` prose, all skills                   | 1,938,098 bytes — **85.6%** of the total |

`scripts/report-obligation-burden.mjs` reports the same asymmetry in the unit
that actually matters — obligations an agent holds, not bytes on disk. Its
floor counts `SKILL.md` bodies alone; its ceiling adds every reference an
agent could open:

```
Floor   (SKILL.md bodies alone):      211 obligations, ~68,367 tokens
Ceiling (every reference read too): 5,321 obligations, ~475,530 tokens
```

**96% of this library's rules — 5,110 of 5,321 — are reachable only by
opening a reference.** For `react-component-styling` specifically, the floor
was 6 obligations against a ceiling of 230: an agent that loaded the skill
and followed no pointer held 6 of its 230 rules. #411's probes were observed
operating at that floor.

## The decision

**A rule is load-bearing when an agent that loads `SKILL.md` and opens no
reference would produce wrong output for want of it** — it has to be held
before the work starts, not looked up once the reader already knows the
question exists. Applied per reference, the test sorts a skill's material in
two: a load-bearing rule's own statement and its RFC-2119 bullets belong in
`SKILL.md`; worked examples, rationale, and edge cases — what elaborates the
rule rather than states it — belong in `references/`.

`progressive-disclosure.md`'s four rules above are amended so a load-bearing
rule's statement can leave the reference and reach `SKILL.md`, without
opening the door to restating it in both places: the first rule now moves
only a topic's elaboration, unconditionally; the third names the exact
location — a `**Guidelines:**` block placed in `SKILL.md` after the routing
bullet list — where a load-bearing rule's bullets now belong, since that
block sits outside the routing section the original rule governed; the
fourth keeps its no-duplication force but names which side wins: a
load-bearing rule is stated once, in `SKILL.md`; a non-load-bearing rule is
stated once, in the reference. The rule that stays untouched is the one that
did not fail: parent routing bullets remain descriptive, free of RFC-2119
keywords, because a routing bullet was never the problem — a load-bearing
rule sitting nowhere `SKILL.md` states it was.

The test applies to itself. An author who never opens
`progressive-disclosure.md` would, by the test's own terms, split a skill
wrongly for want of it — so `agent-skill-authoring`'s own `SKILL.md` now
states the test as a normative rule in its `Progressive Disclosure` section,
not only behind that section's pointer. This self-application is the
smallest honest demonstration the change could carry.

**The pilot.** Rather than rewriting all 26 skills that carry a
`references/` directory, the test is piloted on exactly one section of one
skill: `react-component-styling`'s `Style Property Order` section. Both of
its rules — the fifteen-group order within a block, and the order of
composed styles — move from `references/style-property-order.md` into
`SKILL.md` in full, with their combined eleven RFC-2119 bullets. The
reference keeps the rationale for why order is a readability contract, why
the convention is semantic grouping rather than alphabetical, and both
worked examples (the `.card` CSS block, the `<Pressable>` style array) —
material that elaborates the rule rather than states it, and restates
neither order.

## What was rejected

**Rewriting all 26 skills with references now.** The convention argument
supports it, but the measurement behind it is n=3 on one skill, one
reference, and one scenario. A corpus-wide edit taken in a single step would
leave nothing to attribute a later reading to, and no way to tell whether
the fix generalizes from whether it was merely large.

**Keeping the split and making the pointer imperative** — "MUST read this
before writing CSS" in place of the descriptive routing bullet. This is the
cheaper edit and keeps `SKILL.md` small, but whether an imperative pointer
is followed is exactly as unmeasured as the descriptive one was: it would
trade a known failure for an unknown one, not close the gap #411 found.

**Stating a rule digest in `SKILL.md` and keeping the full rule in the
reference.** This needs the no-duplication rule relaxed on purpose, and a
digest that drifts from the reference it summarizes is a second failure mode
this convention did not previously have.

**Solving it in the host project's `AGENTS.md`.** Every skill in this
library is distributable and can assume nothing about the host project's own
instructions. `inkwell`, the mock project #411's probes ran against, is a
realistic host whose `AGENTS.md` says nothing about skills at all — that is
precisely the condition under which the finding appeared, and a fix that
depends on host cooperation would not survive it.

**Measuring more before changing anything.** A cheap replication would raise
n without touching the argument the convention text already supplies on its
own. The pilot was expected to produce a measurement of the fix instead,
which would have been a more useful thing to have than another measurement
of the defect. It did not — see below.

## Consequences

**The pilot was measured, and the measurement did not test it.** Run
31993004164 dispatched the same scenario from this change's own branch —
three repetitions per condition, six probes, all six completed, $6.9898. It
has no comparable predecessor and could not have one: `comparability.mjs`
requires matching skill digests, and editing the skill under test changes
its digest by construction. `follows-the-taught-property-group-order` came
out `false` in all six probes again.

That result says nothing about the relocated rule, because **no
`skill-present` probe invoked `react-component-styling` at all**. Two
reached for the peer `high-fidelity-ui-design`; the third invoked nothing.
The string `component-styling` appears zero times in all three treatment
transcripts. Moving a rule into `SKILL.md` can only matter once `SKILL.md`
is loaded, and here it never was — so the rule still did not reach the
model, for a reason upstream of the one this change addresses. An outcome
factor being unmeasurable when discovery does not fire is how the scenario
model works, not a defect in it.

Issue #411 had two of three treatment probes invoke the skill; this run had
none.
The `description` — the only text a host reads before deciding to load a
skill — is byte-identical across the two runs, so no mechanism connects this
change to the difference, and at three probes a side the swing is not
distinguishable from chance in either direction. The honest statement is
that the intervention remains **untested**, and that buying another sample
was declined rather than overlooked.

**What the evidence licenses, and what it does not.** The convention
argument — that the four composed rules make the observed behaviour the
designed behaviour — holds regardless of sample size, because it follows
from reading the rules together rather than from any probe's output. The
measurement behind it does not generalize past what it covers: **n is
three** — one skill, one reference, three `skill-present` probes, one
scenario, one model, one task shape. Whether reading the reference would
have changed the produced CSS is unmeasured, and stays unmeasured until a
rule reaches the model in the first place — this change makes that question
askable, not answered. Whether a pointer worded differently fares better is
untested; nothing here compared wordings. **Nothing in this record licenses
rewriting the other twenty-five skills that carry a `references/`
directory.** Each remains exactly as it was, and a future proposal to apply
this test more broadly has to make its own case from its own evidence, not
borrow this one's.

**What changes for future skill authors.** Deciding where a new rule belongs
in a split skill is no longer answered by "does it fit in `SKILL.md`'s
length budget" alone; it is answered by the load-bearing test first, length
second. A rule that would produce wrong output if missed belongs in
`SKILL.md` regardless of how long that makes the file — the size thresholds
in `progressive-disclosure.md` remain review signals prompting a split of
topics, never license to relocate a load-bearing rule out of the file an
agent actually reads by default.
