---
status: accepted
---

# Regroup the evaluation subsystem under `tools/evaluation/`

## Context

The two evaluations, the library they shared, the mock fixtures they measured
against, and the data they wrote were scattered across five unrelated
locations: `tools/discovery-eval/`, `tools/effect-eval/`, and `tools/lib/`
under `tools/`; `mocks/` at the repository root, holding no evaluation code of
its own; and `data/discovery-eval/` and `data/effect-eval/` under `data/`,
disconnected from the instruments that write them. Nothing in that layout
said the six pieces were one subsystem — a reader had to already know that
before the paths would make sense.

[#384](https://github.com/axross/skills/issues/384) plans to go further and
collapse the two instruments into one pipeline with two readings over a
merged fixture. That collapse touches what is measured, so it cannot be
proven inert. The regrouping recorded here is step one, kept deliberately
separate so its own inertness — every path moved, nothing measured changed —
is provable on its own before anything about the pipeline changes.

## The decision

**Move `tools/lib/`, `tools/discovery-eval/`, `tools/effect-eval/`, `mocks/`,
`data/discovery-eval/`, and `data/effect-eval/` under one directory,
`tools/evaluation/`, as `git mv` renames with no content edits, followed by a
path-reference-only update to every importer, test, workflow, and piece of
prose that named the old locations.**

The resulting tree is in
[`docs/conventions/directory-structure.md`](../conventions/directory-structure.md).

This supersedes `tools/evaluation/mocks/README.md`'s own stated rationale for
where the mocks lived: that file used to say they sat "at the repository
root … because they belong to neither" evaluation. They still belong to
neither — that half of the rationale is unchanged, and is why they are not
nested under `discovery/` or `effect/` — but "at the repository root" is no
longer true. They now sit under `tools/evaluation/`, alongside the two
instruments and the library both of them share, because a mock fixture that
neither evaluation owns individually is still part of the one subsystem that
owns both.

Two derived surfaces move with everything else: `.prettierignore`'s mock and
measurement exclusions, and `.markdownlint-cli2.jsonc`'s mock exclusion, are
re-pointed at their new locations rather than left matching a path that no
longer exists. The links gate — `tests/repository/gates.mjs`'s
`linksGateRoots()` — could no longer exclude the mocks by naming a top-level
directory, since they are three levels deep now; the gate itself was
rescoped to reach past the new depth rather than widening
`check-links.mjs` with an ignore mechanism of its own (see that file's own
docblock for how).

## What was rejected

**Moving only `tools/lib/`, `tools/discovery-eval/`, and `tools/effect-eval/`,
leaving `mocks/` and `data/` at the repository root.** Rejected: it would
have left the fixtures and the measurements they produced looking like
repository-root concerns again, which is the exact confusion one home is
meant to end. Nothing about the fixtures or the data became less shared by
moving the code that reads them.

**Doing this move in the same pull request as the pipeline merge #384 also
plans.** Rejected: a diff carrying hundreds of renames, a pipeline collapse,
and a fixture rewrite together is not reviewable, and it could not prove
either change inert on its own. Splitting them is what lets this step's own
acceptance criterion — the drift check re-deriving all 68 committed
measurement summaries byte-for-byte — mean anything.

**Collapsing `discovery/` and `effect/` into `src/` and `readings/` in this
same step**, which is `tools/evaluation/`'s eventual shape once the two
instruments share one pipeline. Rejected here: that collapse changes what is
measured — the installed corpus becomes case-declared, `bare` retires as a
measurement mode, the two fixtures merge — and mixing it with a pure rename
would make this step's inertness unprovable. `discovery/` and `effect/` stay
siblings for now; a later record will cover the collapse when it lands.

## What it costs

Every importer, every CI workflow step, every test that resolves a
repository-relative path, and every piece of prose naming the old locations
needed a matching edit — a wide diff for a change that alters nothing
measured. Two files inside the moved mock fixtures still name the old
`tools/lib` path in a comment (`tools/evaluation/mocks/inkwell/history.jsonc`
and `.../recall/history.jsonc`): left as committed rather than edited,
because the mocks are self-contained fixtures outside this repository's own
gates, and touching their content for a cosmetic comment fix would be a
content edit to something this step's own protected surfaces say to move
without reformatting.
