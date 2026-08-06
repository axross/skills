# Glossary

## Skills

**Skill** — a self-contained capability in the agentskills.io format: a `SKILL.md` whose frontmatter a host reads to decide whether to load it, together with whatever reference files and scripts sit beside it.

**Distributable skill** — a **skill** written to be installed into other projects, so it names no file, command, or layout belonging to the repository it was written in.

**Repository-local skill** — a **skill** that encodes conventions specific to one repository, committed directly under a **skill root** and edited in place rather than installed.

**Source root** — the directory holding a **distributable skill**'s editable source, and the only copy an author edits.

**Installed root** — a directory a host reads **skills** from, generated from a **source root**. One installed root holds the files and another reaches them through symlinks, so both serve the same bytes to whichever host looks there.

**Skill root** — either kind of root, used where a statement is true of any directory a host enumerates **skills** from.

## Skill Authoring

**Discovery** — a host choosing which **skills** to load for a task, from their frontmatter alone and before any body is read.

**Description** — the frontmatter field every host reads before loading a **skill**, and the only text **discovery** routes on.

**Portable Source Exception** — the allowance that lets a **distributable skill** restate a rule another skill owns, because it has to stand alone in a project that installed no neighbour to defer to.

**Obligation** — one rule stated with an RFC 2119 keyword. It is the unit the structure check and the load report both count.

**Obligation load** — how many **obligations** an agent holds at once across a set of **skills**, reported as a range: the floor when only the `SKILL.md` bodies are read, and the ceiling once every reference file is read too.

## Verification

**Gate** — a check that blocks a merge. It runs inside the suite the merge workflow invokes, so a change that fails it does not land.

**Reporting tool** — a check that produces a number, a ranking, or a routing outcome and never fails. It belongs to no **gate**, so running one is a deliberate act rather than a side effect of proposing a change.

**Scheduled audit** — a check that can fail, but which runs from a schedule against already-merged text rather than against a proposed change.

**Teeth** — the demonstrated capacity of a **gate** to fail, established by planting the violation it exists to catch and observing it reported. A **gate** that runs but cannot fail reads as coverage while providing none.

**Marked count** — a number written in prose and wrapped in a `count:` comment naming the derivation that proves it, so the suite fails when the sentence and the file it describes disagree. A number nobody wrapped carries no such tie.

## The Change Loop

**Change loop** — the process every change to this repository runs through, ending in a pull request that has passed an **independent review**.

**Plan-approval gate** — the stop in the **change loop** where a human reads the recorded plan, before any code is written against it.

**Independent review** — the review of a change performed by a separate session under a bot identity distinct from the operator, so a change's author never certifies it. It is the authoritative review of an agent's own work.

**Pre-flight review** — an optional advisory review by a second worker before the pull request opens. It buys a reader free of the implementer's reasoning state, and is never reported as the **independent review**.

**Address round** — one pass of fixing what the **independent review** and CI reported, followed by re-requesting that review.

**Agent-comment marker** — the fixed HTML comment opening every comment an agent authors, which is what distinguishes agent output from human input where the two share one login.

## Skill Evaluation

**Skill evaluation** — measuring a **skill**'s **outcome** rather than its **form**: whether it earns its place, not whether it is well made. The library is its own subject here, and no skill defines this, because the instrument is this repository's rather than something it distributes.

**Form** — whether a **skill** is shaped correctly: its frontmatter, its section anatomy, its link integrity, whether an installed copy still matches its source. Cheap to check mechanically.

**Outcome** — whether a **skill** does its job: whether **discovery** surfaces it for the right prompt, and whether holding it changes what the model does. It does not follow from **form**.

**Probe** — one run of one **case** against the real CLI, producing the set of **skills** that were selected.

**Case** — one labelled prompt in the evaluation fixture, naming the **skills** it should surface and the ones it should not, with a written rationale a human can disagree with without reading code.

**Tally** — the record of how many **probes** selected each **skill** for one **case**, which is what makes the result a distribution rather than a single verdict.

**Baseline** — a recorded set of **tallies** that a later run is compared against, so a result reads as a change rather than as a bare score.

**Corpus fingerprint** — a digest of each **skill**'s **description**, stored alongside a **baseline**, so a comparison can say whether the text **discovery** reads has moved since the **baseline** was recorded.

**Unmeasured declaration** — a **case** a **baseline** records as never measured, so a gap in coverage is stated rather than inferred from an absent number.
