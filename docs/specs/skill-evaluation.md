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

## Why form checking does not reach it

Every mechanical check in this repository examines **form**: whether frontmatter
parses, whether a section is where the structure says it should be, whether a
link resolves, whether an installed copy still matches its source. Each one
gates a merge, and not one of them can distinguish a skill that works from a
skill that does not.

The gap is not a matter of adding more checks. Form is a property of the text,
and it can be read off the text; **outcome** is a property of what a model does
when the text is present, and it can only be measured by running one. A skill
can be immaculately structured and never selected. It can be selected reliably
and change nothing about the answer. Neither failure leaves a mark a validator
could find, because in both cases the file is exactly what its author wrote.

This is the asymmetry the practice exists to address: the cheap checks answer a
question nobody was worried about, and the expensive question has no cheap
proxy.

## The two axes

Outcome decomposes into two questions, measured by two separate instruments.
They are independent — a skill can pass either and fail the other — and neither
is informative about the other.

### Does discovery surface the skill?

A skill nobody loads cannot change anything, so selection is the first thing
worth knowing. It is also the half that is cheapest to be wrong about: an author
reads their own `description` knowing what it is for, which is the one condition
under which it always looks adequate.

The instrument that answers this runs prompts through a real agent and records
what it selected.
[`evals/discovery/README.md`](../../evals/discovery/README.md) owns it — what it
runs, how a verdict is reached, what a finding is measured against, and the
limits of what a run can conclude.

### What does holding the skill cost?

Selection is only half the bet, and the other half has a price attached. A skill
occupies context whether or not it changes anything, and that cost is paid on
every turn that loads it — which means "does this skill earn its place" is a
ratio, and an instrument that measures only whether a skill is picked supplies
one term of it.

The second instrument supplies the other. What it counts, and the policy that
follows from the count, are stated with the tool in `README.md`'s validator
listing.

## Neither axis gates a merge

Both instruments report; neither blocks anything. That is not squeamishness
about enforcement, and it is not a gap waiting to be closed — it follows from
what is being measured.

A gate has to be able to say a change is wrong. An outcome measurement says that
a result moved, and how surprised to be by the movement. Those are different
kinds of claim: the first admits a yes or no, the second is a piece of evidence
whose weight depends on how much was measured and against what. Handing the
second to a merge queue would force it into a shape it does not have.

A measurement that cannot gate is not a weaker measurement. It is one whose
output has a different reader — a person deciding what to change, rather than a
queue deciding what to block.

The concrete reasons each instrument cannot gate belong to the instrument, and
are stated with it: [`evals/discovery/README.md`](../../evals/discovery/README.md)
for the discovery evaluation, and `README.md`'s validator listing for the
obligation report.

## What the practice does not establish

Three limits belong to skill evaluation as a practice, rather than to either
instrument's implementation.

**The two axes do not age the same way.** Selection is a property of a model,
and models are replaced. Cost is a property of the text, and text changes only
when someone edits it. The two numbers therefore go stale on different clocks,
and a reader comparing results across time has to know which kind they are
holding. What that means for a recorded selection result is stated with the
instrument in
[`evals/discovery/README.md`](../../evals/discovery/README.md).

**Coverage is not the same as correctness.** A fixture measures the prompts
somebody thought to write down. A skill that is never surfaced by any labelled
prompt has been shown nothing; the absence of a finding is not evidence of a
working `description`.

**The second half of the bet is measured least.** The discovery axis answers
whether a skill is selected. Whether holding it changes what the model produces
is the harder question and the one this repository has the least evidence about,
which is why the cost axis reports a number without claiming that number buys
anything.
