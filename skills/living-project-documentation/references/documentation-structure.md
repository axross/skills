# Documentation Structure

## OKF v0.3 requirements

A concept is a UTF-8 Markdown file that starts with a YAML 1.2 core-schema
mapping between two lines containing exactly `---`. Give it a nonempty string
`type`; no other field is universally required. Duplicate keys are invalid.
Preserve extension keys at every level and edit only metadata affected by the
change. A producer may use project-specific types. See the
[OKF v0.3 specification](https://github.com/open-knowledge-format/open-knowledge-format/blob/527e81aff55992be21507e97004286789126f88c/SPEC.md).

`index.md` and `log.md` are reserved at every depth. The root index may declare
`okf_version: "0.3"`, a title and a description. Preserve these when refreshing
its entries. Nested indexes and all logs have no frontmatter. An optional log
records documentation changes in its scope under newest-first YYYY-MM-DD
headings. Approval evidence and dated observations retain their own provenance.
Untyped Markdown is skipped by OKF consumers. Other file extensions are assets.

## Engineering defaults

Give each living page one primary type, a meaningful title and a short
description that helps readers decide whether to open it. A bundle may keep its
topic directories and existing types when readers or tools depend on them.
For new engineering documentation, choose the type by the question the reader
needs to settle.

| Type              | Reader's decision                                                    | What belongs together                                                                                                                     |
| ----------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Definition        | Does this case count, and what does the value mean?                  | A metric's population, eligibility, units, formula and weighting.                                                                         |
| Specification     | Which observable outcome may a consumer rely on?                     | Inputs, results, timing, failure behavior and guarantees for each mode.                                                                   |
| Convention        | Which practice does the team use where several satisfy the contract? | The selected practice, its reason and the alternative it rules out. Lint enforcement leaves this a convention.                            |
| Architecture      | Who owns this responsibility, and how does work cross the boundary?  | Components, control or data flow and dependencies. Identify implemented boundaries, adopted targets and illustrative examples explicitly. |
| Procedure         | Who runs this task and how do they know it succeeded?                | Entry conditions, prerequisites, ordered actions, checks and recovery.                                                                    |
| Policy (optional) | Who may authorize this action or grant an exception?                 | Shared restrictions, exception authority and reopening conditions, when governed independently of any one procedure.                      |

A table of configuration names, consumers and missing-value behavior can be a
single Specification. A separately maintained service registry can keep its
project-specific type. Labels like Description, Catalog or Record tell a reader
too little to serve as default concept kinds.

## The index

Group links by reader task or subject. Give each entry enough information to
distinguish its destination from its neighbors. A root entry may route through a
nested index. Directory names are useful paths even when a new concept takes a
different type from its neighbors. Add a page only when it owns an answer.

## The glossary

Group terms where readers already look. Capture names from code, user-visible
interfaces and team usage. Define unfamiliar terms directly and keep the
project's spelling, grouping, aliases, emphasis and anchors when shortening an
entry. A glossary can link to a full Definition for a formula, provided the
entry still gives a usable meaning on its own. Add terms as readers need them.
The legacy flat `specs/<domain>.md` convention pairs files with glossary domain
headings. A typed Specification elsewhere creates no obligation to coin a term.

When choosing a new term, prefer the name whose ordinary words lead readers
to the intended meaning. A visibly unfamiliar term prompts a lookup. A
plausible near-match hides the need for one. Keep an existing team term during
capture and address a misleading name as a separate change to its callers.

For example, **Job output** names what one Job produced, even after its record
is gone. Three near-misses narrow or shift that meaning:

| Candidate      | Likely interpretation       | Where it misleads                                          |
| -------------- | --------------------------- | ---------------------------------------------------------- |
| Output record  | A record that holds output  | Omits which job produced it.                               |
| Failure output | The output of a failed job  | Excludes successful jobs.                                  |
| Completed job  | An execution that has ended | Names the execution itself instead of what it left behind. |

## Diagrams

Place the diagram beside the claim it explains. Show state transitions with the
observable contract and cross-component flows with the responsibility boundary.
Ship any linked image with the bundle so a reader can inspect both offline.
