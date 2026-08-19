# Skill Evaluation

## What it is

A skill is a bet with two halves. The first is that an agent reaches for it at
the right moment; the second is that holding it changes what the agent then
does. Skill evaluation is the practice of checking both halves against
observation instead of assuming them.

Neither half is visible in the file. A skill is a Markdown document, and reading
it tells you what it says, not whether anything acts on it. The bet is settled
somewhere else entirely — inside a model's choice about which capability a
prompt calls for, and inside the difference between the work it produces with
the skill and the work it produces without.

This library treats that as its own subject because it has no alternative. A
project that ships an application can watch the application behave. A library of
skills ships text whose entire purpose is to influence a system it does not
contain, so the only way to know whether the text works is to run the system and
look.

## Why checking textual properties does not reach it

Every mechanical check in this repository examines a **textual property**:
whether frontmatter parses, whether a section is where the structure says it
should be, whether a link resolves, whether an installed copy still matches its
source. Each one gates a merge, and not one of them can distinguish a skill that
works from a skill that does not.

The gap is not a matter of adding more checks. A **textual property** can be
read off the text; a **skill outcome** is a property of what a model does
when the text is present, and it can only be measured by running one. A skill
can be immaculately structured and never selected. It can be selected reliably
and change nothing about the answer. Neither failure leaves a mark a validator
could find, because in both cases the file is exactly what its author wrote.

This is the asymmetry the practice exists to address: the cheap checks answer a
question nobody was worried about, and the expensive question has no cheap
proxy.

## The evaluation scenario

The unit skill evaluation runs against is an **evaluation scenario**: a mock
project, the installed skills, the git history the project starts from, and
the non-skill harness — `AGENTS.md`, subagents — together with the task it is
asked to perform.

**A scenario's `description` is one of its declared parts rather than a
comment beside them.** It states what the scenario measures and why, so a
reader can disagree with the choice without reading its factors — the same
treatment a factor's own `description` already receives, one level up.

**Every scenario runs under two conditions, and the difference between them is
the measurement.** The **skill-present condition** installs `targetSkills`
plus `peerSkills`; the **skill-absent condition** installs `peerSkills` only,
leaving the rest of the scenario exactly as declared. Installing nothing at
all in the absent condition would make a measured difference attributable to
the whole library rather than to the skill under test, which is why the peer
set is installed in both — the two runs differ by exactly the skill being
measured, and nothing else a scenario declares.

**`peerSkills` is declared per scenario**, never defaulted to the rest of the
library, and that carries a standing obligation rather than a one-time choice:
a scenario's peer set is what makes its discovery phase hard or trivial, and a
skill added to the library sits in no scenario's choice set until someone
decides it belongs there.

**A scenario's `patch` is its own defect, never the mock's.** A mock ships
sound by design, and anything a scenario needs that the project would not
naturally have arrives instead as a unified diff the scenario declares —
applied after the mock is copied and before its recorded history replays over
it, so the workspace a model opens is clean and its history unremarkable.
`patch` is `null` for a scenario whose mock already has what it needs.
[`2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md`](../decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md)
is the decision this follows from, and
[Directory Structure](../conventions/directory-structure.md) states the
authoring convention — where the file lives, how it is regenerated, and what
it must not do.

## Three phases

A scenario declares whichever of three **evaluation phases** apply to what it
is testing.

- **`discovery`** asks whether the agent reached for the target skill
  unprompted, with `peerSkills` competing for the same prompt.
- **`outcome`** asks whether the artefacts the agent produced matched
  expectation — both what had to appear and what had to not.
- **`transcript`** asks whether the agent reasoned as expected.

A scenario whose skill leaves no trace an outcome or a transcript phase could
read — because its surface is not the working tree, or because holding it
changes only what the agent says along the way — declares discovery alone
rather than declaring a phase with nothing to check.

What a factor's judge is shown is decided by the phase its factor belongs to
— a factor carries no kind of its own; its phase is what bounds the material
— never by what else the probe recorded: a discovery factor sees the skill
invocations, an outcome factor sees the diff and the task, and a transcript
factor sees the transcript. An outcome judgment is deliberately never shown
the reasoning that produced the artefact it is judging, so a plausible
explanation cannot substitute for the artefact actually meeting expectation.

A discovery-phase task is written the way the problem's own owner would state
it, never in the tracked skill's own vocabulary — the situation this practice
means to measure is whether the skill's description reaches a reader with a
problem, not whether a prompt and a description share words.
[`2026-08-09-ask-discovery-prompts-as-problems-inside-a-real-project.md`](../decisions/2026-08-09-ask-discovery-prompts-as-problems-inside-a-real-project.md)
is the decision that constrains this, and it costs something real: a prompt
asking in the tracked skill's own words routes on vocabulary rather than on a
situation, and the more of that cost a scenario's author is willing to pay,
the harder — and the more informative — the discovery phase becomes.

