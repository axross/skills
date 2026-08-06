# Glossary

A term whose meaning is not exactly its bare word's ordinary meaning is defined
here as a **compound**, never as the bare word. A word that already means the
right thing stays as it is; one that means something wider, narrower, or merely
adjacent takes a qualifier closing the gap. The rule follows from how a glossary
is actually read — not front to back, but by a reader meeting a term in a
sentence and deciding whether they already know it. A bare `Case` never triggers
that decision, because everybody already knows what a case is. **Evaluation
case** does.

## Skills

**Agent skill** — a self-contained capability in the agentskills.io format: a
`SKILL.md` whose frontmatter a **skill host** reads to decide whether to load it,
together with whatever **reference files** and scripts sit beside it.

**Skill host** — the agent runtime that reads a **skill root** and decides which
**agent skills** to load, such as Claude Code or Codex.

**Skill corpus** — the **agent skills** under one **skill root**, taken together:
the thing a fingerprint digests and a load report counts. Distinct from the
**specification corpus**, which is what the same word names elsewhere in this
repository.

**Skill tier** — which storage model an **agent skill** uses: the
**distributable skill**'s, whose source is installed into generated roots, or
the **repository-local skill**'s, committed and edited in place.

**Distributable skill** — an **agent skill** written to be installed into other
projects, so it names no file, command, or layout belonging to the repository it
was written in.

**Repository-local skill** — an **agent skill** that encodes conventions specific
to one repository, committed directly under a **skill root** and edited in place
rather than installed.

**Source root** — the directory holding a **distributable skill**'s editable
source, and the only copy an author edits.

**Installed root** — a directory a **skill host** reads **agent skills** from,
generated from a **source root**. One installed root holds the files and another
reaches them through symlinks, so both serve the same bytes to whichever host
looks there.

**Skill root** — either kind of root, used where a statement is true of any
directory a **skill host** enumerates **agent skills** from.

**Installed copy** — the generated copy of a **distributable skill** under an
**installed root**, which a **skill host** reads and an author never edits.

**Installed-copy drift** — an **installed copy** that no longer matches the
**source root** it was generated from.

**Skills lockfile** — the record of which **distributable skills** are installed,
and at which upstream version.

## Skill Authoring

**Skill discovery** — a **skill host** choosing which **agent skills** to load for
a task, from their frontmatter alone and before any body is read.

**Skill catalog** — what a **skill host** lists for itself before loading
anything: each available **agent skill**'s name and **skill description**, and
nothing else.

**Skill description** — the frontmatter field every **skill host** reads before
loading an **agent skill**, and the only text **skill discovery** routes on.

**Reference file** — a file beside a `SKILL.md` holding detail the body defers to,
read only when a task needs it.

**Portable Source Exception** — the allowance that lets a **distributable skill**
restate a rule another skill owns, because it has to stand alone in a project
that installed no neighbour to defer to.

**RFC 2119 obligation** — one rule stated with an RFC 2119 keyword. It is the unit
the structure check and the load report both count.

**Obligation load** — how many **RFC 2119 obligations** an agent holds at once
across a set of **agent skills**, reported as a range: the floor when only the
`SKILL.md` bodies are read, and the ceiling once every **reference file** is read
too.

## Documentation

**Working agreement** — the root instruction document every session reads, which
routes a task to the **agent skills** that govern it.

**Specification corpus** — the `docs/` tree: the vocabulary this repository uses
across its root documents, the behaviour of machinery no **agent skill** owns, and
the reasoning behind the constraints it works under. Named apart from the **skill
corpus** because both are called a corpus in different sentences.

## Verification

**Merge gate** — a check that blocks a merge. It runs inside the suite the merge
workflow invokes, so a change that fails it does not land.

**Enforced-gate set** — which checks are **merge gates**, taken as one list.
Several documents and configuration files each state that list separately, so it
is the agreement between them that the term names.

**Reporting tool** — a check that produces a number, a ranking, or a routing
outcome and never fails. It belongs to no **merge gate**, so running one is a
deliberate act rather than a side effect of proposing a change.

**Scheduled audit** — a check that can fail, but which runs from a schedule
against already-merged text rather than against a proposed change.

**Gate teeth** — the demonstrated capacity of a **merge gate** to fail,
established by planting the violation it exists to catch and observing it
reported. A gate that runs but cannot fail reads as coverage while providing
none.

**Marked count** — a number written in prose and wrapped in a `count:` comment
naming the derivation that proves it, so the suite fails when the sentence and
the file it describes disagree. A number nobody wrapped carries no such tie.

## The Change Loop

**Change loop** — the process every change to this repository runs through,
ending in a pull request that has passed an **independent review**.

**Plan-approval gate** — the stop in the **change loop** where a human reads the
recorded plan, before any code is written against it.

**Independent review** — the review of a change performed by a separate session
under a bot identity distinct from the operator, so a change's author never
certifies it. It is the authoritative review of an agent's own work.

**Pre-flight review** — an optional advisory review by a second worker before the
pull request opens. It buys a reader free of the implementer's reasoning state,
and is never reported as the **independent review**.

**Posted review** — a review published on a pull request rather than delivered
in-session, whose severity vocabulary collapses to two levels.

**Severity floor** — the lowest severity a given class of finding may be reported
at, fixed so a reviewer cannot quietly downgrade it.

**Do-not-report list** — the findings a reviewer must not raise, because an
automated check already owns them.

**Address round** — one pass of fixing what the **independent review** and CI
reported, followed by re-requesting that review.

**Agent-comment marker** — the fixed HTML comment opening every comment an agent
authors, which is what distinguishes agent output from human input where the two
share one login.

## Skill Evaluation

**Skill evaluation** — measuring an **agent skill**'s **skill outcome** rather
than its **skill form**: whether it earns its place, not whether it is well made.
The library is its own subject here, and no skill defines this, because the
instrument is this repository's rather than something it distributes.

**Skill form** — whether an **agent skill** is shaped correctly: its frontmatter,
its section anatomy, its link integrity, whether an **installed copy** still
matches its source. Cheap to check mechanically.

**Skill outcome** — whether an **agent skill** does its job: whether **skill
discovery** surfaces it for the right prompt, and whether holding it changes what
the model does. It does not follow from **skill form**.

**Evaluation case** — one labelled unit of an evaluation's fixture, carrying a
written rationale a human can disagree with without reading code. What else a
case carries is the business of the instrument that runs it.

**Evaluation probe** — one run of one **evaluation case** against the real CLI.
What a probe produces differs by instrument and is stated with each.

**Selection tally** — the record of how many **evaluation probes** selected each
**agent skill** for one **evaluation case**, which is what makes the result a
distribution rather than a single verdict.

**Selection snapshot** — a recorded set of **selection tallies** that a later run
is compared against, so a result reads as a change rather than as a bare score.

**Corpus fingerprint** — a digest of each **agent skill**'s **skill description**,
stored alongside a **selection snapshot**, so a comparison can say whether the
text **skill discovery** reads has moved since that snapshot was recorded.

**Unmeasured declaration** — an **evaluation case** a **selection snapshot**
records as never measured, so a gap in coverage is stated rather than inferred
from an absent number.
