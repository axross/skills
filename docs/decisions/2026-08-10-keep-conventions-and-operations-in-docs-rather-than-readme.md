---
status: accepted
---

# Keep conventions and operations in `docs/`, rather than in `README.md`

`README.md` had grown to carry two different kinds of material in one long
document: the positioning and getting-started a newcomer reads first, and this
repository's own contributor conventions and operational procedures —
validator placement, the enforced-gate set, hook wiring, telemetry tagging,
the change loop, the `@claude review` setup. The second kind was organized as
a run of bold lead-in paragraphs late in the file, each stating a rule and its
reasoning together but with no format discipline holding one apart from the
next, so a reader after one fact read past everything else to find it. This
repository had also just adopted `living-project-documentation`'s `docs/`
tree, which defines `conventions/` and `operations/` as bodies for exactly
this material, with a document format that states a rule once next to its
reasoning and lets its own heading serve as the citable anchor.

Moved this repository's contributor conventions and operational procedures out
of `README.md` into `docs/conventions/` and `docs/operations/`, in the shape
and document format `living-project-documentation` already states, and left
`README.md` holding what a reader of the library needs on first contact:
positioning, getting started, the skill catalog, local setup, and the commands
table. `AGENTS.md` gained a routing table naming, for each kind of change, the
specific document to read.

Leaving the material in `README.md` was rejected. A run of bold-lead-in
paragraphs is not a document format — nothing held a rule's strength readable
from its own sentence, nothing stopped one paragraph from drifting into
restating what an earlier one already said, and a rule sat wherever a
previous edit happened to leave it rather than under a heading a reviewer
could cite. A second, informally-organized document such as a
`CONTRIBUTING.md` was also rejected: this repository already has one `docs/`
tree with an index, a glossary, and a decision log, and a second tree would
buy nothing but a second decision, at every future write, about which tree a
paragraph belongs to. Keeping both a `README.md` version and a `docs/` version
side by side, cross-linked, was rejected too — two homes for one fact drift
the moment either is edited without the other, which is exactly the
duplication this repository's own review policy already rates Major.

A document under `conventions/` or `operations/` does not fire on its own the
way a skill does — nothing loads it because a task matches a trigger phrase.
It is reachable only as far as `AGENTS.md`'s own routing table makes it, so a
kind of change the table does not yet name has no document pointing a session
at it until someone adds a row. The upside is that the same five validators
this repository already runs over its specs and decisions now also run over
its conventions and operations, so a stale cross-reference or a document
missing from the index is caught there exactly as it would be for a spec.