## The factor

A **factor** is a declared, checkable expectation one scenario carries for one
of its phases, together with the `description` that states the expectation in
prose and the judgment method that checks it.

**A factor's `description` is one of its declared parts rather than a comment
beside them.** It states what the factor expects and why, so a reader can
disagree with the expectation without reading the judgment: a judgment says
how an expectation is checked, never whether it was the right one to hold. A
factor whose rationale exists only inside its script is one nobody can
dispute from outside the code, which is how a scenario set fills with
expectations no one ever chose.

**A judgment is made against the stored measurement and nothing else.** The
probe workspace is reconstructed from what the measurement holds, never
reused from the run that produced it, so a stored measurement is sufficient
to judge on its own rather than only at the moment it was taken.

`script` and `reasoning` are siblings — two ways of judging a factor, not two
storage tiers, and both results are part of the measurement. A **script
judgment** runs a deterministic script against that reconstructed workspace; a
**reasoning judgment** asks a **reasoning judge** — a model — to read the
material its factor's phase permits and report a verdict. Either way, the
judgment is the factor's own: nothing about a factor's declaration says in
advance which method will turn out to answer it better.

**Every factor result is `true`, `false`, or an error carrying its reason.**
A judgment that could not be made is not a judgment that came out false, and
the two stay distinguishable at every layer that stores one. Float results
are abolished: a factor that wanted a ratio — three of five files renamed,
two of three log lines quieted — is decomposed into one factor per element
instead, so the result names which element failed rather than only how many
did.

**Every judgment records evidence, and every reasoning judgment additionally
records the judge's model and the full prompt it was given.** A judgment with
no recorded basis cannot be checked later, by a reviewer reading the record or
by anyone re-deriving it; and a reasoning verdict whose judge is not recorded
on the result itself cannot be attributed at all. Neither is optional.

## The differential

A factor's **differential** is the difference of pass rates between its
scenario's two conditions, ranging from −1 to 1. A skill that makes a factor
worse is recorded at its true value rather than clamped to zero, because a
regression is exactly the kind of result this practice exists to surface.

**A factor with any errored judgment has no differential, and that is not the
same as a differential of zero.** A pass rate cannot be computed over a result
that was never reached, and reporting zero in its place would read as "no
effect" when the honest report is "not judged."

**A differential of exactly `0` does not, by itself, distinguish two very
different results**: every probe on both sides passing, or every probe on
both sides failing. Both report the same number for opposite reasons, and
the number alone cannot tell a reader which — that takes reading the probes
it was built from. A zero is read with that in mind, not as evidence that
nothing happened.

**A discovery factor's differential is bounded below by construction, and is
read as the skill-present pass rate.** The skill-absent condition installs
peer skills only, so a factor asking whether the agent reached for a target
skill cannot pass there — the skill is not present to be reached for. Both
conditions still run, because the scenario is one unit and the absent arm is
what the other phases measure against; but for this one phase the control arm
is settled by the setup rather than by what the agent did, so the difference
carries no more than the present arm already does. Where a differential
elsewhere in this document is informative because either arm could have gone
either way, this one is not, and reading it as though it were is the mistake
to avoid.

## Repetitions

**Three repetitions per condition is the default a dispatch may override, not
a fixed count.** A scenario does not carry it: a scenario declares what it
tests, and how many times to run it is an argument to the run. It fixes the
resolution of every differential it produces: a pass rate taken over three
repetitions can only be 0, 1/3, 2/3, or 1, so a differential built from it
can only be a multiple of 1/3. A factor that passes twice with the skill and
once without reports 0.333, and at this resolution that is not
distinguishable from chance — a single scenario's differential is read with
that in mind, not as a precise ratio.

## What makes two measurements comparable

A later measurement of a scenario is read as a change against its
**comparable predecessor** — the most recent earlier measurement of that
scenario whose conditions match — rather than against a stored baseline.
There is no baseline to compare against instead: a result is a change because
the previous measurement is still on disk, not because a separate document
says which one counts as current.
[`2026-08-09-compare-a-measurement-against-its-predecessor-not-a-baseline.md`](../decisions/2026-08-09-compare-a-measurement-against-its-predecessor-not-a-baseline.md)
is the decision that removed the baseline this replaced; nothing about the
model in this document reopens it.

**A reasoning judge's model, the full prompt it was given, and the route that
asked it are all part of what makes two measurements comparable**, exactly as
the runtime, the model that ran the probe, and the digest of every installed
skill already are. The route earns its place beside the other two because it
is not a transparent wrapper around the prompt: asking through the `claude`
CLI carries scaffolding of its own — the CLI's own preamble and defaults
sitting around whatever system and user prompt this instrument supplies — so
a verdict taken over the same prompt through a different route is not
guaranteed to have seen the same context the earlier one did. Re-judging a
stored measurement with a different reasoning judge, a different prompt, or a
different route is therefore a new measurement, never a silent update to the
old one — the two results sit side by side rather than one replacing the
other.

