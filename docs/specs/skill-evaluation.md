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

## The two axes

Skill outcome decomposes into two questions, measured by two separate
instruments. They are independent — a skill can pass either and fail the other
— and neither is informative about the other.

### Does discovery surface the skill?

A skill nobody loads cannot change anything, so selection is the first thing
worth knowing. It is also the half that is cheapest to be wrong about: an author
reads their own `description` knowing what it is for, which is the one condition
under which it always looks adequate.

The **skill discovery evaluation** answers this: it asks prompts of a real agent
**inside a mock project**, with the whole corpus competing, and records what the
agent selected. Situating it is what makes the answer worth having — a skill is
discovered while someone is working in a codebase, not in an empty room, and a
prompt asked in an empty room can only be answered from the prompt.
[`tools/discovery-eval/README.md`](../../tools/discovery-eval/README.md) owns the
instrument — its two probe modes, how a verdict is reached, and the limits of
what a run can conclude — and
[`data/discovery-eval/README.md`](../../data/discovery-eval/README.md) what a
measurement holds.

### Does holding the skill change what the agent does?

Selection is only half the bet. The other half is the one the practice exists
for and the one nothing here could state until there was an instrument for it:
whether an agent that holds the skill works differently from one that does not.

The **skill effect evaluation** answers this. It gives a real agent a real task
in a project modelled on a real consumer, runs the same task with the skill
installed and without it, and compares what the two runs produced — both the
files written and the record of what the agent did to write them.

**Cost is one term of the judgement, not the whole of it.** A skill occupies
context whether or not it changes anything, and that is paid on every turn that
loads it, so "does this skill earn its place" is a ratio: effect over cost. The
obligation report supplies the denominator, and what it counts and the policy
that follows are stated with the tool in `README.md`'s validator listing. Read
alone it answers a narrower question than this axis asks — a price with no
account of what was bought.

### An instrument stores what it measured, not what it concluded

This holds across both axes, and it is the reason a threshold can be argued
about after the fact rather than re-bought.

Neither instrument persists a verdict, and neither keeps a baseline. Each stores
what one probe produced — its verbatim transcript, and on the effect axis the
diff beside it — so changing the rule for what counts as a finding is a
re-derivation over data already paid for rather than another run.

**Raw enough is a stronger claim than it sounds, and the effect axis learned it
the expensive way.** Its first instrument stored the extracted signals and threw
the stream away, reasoning that a later question would be a threshold over the
signal already extracted. That is an assumption about what the next question
will be, and it failed the first time the question changed: reading six
recovered session logs answered three things the stored records could not —
which tools each run used, the per-message token usage, and the model each
message reported. Every question the extractor did not anticipate cost a paid
re-run.

**A baseline is the same mistake one level up**, and the discovery axis carried
one until it was rebuilt. A file recording "the current result" is a stored
conclusion about which measurement counts as current, it has to be re-recorded
by hand, and it overwrites the numbers it replaces. Measurements accumulate
instead: a new one is compared against the most recent earlier one it is
_comparable_ with — same prompt, same model, same project, same discovery text
for the skills that case tracks — and where none is, the report names the
condition that failed rather than suppressing the comparison. Nothing has to be
re-recorded, because measuring again is the only act there is.

So both axes separate their files by what can be re-acquired:

| Kind         | Rule                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------- |
| **measured** | Never regenerated. Re-acquiring it costs a paid probe.                                          |
| **declared** | What was set. Everything derivable from it — the CLI argv — is derived, not recorded beside it. |
| **derived**  | Regenerable from the two above. A drift check re-derives and fails on a mismatch.               |

The taxonomy earns its keep in both directions. A derived value stored as
measured is a value nothing can check; a measured value treated as derived is
one something will cheerfully regenerate as empty. And a derived layer that
merely _claims_ to be regenerable is worth nothing without the check that
re-derives it, which is why the drift check runs both in this repository's own
test suite and inside the measurement dispatch before anything is committed.

