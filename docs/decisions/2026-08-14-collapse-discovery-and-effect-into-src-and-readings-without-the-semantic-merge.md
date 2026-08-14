---
status: accepted
---

# Collapse `discovery/` and `effect/` into `src/` and `readings/` without the semantic merge

## Context

`2026-08-13-regroup-the-evaluation-subsystem-under-tools-evaluation.md` moved
`tools/discovery-eval/`, `tools/effect-eval/`, `tools/lib/`, `mocks/`, and the
two `data/` directories under one `tools/evaluation/`, but kept `discovery/`
and `effect/` as siblings under it rather than collapsing them into the
`src/`/`readings/` shape the two instruments were already heading toward. Its
"What was rejected" section gave one reason for not going further in that same
step: that the collapse "changes what is measured — the installed corpus
becomes case-declared, `bare` retires as a measurement mode, the two fixtures
merge — and mixing it with a pure rename would make this step's inertness
unprovable." That sentence treated the structural collapse into `src/` and
`readings/` as inseparable from the semantic merge of the two instruments'
pipelines that [#384](https://github.com/axross/skills/issues/384) plans next.

[#390](https://github.com/axross/skills/issues/390) tested that assumption by
attempting the structural collapse on its own, split off as step 2a of #384's
step 2.

## The decision

**Move `tools/evaluation/discovery/` and `tools/evaluation/effect/` into
`tools/evaluation/src/` — the definitions both readings use, unified into one
copy each — and `tools/evaluation/readings/discovery/` and
`tools/evaluation/readings/effect/` — the definitions each reading still needs
its own version of, plus the modules unique to one side — with no change to
what any probe records.**

Which definitions moved to `src/` and which stayed two definitions under
`readings/` was decided by measurement, not by judgment about what a merged
pipeline ought to share. The two evaluations exported 26 names in common;
comparing each pair with comments and whitespace normalized away found 16
that were the same code twice and 10 that genuinely differed. The 16 got one
definition under `src/`; the 10 kept their two definitions, one under each
reading's own tree. No name was moved on a call about what the readings
should eventually share — that question belongs to #384's step 2b, and
stayed untouched here.

The earlier record's assumption was wider than it needed to be. The
structural collapse turned out to be separable from the semantic merge: this
change relocated all 26 names and repointed every importer, test, and
workflow step that named the old paths, and both drift checks — `node
tools/evaluation/readings/discovery/summarize.mjs --check` and `node
tools/evaluation/readings/effect/summarize.mjs --check` — re-derived every
committed measurement summary byte-for-byte unchanged. The installed corpus
is not yet case-declared, `bare` is still a live measurement mode, and the
two fixtures are still two files. Those three changes are what actually
alters what is measured, and they remain #384's step 2b's work, still ahead
of this one.

## What was rejected

**Unifying all 26 shared names now, including the 10 that differ.** Rejected:
each of the 10 differs for its own reason rather than by drift — one example
among them takes an extra parameter on one side that the other side has no
use for, and another pair's two bodies differ by roughly a hundred lines — so
unifying any of them means deciding what a merged pipeline does, which is
step 2b's decision, and mixing that in here would put a semantic change in a
diff meant to prove nothing measured changed.

**Moving the files without extracting the 16 shared definitions.** Rejected:
it would pay the cost of touching every import while leaving the exact
duplication this step exists to remove, and a later pass would have to touch
the same files a second time.

## What it costs

Every file under the old `discovery/` and `effect/` trees, and every
importer, test, and workflow step naming them, needed a matching edit — for a
change that, measured by both drift checks, alters nothing about what either
instrument records.