## Measured, declared, and derived

What one measurement holds is kept in three kinds, because they answer
different questions when something goes wrong.

| Kind         | Rule                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| **measured** | Never regenerated. Re-acquiring it costs a paid probe.                               |
| **declared** | What was set. Everything derivable from it is derived, not recorded beside it.       |
| **derived**  | Regenerable from the two above. A drift check re-derives it and fails on a mismatch. |

The taxonomy earns its keep in both directions. A derived value stored as
measured is a value nothing can check, because there is nothing to re-derive
it from and compare against. A measured value treated as derived is one
something will cheerfully regenerate as empty the moment it is asked for
before it was ever taken. Holding the line between the three is what keeps a
later question about a stored measurement answerable by reading rather than
by running the scenario again.

## What a measurement stores

Four shapes are fixed as part of this model rather than left to whichever
implementation writes them, because a stored measurement is read long
after the run that produced it, by whatever opens the file rather than by
the code that wrote it.

**`metadata.json` carries no `configuration` nesting.** `runtime` is a
top-level field, merging what were three separate concerns: the CLI that
ran the probe, the model it called, and the project state the probe
started from. All three answer the same question — what circumstances
produced this probe — rather than what the probe measured or what it was
declared to test, and they are exactly the facts this document already
reads together, alongside the digest of every installed skill, to decide
whether two measurements may be read against each other. `skills` sits
under `harness` rather than beside it, next to `agentsMd`, for the
matching reason: both are what accompanied the agent, not what ran it, so
they stay under the one key a scenario's own `harness` declaration already
names. Neither grouping nests a level further under a `configuration`
wrapper, because `runtime` and `harness` already name what they hold; a
wrapper around both would only rename the pair as a group, not describe
anything a reader does not already have from the two of them.

**`factors.json` names each factor's result field `result`, not
`outcome`.** `outcome` already names one of the three phases a factor can
belong to. Had the verdict kept that name too, an outcome-phase factor's
own record would carry `{"phase": "outcome", "outcome": true}` — the same
word naming both what is being asked and, right beside it, the answer.

**The measurement-level `summary.json` carries the aggregate and nothing
else** — no `comparable` field, no per-probe result or rate, and no
per-condition pass rate of its own. The rate is still computed, per
condition, exactly as before, and is exactly what a factor's differential
is built from — what stops here is the field, not the computation.
`summary.json` carries each factor's differential, the probe counts, and
the measurement's actual spend. `comparable` was the deleted instrument's
own field: a boolean, derived from a summary's per-probe checks, answering
whether every probe inside one measurement actually shared a single
condition. That question is settled by construction now — a probe's
condition is what materialization installs, not something to verify
afterward — so there is nothing left to compute it from. What survives,
under its own name, is the real remaining question: which earlier
measurement, if any, this one is read as a change against — recorded as
`comparablePredecessor`. A per-condition pass rate is left off the summary
for the same reason a per-probe result is: it costs nothing to recompute
from the probes on the rare read that wants one, and storing it as well
would put the same number in two places — which is how the two stop
agreeing.

**A model identifier is written vendor-prefixed and fully qualified**, in
the form `anthropic/claude-haiku-4-5-20251001`. The wire API a probe or a
reasoning judge is called through takes the bare name alone, but this
instrument records the fuller form regardless: the identifier is read back
long after the call that used it, by a later comparability check or by
someone reading a stored measurement on its own, and a bare name would
leave the vendor to be assumed rather than stated.

## The practice does not gate a merge

Skill evaluation reports; it blocks nothing. That is not squeamishness about
enforcement, and it is not a gap waiting to be closed — it follows from what
is being measured.

A gate has to be able to say a change is wrong. A skill-outcome measurement
says that a result moved, and how surprised to be by the movement. Those are
different kinds of claim: the first admits a yes or no, the second is a piece
of evidence whose weight depends on how much was measured and against what.
Handing the second to a merge queue would force it into a shape it does not
have.

A measurement that cannot gate is not a weaker measurement. It is one whose
output has a different reader — a person deciding what to change, rather than
a queue deciding what to block.

## What the practice does not establish

**A scenario set is coverage of what someone thought to write, not proof of
correctness for what nobody did.** A skill that no scenario ever exercises has
been shown nothing; the absence of a finding about it is not evidence that it
works.

**A passing factor is not a quality verdict, even when a reasoning judge
produced it.** A factor answers the specific, checkable expectation it was
written to declare — that a named file exists, that a document reads as
covering a required point — never a holistic judgment of whether the work was
good. A scenario whose every declared factor passes has confirmed exactly
what its author thought to check, and nothing wider than that.
