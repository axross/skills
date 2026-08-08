# Mock projects

Fixtures for the skill evaluations. Each subdirectory is a small,
self-contained project that
[`tools/effect-eval/setup.mjs`](../tools/effect-eval/setup.mjs) expands into an
isolated temporary directory as a real Git repository, with a chosen set of
skills installed, so a probe can give a model a task inside one.

They live at the repository root rather than under either evaluation, because
they belong to neither: the skill effect evaluation measures against them
today, and [#238](https://github.com/axross/skills/issues/238) situates the
discovery evaluation over the same fixtures.

They carry their own formatter, linter, and test runner. That is not tidiness:
a skill whose effect is running the project's checks cannot be measured at all
where those commands do not exist. It is also what keeps a mock honest, since
this repository's own format, lint, and link gates deliberately exclude
`mocks/`.

## Why this file is here and not inside a mock

Everything under a mock's own directory is copied into the workspace the model
works in, so a model reads it. A note explaining that the project is an
experiment would tell it so — and a model that knows it is being measured is
not measuring what we wanted. This file sits one level up, where
[`tools/lib/mock-workspace.mjs`](../tools/lib/mock-workspace.mjs) never copies
from.

## A mock is a genuine project

> Nothing inside a mock is bent to fit a case. Its **stack and structure are
> chosen** with skill and case coverage in mind — that is what makes it useful —
> but anything a case needs that the project would not naturally have arrives as
> **that case's patch**.

The test for any candidate flaw is: _would a competent developer of this
project have done it this way, for their own reasons?_ A realistic project has
gaps, and **a case may use an existing gap** — that is not a distortion. What
the principle forbids is inventing the gap.

That distinction is what the two lists below are for. A **realistic choice made
for coverage** is a decision this project's own developer could have made, kept
because a case needs something to point at: `shared/resolve-translation.ts`
shipping no test is one, and it belongs in the declared list. A **fixture
artifact** is a flaw nobody would have written on purpose — a project with
exactly one of everything the evaluation measures, each conveniently broken —
and it belongs in a case's patch instead, or nowhere.

**A case brings its own defect.** Some prompts are symptom-shaped ("our
Amplitude device ID resets on every launch") and only make sense against a
broken starting state. That state arrives as a unified diff the case declares,
applied by
[`tools/lib/mock-workspace.mjs`](../tools/lib/mock-workspace.mjs) after the mock
is copied and **before** its history is replayed, so the workspace a model sees
is clean and its history unremarkable. A patch that changes the file set
maintains `history.jsonc` itself. The reasoning, and the alternatives it beat,
are in
[`docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md`](../docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md).

## Deliberate imperfections, declared

A mock is a measurement instrument, and some of its flaws are the instrument.
They are listed here so a reviewer can tell a designed flaw from a bug —
**anything not on this list is a bug**, and the question has already cost one
review round. Every entry below is a realistic choice made for coverage in the
sense above; a flaw that could only be a fixture artifact does not belong here
at all.

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
- **`types/framework.d.ts` stands in for the framework**, which is not a
  dependency at all. The mock's `app/` uses a routing and rendering surface it
  never installs, so the types are hand-written to the shape the real one
  exposes. Installing the framework would make the fixture large and slow to
  materialize for a task that never renders a page; declaring the types keeps
  `npm run typecheck` honest about everything else.
- **`e2e/` and `playwright.config.ts` are structure only.** `@playwright/test`
  is not installed and both are excluded from `tsconfig.json`, so nothing there
  compiles or runs. A real project of this shape has an end-to-end directory,
  and a mock that omitted one would tell a model that this project does not
  test that way — which is a claim about conventions, in a fixture built to
  measure whether a skill supplies them.

Not on the list, and therefore bugs if you find them: unresolved imports,
checks that do not pass, framework APIs used incorrectly, or anything the
mock's own `npm run lint`, `npm run typecheck`, and `npm test` would reject.