The distinction is between the record and the report, not between measuring and
judging: the discovery evaluation very much does judge, classifying a tally as a
miss or as spurious and naming a remedy. It computes that at report time from
stored counts, so the judgement can be revised and the counts cannot. An
instrument that stored the verdict instead would make every threshold change
cost another run.

### The effect axis cannot observe every skill

What the instrument can see is bounded by where it looks: one agent, given one
coding task, inside one **mock project**, with the editing tools and a shell. A
skill whose effect does not show up there cannot be measured by it — not
measured and found absent, but out of range, which is a different result and
must not be reported as the first.

Three groups fall outside it today, for three different reasons:

- **Skills whose surface is not the working tree.** Anything governing how an
  agent operates GitHub, drives a change loop, or conducts a review acts on
  issues, pull requests, and other sessions. None of that exists inside a mock
  project, and manufacturing it would measure the manufactured thing.
- **Skills whose effect is a judgement rather than an artifact.** Conduct,
  reporting, and how an uncertainty is resolved change what an agent _says_ and
  when it _stops_. A diff and a tool-call list do not carry that, and a
  **signal extractor** that claimed to read it would be judging.
- **Skills that need a stack the mock does not have.** A mock carries one
  toolchain. A skill about a framework, a runner, or a vendor SDK the fixture
  does not install has nothing to act on — this is the softest of the three,
  because it is answered by adding a mock rather than by a limit of the method.

This bound is worth stating because the instrument reports a number either way.
A measurement of a skill in the first two groups would show the two conditions
agreeing, which reads exactly like a skill that changed nothing — and the
correct reading is that the question was never put.

## Neither axis gates a merge

Both instruments report; neither blocks anything. That is not squeamishness
about enforcement, and it is not a gap waiting to be closed — it follows from
what is being measured.

A gate has to be able to say a change is wrong. A skill-outcome measurement says
that a result moved, and how surprised to be by the movement. Those are
different kinds of claim: the first admits a yes or no, the second is a piece of
evidence whose weight depends on how much was measured and against what. Handing
the second to a merge queue would force it into a shape it does not have.

A measurement that cannot gate is not a weaker measurement. It is one whose
output has a different reader — a person deciding what to change, rather than a
queue deciding what to block.

The concrete reasons each instrument cannot gate belong to the instrument, and
are stated with it:
[`tools/discovery-eval/README.md`](../../tools/discovery-eval/README.md)
for the skill discovery evaluation,
[`tools/effect-eval/README.md`](../../tools/effect-eval/README.md) for the skill
effect evaluation, and `README.md`'s validator listing for the obligation report
that supplies the cost term. `tests/repository/reporting-tools.test.mjs` is what
actually keeps both out of every gate, npm script, and hook.

## What the practice does not establish

Three limits belong to skill evaluation as a practice, rather than to either
instrument's implementation.

**The two axes do not age the same way.** Selection is a property of a model,
and models are replaced. Cost is a property of the text, and text changes only
when someone edits it. The two numbers therefore go stale on different clocks,
and a reader comparing results across time has to know which kind they are
holding. What that means for a recorded selection result is stated with the
instrument in
[`tools/discovery-eval/README.md`](../../tools/discovery-eval/README.md).

**Coverage is not the same as correctness.** A fixture measures the prompts
somebody thought to write down. A skill that is never surfaced by any labelled
prompt has been shown nothing; the absence of a finding is not evidence of a
working `description`.

**A measured difference is not a measured improvement.** The effect axis now
has a comparable measurement behind it, and a deterministic reading of what the
two conditions produced was enough to tell them apart. Telling them apart is
the whole of what such a reading gives: a deterministic signal answers whether
the output moved and never whether it moved for the better, which is why the
cost axis reports a number without claiming that number buys anything. The
records behind that measurement are committed under
[`data/effect-eval/`](../../data/effect-eval/README.md).
