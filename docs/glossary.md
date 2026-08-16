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

**Skill corpus** — the body of skill text under one **skill root**, taken together: what an **obligation burden** report counts and a **scheduled audit** dereferences the URLs of.

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

## Skill Evaluation

**Skill evaluation** — measuring an **agent skill**'s **skill outcome** rather than its **textual properties**: whether it earns its place, not whether it is well made. The library is its own subject here, and no skill defines this, because the instrument is this repository's rather than something it distributes.

**Textual property** — a property of an **agent skill** readable off its text: whether its frontmatter parses, whether a section sits where the structure says, whether a link resolves, whether an **installed copy** still matches its source. Cheap to check mechanically.

**Skill outcome** — whether an **agent skill** does its job: whether **skill discovery** surfaces it for the right prompt, and whether holding it changes what the model does. It does not follow from any **textual property**.

**Evaluation scenario** — the unit **skill evaluation** runs against: a **mock project**, the installed skills, the git history the project starts from, and the non-skill harness, together with the task it is asked to perform.

**Target skills** — the skill or skills one **evaluation scenario** is testing, installed only in the **skill-present condition**.

**Peer skills** — the skills one **evaluation scenario** installs in both conditions, declared per scenario rather than defaulted to the rest of the library.

**Evaluation condition** — one setup an **evaluation scenario** is run under, differing from the others in exactly what the scenario is testing.

**Skill-present condition** — the **evaluation condition** that installs an **evaluation scenario**'s **target skills** plus its **peer skills**.

**Skill-absent condition** — the **evaluation condition** that installs an **evaluation scenario**'s **peer skills** only.

**Evaluation phase** — one of the three questions an **evaluation scenario** may declare, each judged by its own **factors**: `discovery`, whether the agent reached for the **target skills** unprompted; `outcome`, whether the produced artefacts matched expectation; `transcript`, whether the agent reasoned as expected.

**Factor** — a declared, checkable expectation an **evaluation scenario** carries for one of its **evaluation phases**, together with the `description` stating what it expects and why, and the judgment method — **script judgment** or **reasoning judgment** — that checks it.

**Factor result** — the outcome of one **factor**'s judgment for one **evaluation probe**: `true`, `false`, or an error carrying its reason.

**Script judgment** — a **factor**'s judgment method that runs a deterministic script against a **probe workspace**, reporting a **factor result** and its **evidence**. A sibling of **reasoning judgment**, not a separate storage tier.

**Reasoning judgment** — a **factor**'s judgment method that asks a **reasoning judge** to read the material its **factor**'s **evaluation phase** permits and report a **factor result** and its **evidence**. A sibling of **script judgment**, not a separate storage tier.

**Reasoning judge** — a model asked to render a **reasoning judgment**.

**Evidence** — the recorded basis for one **factor result**, required of a **script judgment** and a **reasoning judgment** alike, because a judgment with no recorded basis cannot be checked later.

**Differential** — the difference of pass rates between an **evaluation scenario**'s two conditions, for one **factor**.

**Evaluation probe** — one run of an **evaluation scenario** under one **evaluation condition**, against the real CLI.

**Turn cap** — the ceiling on how many turns one **evaluation probe** may take, set as a runaway guard rather than a budget control.

**Repetition** — one of several **evaluation probes** run under the same **evaluation scenario** and **evaluation condition**, with no fixed order among them.

**Scenario set** — the **evaluation scenarios** an instrument runs, together with what each is measured against.

**Mock project** — a small self-contained project modelled on a real consumer, kept as a fixture so an evaluation can give an agent real work to do.

**Probe workspace** — the isolated temporary directory a **mock project** is expanded into, a real Git repository where the agent works.

**Mock materialization** — expanding a **mock project** into a **probe workspace**: copying its files, applying the **scenario patch** where the **evaluation scenario** declares one, replaying its recorded commit history, and installing the skills its **evaluation condition** calls for.

**Scenario patch** — a unified diff one **evaluation scenario** declares, applied during **mock materialization** so the scenario starts from the broken state its own prompt describes. It belongs to the scenario rather than to the **mock project**, which ships sound: a defect built into the mock would be there for every other scenario too, and a project holding one of everything an evaluation measures reads as a fixture rather than as a project.

**Probe transcript** — the verbatim stream one **evaluation probe** produced, stored as the **agent runtime** emitted it rather than as an extraction over it, so a question a later reading asks is answered by re-reading rather than by re-running. What a `transcript` **factor** reads, and where a `discovery` **factor** reads the skill invocations in it.

**Probe artifact** — what one **evaluation probe** left in its **probe workspace**: the files the agent created or changed. What an `outcome` **factor** reads.

**Probe record** — everything one **evaluation probe** produced — its **probe transcript** and its **probe artifact** — together with the **condition fingerprint** it ran under, carrying no verdict.

**Scenario measurement** — every **evaluation probe** of one **evaluation scenario**, run together as one unit and stored together, because no single probe supports a comparison on its own.

**Condition fingerprint** — the digests of the **probe workspace** and of each installed skill, recorded with a **probe record** so two records are judged comparable by content rather than by the names of what produced them.

**Comparable predecessor** — the most recent earlier **scenario measurement** of one **evaluation scenario** whose conditions match a later one's, which is what that later one reads as a change against. There is no baseline to compare against instead: a result is a change because the previous measurement is still on disk.

**Superseded record** — a **probe record** taken under conditions a later change invalidated, so it is evidence of its own run and not comparable with later ones.

**Negative control** — an **evaluation scenario** deliberately drawn from a skill whose effect a **mock project**'s `outcome` and `transcript` phases cannot observe, so its **skill-absent condition** and **skill-present condition** are predicted to agree. It is the practice's only measurement of its own **noise floor**, and a result that diverges instead is a finding about the instrument rather than evidence the control was miscast.

**Noise floor** — how large a difference between two **evaluation probes** has to be before it can be attributed to an **agent skill** at all, as against ordinary run-to-run variance the **evaluation condition** itself did not cause. Measured by a **negative control**.

**Deliberate imperfection** — a flaw a **mock project** carries on purpose because it is part of the instrument, and which its own documentation declares.

**Fixture confounder** — something in a **mock project** that already demonstrates the convention an evaluation is trying to detect, so a **skill-absent condition** can reach it from context.

**Loaded skill set** — the skills an **agent runtime** reported loading for one **evaluation probe**.

**Library skill** — a loaded skill belonging to this library's **skill corpus**.

**Foreign skill** — a loaded skill the environment injected, which no available flag removes without also removing the workspace's own.

**Colliding skill** — a **foreign skill** sharing a name with a **library skill**.
