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

Nothing inside a mock is bent to fit a case. Its **stack and structure are
chosen** with skill and case coverage in mind — that is what makes it useful —
but anything a case needs that the project would not naturally have arrives as
**that case's patch**: a unified diff the case declares, applied by
[`tools/lib/mock-workspace.mjs`](../tools/lib/mock-workspace.mjs) after the mock
is copied and **before** its history is replayed, so the workspace a model sees
is clean and its history unremarkable. A patch that changes the file set
maintains `history.jsonc` itself. The reasoning, and the alternatives it beat,
are in
[`docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md`](../docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md).

The test for any candidate flaw is: _would a competent developer of this
project have done it this way, for their own reasons?_ A realistic project has
gaps, and **a case may use an existing gap** — that is not a distortion. What
the principle forbids is inventing the gap.

That splits what used to be one list of "deliberate imperfections" in two, and
the two are not judged the same way:

- **Choices made for coverage** are things a real project could have done, kept
  because the evaluation needs them. They pass the test above and they stay.
- **Fixture artifacts** are compromises with no case behind them — realism
  traded for something else, usually speed. They fail the test above, and each
  one is a debt with an owner.

Both are declared below so a reviewer can tell either from a bug —
**anything not on these lists is a bug**, and the question has already cost one
review round.

### `content-site` — choices made for coverage

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
- **`shared/resolve-translation.ts` ships no test**, which is what the effect
  evaluation's one case asks a model to fix. This is a gap the project has
  rather than one planted in it: the history says how it happened without being
  asked to, since the slug module was committed _with_ its spec and the locale
  module alone during a refactor. An untested module beside a tested one is
  what real repositories look like, so no patch creates it.

### `content-site` — fixture artifacts

None. The two that were here —
[#299](https://github.com/axross/skills/issues/299) removed both — were a
hand-written stand-in for the framework's types, and an `e2e/` directory whose
command did not exist. Neither had a case behind it: both traded realism for
materialization speed, which left this mock held to a lower standard than the
mocks being built beside it. The framework and `@playwright/test` are now real
dependencies, and `npm run test:e2e` builds the app, serves it, and drives it.

Not on either list, and therefore bugs if you find them: unresolved imports,
checks that do not pass, framework APIs used incorrectly, or anything the
mock's own `npm run lint`, `npm run typecheck`, `npm test`, and
`npm run test:e2e` would reject.

### `flashcards` — choices made for coverage

- **The commit history is inconsistent in style**, for the same reason
  `content-site`'s is: a tidy log would let a control run copy the
  convention out of context.
- **Sign-in is a local stub against no backend.** It accepts any
  well-formed email address and issues a local account id, persisted on the
  device — there's no account service behind it. A probe workspace has no
  network and no credentials to sign in against a real one, and
  `amp-rn-identity-resets` needs a genuine sign-out path for its `reset()`
  call to sit in.
- **Deck content is seeded on first launch rather than fetched.** Same
  reason: a probe workspace has no network, and studying needs cards to
  work with from the first run.

### `flashcards` — fixture artifacts

None.

Not on either list, and therefore bugs if you find them: unresolved
imports, checks that do not pass, framework APIs used incorrectly, or
anything the mock's own `npm run format:check`, `npm run lint`,
`npm run typecheck`, and `npm test` would reject.
