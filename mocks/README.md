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

### `inkwell` — choices made for coverage

- **The commit history is inconsistent in style**, for the same reason
  `content-site`'s is: a tidy log would let a control run copy the convention
  out of context and erase the effect of any skill that teaches it.
- **The publish toast's animation carries no `prefers-reduced-motion` guard.**
  One case asks a model to add one. This is a gap the project has rather than
  one planted in it — a project that added a single animation and never
  revisited motion preferences is ordinary, and the alternative (shipping the
  guard) would demonstrate the answer beside the question.
- **CSS property order is not uniform across the stylesheets.** Nothing
  enforces an order and none is followed file to file. A mock that codified
  one would hand a control run the very convention a case asks about.
- **The analytics event names are ordinary and mildly inconsistent.**
  `"post published"` and `"draft saved"` fire from the editor and
  `"Site switched"` from the sidebar's switcher — the last in a different case
  from the other two. Two cases measure event naming, so a mock demonstrating
  a scheme would flatter a control run. All three fire from a real call site:
  a name that existed only in the event type would leave the _exercised_
  convention perfectly consistent, which is the opposite of what is wanted
  here.
- **`identifyAuthor` in `src/lib/analytics.ts` has no caller yet.** It is
  written, exported and tested, and nothing invokes it, because session
  handling lives outside this cut of the product and nothing in the SPA knows
  who the author is — `AGENTS.md` says so in the project's own voice. One case
  asks which `Identify` operator a user property should use, and it needs a
  concrete `.set()` call site to point at rather than a live one.
- **`getPostSaveMutationOptions` writes the saved post into the detail cache
  and never invalidates the site's post list**, so a draft save leaves the
  title and timestamp on the list page stale until something else refetches
  it. One case asks a model what a `useMutation` should invalidate when the
  list goes stale after it succeeds, and this is that list. It is a gap the
  project has rather than one planted in it: forgetting the list while
  remembering the record you just wrote is among the most common real
  mistakes in this library, and the publish mutation beside it invalidates
  both — which is what a project looks like when one path was written
  carefully and its neighbour was not.
- **Log levels are applied plainly rather than exemplarily**, for the same
  reason: one case is about choosing between `warn` and `info`.
- **The test suite is mixed in quality.** Coverage is real but not exhaustive
  and some names describe the implementation rather than the behaviour. An
  exemplary suite would hand a control run the conventions the evaluation
  detects; a uniformly poor one would flatter a treatment run by leaving
  something obvious to correct.
- **There is no dashboard, settings page, onboarding flow, or sign-in
  screen.** Four cases ask a model to sketch one of the first three, so
  building one removes the task. The absence is honest at this stage of a
  product, and `AGENTS.md` says so in the project's own voice rather than
  leaving a reader to wonder; session handling is stated there as living
  outside this cut, which is also why no sign-in screen exists.
- **There is no design-token layer and no dark mode.** Plain CSS Modules. The
  token layer belongs to the Expo mock, where Unistyles' core API is themes and
  a light/dark pair is idiomatic; here it would be a bolted-on device, and the
  cases that need tokens are hosted there.
- **The API trusts its caller.** There is no authentication or authorisation in
  front of the Hono routes, because the console is assumed to be served behind
  the same session boundary the SPA assumes. That is a real product-cut
  boundary rather than an oversight, and no case here measures it.
- **`npm run lint` reports one warning and exits 0** —
  `react-refresh/only-export-components`, where `src/lib/consent.tsx` exports a
  provider and its hook from one file. Splitting a context across three files
  to silence a fast-refresh hint is worse code than the warning, and a mock
  whose check surface is immaculate is less like the projects this evaluation
  is about than one carrying the warning every codebase of this shape carries.

### `inkwell` — fixture artifacts

None. Every dependency is real and installed, every command in its `README.md`
resolves, and its four checks pass in a materialized copy.

Not on either list, and therefore bugs if you find them: unresolved imports,
checks that do not pass, framework or library APIs used incorrectly, or
anything a mock's own checks would reject — `npm run lint`,
`npm run typecheck`, `npm test`, and, in `content-site`, `npm run test:e2e`.
