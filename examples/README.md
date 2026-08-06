# Mock projects

Fixtures for the skill-value evaluation tracked in
[#235](https://github.com/axross/skills/issues/235). Each subdirectory is a
small, self-contained project that
[`scripts/value-eval/materialize.mjs`](../scripts/value-eval/materialize.mjs)
expands into an isolated temporary directory as a real Git repository, with a
chosen set of skills installed, so a probe can give a model a task inside one.

They carry their own formatter, linter, and test runner. That is not tidiness:
a skill whose effect is running the project's checks cannot be measured at all
where those commands do not exist. It is also what keeps a mock honest, since
this repository's own format, lint, and link gates deliberately exclude
`examples/`.

## Why this file is here and not inside a mock

Everything under a mock's own directory is copied into the workspace the model
works in, so a model reads it. A note explaining that the project is an
experiment would tell it so — and a model that knows it is being measured is
not measuring what we wanted. This file sits one level up, where
`materialize.mjs` never copies from.

## Deliberate imperfections, declared

A mock is a measurement instrument, and some of its flaws are the instrument.
They are listed here so a reviewer can tell a designed flaw from a bug —
**anything not on this list is a bug**, and the question has already cost one
review round.

### `content-site`

- **The commit history is inconsistent in style.** `history.jsonc` mixes
  `WIP`, `fix layout bug`, `docs`, and one clean Conventional Commit. The
  reference this mock is modelled on has a uniformly clean history, and a mock
  imitating that would let a control run copy the convention out of context —
  erasing the effect of any skill that teaches it.
- **`shared/blog-post-slug.spec.ts` is a mixed-quality suite**: three cases
  named after the implementation, one asserting a constant's value rather than
  the behaviour it produces, thinner edge coverage than the module deserves,
  and one behaviour-named case left intact. An exemplary suite would hand a
  control run the conventions the evaluation is trying to detect. A uniformly
  poor one would be just as wrong in the other direction, flattering a
  treatment run by giving it something obvious to correct.
- **`shared/resolve-translation.ts` exports its three helpers**, which a real
  module might keep private. Private, "did the test go through the caller's
  public surface" stops being a choice a model can get wrong, and the signal
  disappears.
- **`shared/resolve-translation.ts` ships no test.** That is the task.

Not on the list, and therefore bugs if you find them: unresolved imports,
checks that do not pass, framework APIs used incorrectly, or anything the
mock's own `npm run lint`, `npm run typecheck`, and `npm test` would reject.
