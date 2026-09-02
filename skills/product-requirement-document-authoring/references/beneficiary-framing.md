# Beneficiary Framing

Apply this reference to every section of a specification, not to one of them — Todo, Functional requirements, UI design, System design, Acceptance criteria, and the template's own placeholders all draw the same rule from here rather than restating it.

## Describe the Change the Beneficiary Observes

A specification describes the change its **beneficiary** observes, not the file, function, module, or line that produces it. The beneficiary is whoever the change is for: the end user for an application feature, the developer for a development-environment improvement. Naming the beneficiary for the change at hand is part of stating the rule, not a detail left implied — a spec that never says whose observation it is describing leaves every section free to drift toward whichever viewpoint is easiest to write from.

A document that names implementation details has to be revised whenever the implementation shifts, which makes the document subordinate to the work it is supposed to judge — a spec should outlive the first draft of its own implementation, and a reviewer should be able to check the finished change against it without the spec having moved out from under them. Writing from the beneficiary's observation instead of the mechanism keeps the document stable across exactly the kind of change that happens routinely: a component gets renamed, a function gets split, a file gets moved.

**Guidelines:**

- MUST describe every section of a specification as the change its beneficiary observes, naming who the beneficiary is for the change at hand.
- MUST NOT name a file name, a line number, or a function name in a specification.
- SHOULD state the reason inline when a reader is likely to reach for an implementation detail anyway: naming it ties the document to a mechanism that is expected to change, which is what the rule exists to prevent.

## The Acceptance-Criterion Exception

Not every path or identifier is an implementation detail smuggled into the spec. Where a rule must live in a particular file — a lint config, a CI workflow, a fixed public entry point — or an exported name is itself part of the contract a caller depends on, that path or identifier **is** the observable outcome, not a stand-in for it. Naming it is correct in that case, because omitting it would understate the requirement rather than raise its abstraction level.

**Guidelines:**

- MUST name a path or an identifier in a specification when it is itself an acceptance criterion — a rule that must live in a particular file, or an exported name that is part of the contract — rather than treating every path or identifier alike.
- MUST NOT invoke this exception for a path or identifier that is merely where the beneficiary-observable outcome happens to be implemented today.

## Raising Abstraction Without Losing Concreteness

An observable outcome is a **stronger** requirement than an implementation step, not a vaguer one: "the reader sees up to three related articles" is checkable against the running product in a way "add a `RelatedArticles` component" is not, since the latter is satisfied by any component under that name regardless of what it does. Writing at the beneficiary's altitude is a demand for more concrete, checkable outcomes, never license to soften a requirement into an adjective.

**Guidelines:**

- MUST treat beneficiary-observable phrasing as a floor for concreteness, not a ceiling — pair it with the checkable-language rule in [problem-and-scope.md › Concrete, Checkable Language](./problem-and-scope.md#concrete-checkable-language) rather than trading one for the other.
- MUST NOT use this rule to justify a vaguer requirement; a section that becomes less checkable after removing an implementation detail has removed the wrong thing.
