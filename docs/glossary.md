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

**Pre-flight review** — an advisory review by a second worker before the pull request opens, run whenever implementation was delegated and a compatible reader resolves. It buys a reader free of the implementer's reasoning state, and is never reported as the **independent review**.

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

**Skill discovery evaluation** — the instrument measuring whether an **agent runtime** surfaces a given **agent skill** for a prompt, from its **skill description** alone.

**Skill effect evaluation** — the instrument measuring whether holding an **agent skill** changes what an agent does and what it produces.

**Evaluation fixture** — the set of **evaluation cases** an instrument runs, together with what each case is measured against.

**Evaluation case** — one labelled unit of an **evaluation fixture**, carrying a written rationale a human can disagree with without reading code. A discovery case carries the prompt to send, and names the **agent skills** it should surface and the ones it should not; an effect case carries the task to perform and the **evaluation conditions** to perform it under.

**Evaluation probe** — one run of one **evaluation case** against the real CLI. A discovery probe produces the set of **agent skills** the run selected; an effect probe produces a **probe artifact** and a **probe transcript**.

**Mock project** — a small self-contained project modelled on a real consumer, kept as a fixture so an evaluation can give an agent real work to do.

**Probe workspace** — the isolated temporary directory a **mock project** is expanded into, a real Git repository where the agent works.

**Mock materialization** — expanding a **mock project** into a **probe workspace**: copying its files, applying the **case patch** where the **evaluation case** declares one, replaying its recorded commit history, and installing the skills that run holds.

**Case patch** — a unified diff one **evaluation case** declares, applied during **mock materialization** so the case starts from the broken state its own prompt describes. It belongs to the case rather than to the **mock project**, which ships sound: a defect built into the mock would be there for every other case too, and a project holding one of everything an evaluation measures reads as a fixture rather than as a project.

## Skill Discovery Evaluation

**Discovery count** — how many **evaluation probes** surfaced each **agent skill** for one **evaluation case**, which is what makes the result a distribution rather than a single verdict.

**Situated probe** — an **evaluation probe** that reads a **probe workspace** before it selects, which is the situation an **agent skill** is discovered in: real instructions, a real codebase, and every other skill competing.

**Bare probe** — an **evaluation probe** whose workspace holds the installed skills and no project, so the prompt is the only thing it can route on. What a **head overlay** requires, and where an **evaluation case** whose subject situating would remove still runs.

**Head overlay** — the **skill descriptions** of a pull request's own head, staged as data for a **bare probe**, so a changed one can be measured before it merges. Never combined with a **situated probe**, which holds capabilities text from outside the repository must not reach.

**Skill corpus fingerprint** — a digest of the **skill descriptions** across one **skill corpus**, recorded with a **probe record**, so a later comparison can say whether the text **skill discovery** reads has moved since that probe ran.

**Comparable predecessor** — the most recent earlier **case measurement** of one **evaluation case** whose conditions match a later one's, which is what that later one reads as a change against. There is no baseline to compare against instead: a result is a change because the previous measurement is still on disk.

**Measured population** — which of two groups an **evaluation case** is reported within, so a result about a **mandated skill** and a result about a **discovered skill** never reach one number. The two answer different questions: for a **discovered skill** the **skill description** is the whole of what surfaces it, and for a **mandated skill** it is barely involved, since the consumer's own instructions name that skill outright.

## Skill Effect Evaluation

**Evaluation condition** — one setup an **evaluation case** is run under, differing from the others in exactly what the case is testing.

**Skill-absent condition** — the **evaluation condition** run without the skill under test installed.

**Skill-present condition** — the **evaluation condition** run with the skill under test installed.

**Probe artifact** — what one **evaluation probe** left in its **probe workspace**: the files the agent created or changed.

**Probe transcript** — the verbatim stream one **evaluation probe** produced, stored as the **agent runtime** emitted it rather than as an extraction over it, so a question a later reading asks is answered by re-reading rather than by re-running.

**Signal extractor** — a deterministic function that reads a **probe transcript** or a **probe artifact** and reports measured signals without judging them.

**Probe record** — everything one **evaluation probe** produced — its **probe transcript** and its **probe artifact** — together with the **condition fingerprint** it ran under, carrying no verdict.

**Case measurement** — every **evaluation probe** of one **evaluation case**, run together as one unit and stored together, because no single probe supports a comparison on its own.

**Condition fingerprint** — the digests of the **probe workspace** and of each installed skill, recorded with a **probe record** so two records are judged comparable by content rather than by the names of what produced them.

**Comparability check** — a check that every **evaluation probe** of one **case measurement** ran under the same conditions, so a difference between them can be attributed to the skill at all.

**Negative control** — an **evaluation case** drawn from a skill the effect axis cannot observe at all, so its **skill-absent condition** and **skill-present condition** are predicted to agree. It is the axis's only measurement of its own **noise floor**, and a result that diverges instead is a finding about the instrument rather than evidence the control was miscast.

**Noise floor** — how large a difference between two **evaluation probes** has to be before it can be attributed to an **agent skill** at all, as against ordinary run-to-run variance the **evaluation condition** itself did not cause. Measured, on the effect axis, by a **negative control**.

**Superseded record** — a **probe record** taken under conditions a later change invalidated, so it is evidence of its own run and not comparable with later ones.

**LLM judge** — a model asked to rank or score what a **signal extractor** cannot reach.

**Stop-loss guard** — the check standing between a **case measurement**'s projected cost and the start of it, so a declared cap binds by refusal before the spend rather than by exhaustion during it.

**Turn cap** — the ceiling on how many turns one **evaluation probe** may take, set as a runaway guard rather than a budget control.

**Deliberate imperfection** — a flaw a **mock project** carries on purpose because it is part of the instrument, and which its own documentation declares.

**Fixture confounder** — something in a **mock project** that already demonstrates the convention an evaluation is trying to detect, so a **skill-absent condition** can reach it from context.

**Loaded skill set** — the skills an **agent runtime** reported loading for one **evaluation probe**.

**Library skill** — a loaded skill belonging to this library's **skill corpus**.

**Foreign skill** — a loaded skill the environment injected, which no available flag removes without also removing the workspace's own.

**Colliding skill** — a **foreign skill** sharing a name with a **library skill**.

**Mandated skill** — an **agent skill** a project's own instructions name and require, so **skill discovery** never has to surface it.

**Discovered skill** — an **agent skill** no instruction names, left to **skill discovery** to surface.
