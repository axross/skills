# Glossary

## Skills

**Agent skill** — a self-contained capability in the **skill format**: a `SKILL.md` whose frontmatter an **agent runtime** reads to decide whether to load it, together with whatever **reference files** and scripts sit beside it.

**Skill format** — the agentskills.io format an **agent skill** conforms to: the frontmatter fields a `SKILL.md` declares, and the directory laid out beside it.

**Distributable skill** — an **agent skill** written to be installed into other projects, so it names no file, command, or layout belonging to the repository it was written in.

**Repository-local skill** — an **agent skill** that encodes conventions specific to one repository, committed directly under a **skill root** and edited in place rather than installed.

**Skill tier** — which storage model an **agent skill** uses: **distributable**, whose source is installed into generated roots, or **repository-local**, committed and edited where it sits.

**Source root** — the directory holding a **distributable skill**'s editable source, and the only copy an author edits.

**Installed root** — a directory an **agent runtime** reads **agent skills** from, generated from a **source root**, whether it holds the files itself or reaches them through symlinks.

**Skill root** — either a **source root** or an **installed root**, used where a statement is true of any directory an **agent runtime** enumerates **agent skills** from.

**Installed copy** — the generated copy of a **distributable skill** under an **installed root**, which an **agent runtime** reads and an author never edits.

**Installed-copy drift** — an **installed copy** no longer matching the **source root** copy it was generated from.

**Skills lockfile** — the record of which **distributable skills** are installed, and at which upstream version.

**Reference file** — a file beside a `SKILL.md` holding detail the body defers to, read only when a task needs it.

**Skill corpus** — the body of skill text under one **skill root**, taken together: what an **obligation burden** report counts and a **scheduled audit** dereferences the URLs of, and whose **skill descriptions** a **skill corpus fingerprint** digests.

## Agent Runtimes

**Agent runtime** — the agent that reads a **skill root** and decides which **agent skills** to load, and what this repository's own documents call "the host".

**Runtime skill catalog** — what an **agent runtime** lists for itself before loading anything: each available **agent skill**'s name and **skill description**, and no part of its body.

**Skill discovery** — an **agent runtime** choosing which **agent skills** to load for a task, from the **runtime skill catalog** alone and before any body is read.

**Skill description** — the frontmatter field every **agent runtime** reads before loading an **agent skill**, and the only text **skill discovery** routes on.

## Skill Authoring

**Portable Source Exception** — the allowance that lets a **distributable skill** restate a rule another skill owns, because it has to stand alone in a project that installed no neighbour to defer to.

**RFC 2119 obligation** — one rule stated with an RFC 2119 keyword, which is what makes it countable where an ordinary sentence of guidance is not.

**Obligation burden** — how many **RFC 2119 obligations** an agent holds at once across a set of **agent skills**, reported as a range: the floor when only the `SKILL.md` bodies are read, and the ceiling once every **reference file** is read too.

## Verification

**Merge gate** — a check that blocks a merge. It runs inside the suite the merge workflow invokes, so a change that fails it does not land.

**Enforced-gate set** — the **merge gates** taken together, as against any one of them.

**Reporting tool** — a check that produces a number, a ranking, or a routing outcome and never fails. It belongs to no **merge gate**, so running one is a deliberate act rather than a side effect of proposing a change.

**Scheduled audit** — a check that can fail, but which runs from a schedule against already-merged text rather than against a proposed change.

**Failure demonstration** — the evidence that a **merge gate** can fail, produced by planting the violation it exists to catch and observing it reported. A gate with none reads as coverage while providing none.

**Marked count** — a number written in prose and wrapped in a `count:` comment naming the derivation that proves it, so the suite fails when the sentence and the file it describes disagree. A number nobody wrapped carries no such tie.

## The Change Loop

**Change loop** — the process every change to this repository runs through, ending in a pull request that has passed an **independent review**.

**Plan-approval gate** — the stop in the **change loop** where a human reads the recorded plan, before any code is written against it.

**Independent review** — the review of a change performed by a separate session under a bot identity distinct from the operator, so a change's author never certifies it. It is the authoritative review of an agent's own work.

**Pre-flight review** — an optional advisory review by a second worker before the pull request opens. It buys a reader free of the implementer's reasoning state, and is never reported as the **independent review**.

**Posted review** — a review published on a pull request rather than delivered in-session, and narrower in its severity vocabulary than one delivered in-session is.

**Severity floor** — the lowest severity a given class of finding may be reported at, fixed so a reviewer cannot quietly downgrade it.

**Do-not-report list** — the findings a **posted review** leaves unsaid because an automated check already owns them.

**Address round** — one pass of fixing what the **independent review** and CI reported, followed by re-requesting that review.

**Agent-comment marker** — the fixed HTML comment opening every comment an agent authors, which is what distinguishes agent output from human input where the two share one login.

## Repository Documents

**Working agreement** — the root instruction document every session reads, which routes a task to the **agent skills** that govern it.

**Specification corpus** — the `docs/` tree itself, named apart from the **skill corpus** because both are called a corpus in different sentences.

## Skill Evaluation

**Skill evaluation** — measuring an **agent skill**'s **skill outcome** rather than its **textual properties**: whether it earns its place, not whether it is well made. The library is its own subject here, and no skill defines this, because the instrument is this repository's rather than something it distributes.

**Textual property** — a property of an **agent skill** readable off its text: whether its frontmatter parses, whether a section sits where the structure says, whether a link resolves, whether an **installed copy** still matches its source. Cheap to check mechanically.

**Skill outcome** — whether an **agent skill** does its job: whether **skill discovery** surfaces it for the right prompt, and whether holding it changes what the model does. It does not follow from any **textual property**.

**Evaluation probe** — one run of one **evaluation case** against the real CLI. A discovery probe produces the set of **agent skills** the run selected.

**Evaluation case** — one labelled unit of an evaluation fixture, carrying a written rationale a human can disagree with without reading code. A discovery case carries the prompt to send, and names the **agent skills** it should surface and the ones it should not.

**Discovery count** — how many **evaluation probes** surfaced each **agent skill** for one **evaluation case**, which is what makes the result a distribution rather than a single verdict.

**Discovery snapshot** — a recorded set of **discovery counts** that a later run is compared against, so a result reads as a change rather than as a bare score.

**Skill corpus fingerprint** — a digest of the **skill descriptions** across one **skill corpus**, stored alongside a **discovery snapshot**, so a comparison can say whether the text **skill discovery** reads has moved since that snapshot was recorded.

**Unmeasured declaration** — an **evaluation case** a **discovery snapshot** records as never measured, so a gap in coverage is stated rather than inferred from an absent number.
