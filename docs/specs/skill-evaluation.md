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

An installed skill is selected on its `description` and nothing else, so that
field is the unit under test. The instrument runs a fixture of labelled prompts
through the real CLI and records which skills each prompt selected. Because
selection is not deterministic, a prompt is repeated and the result read as a
distribution rather than a single verdict.

The assertion is set membership: was this skill selected or not. No model is
ever asked to grade another model's prose, which is what keeps the measurement
from inheriting the uncertainty it is supposed to be resolving.

[`evals/discovery/README.md`](../../evals/discovery/README.md) owns this
instrument — how a verdict is reached, what a finding is measured against, how a
result is compared to a recorded baseline, and the limits of what a run can
conclude.

### What does holding the skill cost?

A skill occupies context whether or not it changes anything, and the cost is
paid on every turn that loads it. The second instrument counts that cost as
concurrent RFC 2119 obligations across a set of skills, reported as a range: the
floor when only the `SKILL.md` bodies are read, and the ceiling once every
reference file is read too.

It is reported rather than judged. There is no threshold, because this corpus
has produced no evidence for where a defensible one would sit, and a threshold
nobody can defend becomes either a rule people route around or a warning people
stop reading.

## Neither axis gates a merge

Both instruments report. Neither belongs to an npm script, a merge workflow, or
a hook, and a test keeps them out of the enforced set so that wiring one in has
to be a deliberate act rather than an accident.

The reasons differ by instrument, and both are properties of the measurement
rather than of the tooling around it. The discovery evaluation is
non-deterministic, costs money on every run, and depends on a secret that fork
pull requests never receive — and a merge gate that fails for reasons unrelated
to the change gets bypassed or deleted rather than fixed. The obligation report
has no threshold to gate on in the first place.

A measurement that cannot gate is not a weaker measurement. It is a measurement
whose output is addressed to a human deciding what to change, rather than to a
merge queue deciding what to block.

## What the practice does not establish

Three limits belong to skill evaluation as a practice, rather than to either
instrument's implementation.

**A measured result is not durable.** Both axes measure the behaviour of a model
that is replaced periodically. A result describes a moment, and a new model
moves it with no change to this repository at all.

**Coverage is not the same as correctness.** A fixture measures the prompts
somebody thought to write down. A skill that is never surfaced by any labelled
prompt has been shown nothing; the absence of a finding is not evidence of a
working `description`.

**The second half of the bet is measured least.** The discovery axis answers
whether a skill is selected. Whether holding it changes what the model produces
is the harder question and the one this repository has the least evidence about,
which is why the cost axis reports a number without claiming that number buys
anything.
