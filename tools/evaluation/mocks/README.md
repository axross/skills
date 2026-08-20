# Mock projects

Fixtures for the skill evaluations. Each subdirectory is a small,
self-contained project that
[`tools/evaluation/src/mock-workspace.mjs`](../src/mock-workspace.mjs) expands into an
isolated temporary directory as a real Git repository, with a chosen set of
skills installed, so a probe can give a model a task inside one.

They live beside the instrument rather than inside it, because a mock belongs
to no one phase of an evaluation: the same materialized project is what a
scenario's `discovery`, `outcome`, and `transcript` factors are all judged
against.

They carry their own formatter, linter, and test runner. That is not tidiness:
a skill whose effect is running the project's checks cannot be measured at all
where those commands do not exist. It is also what keeps a mock honest, since
this repository's own format, lint, and link gates deliberately exclude
`tools/evaluation/mocks/`.

## Why this file is here and not inside a mock

Everything under a mock's own directory is copied into the workspace the model
works in, so a model reads it. A note explaining that the project is an
experiment would tell it so — and a model that knows it is being measured is
not measuring what we wanted. This file sits one level up, where
[`tools/evaluation/src/mock-workspace.mjs`](../src/mock-workspace.mjs) never
copies from.

## A mock is a genuine project

Nothing inside a mock is bent to fit a scenario. Its **stack and structure are
chosen** with skill and scenario coverage in mind — that is what makes it
useful — but anything a scenario needs that the project would not naturally
have arrives as **that scenario's patch**: a unified diff the scenario
declares, applied by
[`tools/evaluation/src/mock-workspace.mjs`](../src/mock-workspace.mjs) after
the mock is copied and **before** its history is replayed, so the workspace a
model sees is clean and its history unremarkable. A patch that changes the
file set carries an obligation to its mock's `history.jsonc`, stated in
full — with the mechanism that enforces it — in [Where a Scenario's Patch
Lives](../../../docs/conventions/directory-structure.md#where-a-scenarios-patch-lives).
The reasoning, and the alternatives it beat, are in
[`docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md`](../../../docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md).

The test for any candidate flaw is: _would a competent developer of this
project have done it this way, for their own reasons?_ A realistic project has
gaps, and **a scenario may use an existing gap** — that is not a distortion.
What the principle forbids is inventing the gap.

That splits what used to be one list of "deliberate imperfections" in two, and
the two are not judged the same way:

- **Choices made for coverage** are things a real project could have done, kept
  because the evaluation needs them. They pass the test above and they stay.
- **Fixture artifacts** are compromises with no scenario behind them — realism
  traded for something else, usually speed. They fail the test above, and each
  one is a debt with an owner.

Both are declared below so a reviewer can tell either from a bug —
**anything not on these lists is a bug**, and the question has already cost one
review round.

Where an entry below names a scenario asking something of a model, it is
naming the coverage that affordance exists for, not a scenario already
declared. #392's step 4 authors the set, one slice at a time; an entry whose
scenario is not yet written is a standing reason the mock is shaped as it is,
and is why the shape survives until then.

## A mock's own working agreement

Every mock below ships an `AGENTS.md` (and a one-line `CLAUDE.md` pointing at
it) describing the project in its own voice. A scenario's declared
`harness.agentsMd` decides whether a probe's workspace carries either file:
`true` keeps both, committed into the replayed history exactly as the mock
ships them; `false` withholds both — from the materialized tree and from the
history alike — so a probe measured under `false` runs with no working
agreement in its workspace at all. A confounder an entry below attributes to
a mock's `AGENTS.md` — `recall`'s convention note, chief among them — applies
only to a scenario declaring `true`.

### `tsuzuri` — choices made for coverage

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
  [`cover-the-locale-fallback-nothing-tests`](../scenarios/cover-the-locale-fallback-nothing-tests/)
  reads this suite as its own counter-precedent — bare subject naming and no
  condition grouping — so a fix to the untested module beside it has nothing
  here to copy.
- **`shared/resolve-translation.ts` exports its three helpers**, which a real
  module might keep private. Private, "did the test go through the caller's
  public surface" stops being a choice a model can get wrong, and the signal
  disappears.
  [`cover-the-locale-fallback-nothing-tests`](../scenarios/cover-the-locale-fallback-nothing-tests/)
  is the scenario this choice serves: its own outcome factors ask whether a
  new spec names those exported functions as callable subjects, which stays
  a real question only while they are public.
- **`shared/resolve-translation.ts` ships no test**, which is what
  [`cover-the-locale-fallback-nothing-tests`](../scenarios/cover-the-locale-fallback-nothing-tests/)
  asks a model to fix. This is a gap the project has rather than one planted
  in it: the history says how it happened without being asked to, since the
  slug module was committed _with_ its spec and the locale module alone
  during a refactor. An untested module beside a tested one is what real
  repositories look like, so no patch creates it.
- **`jest.config.cjs` declares no coverage options.** `history.jsonc`'s own
  commit that adds the file carries the message `"WIP"` — a project that
  wired up a test runner and moved on without ever turning coverage on is
  ordinary, not a defect invented for the scenario.
  [`show-what-the-test-run-never-reaches`](../scenarios/show-what-the-test-run-never-reaches/)
  needs exactly this gap: a mock that already declared `collectCoverageFrom`
  would demonstrate the answer beside the question.
- **`e2e/home.spec.ts` is a two-test suite that never renders a post.** One
  test lists the posts on the home page; the other asserts that an unknown
  slug 404s. Neither opens a post that resolves, so
  `app/(site)/posts/[slug]/` — the route where the site's multi-language
  behaviour actually happens — is driven only for its not-found path.
  `history.jsonc`'s own `"WIP e2e"` commit is honest evidence the suite was
  started and not finished, which is an ordinary shape for a project this
  size. This is a different claim from the stand-in
  [#299](https://github.com/axross/skills/issues/299) removed from the
  fixture-artifacts list below — that was a hand-written type stand-in and a
  command that did not exist, never a statement about how much of the site
  the suite drives.
  [`broaden-a-suite-that-never-opens-a-post`](../scenarios/broaden-a-suite-that-never-opens-a-post/)
  asks a model to close that gap.
- **The post catalog in `posts-data.ts` is a build-time module rather than a
  fetch from a content backend.**
  [`publish-an-edit-without-a-redeploy`](../scenarios/publish-an-edit-without-a-redeploy/)
  needs a project where staying stale until someone redeploys is genuinely
  what happens, not a defect invented for the scenario — and a checked-in
  catalog compiled into the build is an ordinary way for a project this size
  to start, so the choice reads as honest regardless of the scenario behind
  it.

### `tsuzuri` — fixture artifacts

None. The two that were here —
[#299](https://github.com/axross/skills/issues/299) removed both — were a
hand-written stand-in for the framework's types, and an `e2e/` directory whose
command did not exist. Neither had a scenario behind it: both traded realism
for materialization speed, which left this mock held to a lower standard than
the mocks being built beside it. The framework and `@playwright/test` are now
real dependencies, and `npm run test:e2e` builds the app, serves it, and drives it.

### `inkwell` — choices made for coverage

- **The commit history is inconsistent in style**, for the same reason
  `tsuzuri`'s is: a tidy log would let a control run copy the convention
  out of context and erase the effect of any skill that teaches it.
- **The publish toast's animation carries no `prefers-reduced-motion` guard.**
  [`respect-reduced-motion-in-the-publish-toast`](../scenarios/respect-reduced-motion-in-the-publish-toast/)
  asks a model to add one. This is a gap the project has rather than one
  planted in it — a project that added a single animation and never
  revisited motion preferences is ordinary, and the alternative (shipping the
  guard) would demonstrate the answer beside the question.
- **CSS property order is not uniform across the stylesheets.** Nothing
  enforces an order and none is followed file to file. A mock that codified
  one would hand a control run the very convention
  [`give-the-empty-post-list-a-real-empty-state`](../scenarios/give-the-empty-post-list-a-real-empty-state/)
  asks about.
- **Four route components each hand-roll their own loading and error
  branches, in three different shapes.** `PostListPage.tsx` and
  `RevisionsPage.tsx` render them inline, `PostEditorPage.tsx` early-returns
  instead, and `RootRedirect.tsx` early-returns too but renders nothing at all
  while pending. Nothing in `src/components/` is a shared state surface. The
  scenario below was declared while there were three of them, and its own
  description still says so.
  [`give-every-screen-one-loading-and-error-treatment`](../scenarios/give-every-screen-one-loading-and-error-treatment/)
  asks a model to pull that repeated concern onto one place both screens
  use. A mock that already shared this handling would hand a control run
  the very structure the scenario asks a model to arrive at; three screens
  each growing their own version of it, with nothing yet forcing them to
  converge, is an ordinary shape for a product still adding screens.
- **The analytics event names are ordinary and mildly inconsistent.**
  `"post published"` and `"draft saved"` fire from the editor and
  `"Site switched"` from the sidebar's switcher. One scenario measures event
  naming, so a mock demonstrating a scheme would flatter a control run. All
  three fire from a real call site: a name that existed only in the event
  type would leave the _exercised_ convention perfectly consistent, which is
  the opposite of what is wanted here.
- **The author the SPA identifies to Amplitude is resolved at the session
  boundary rather than by a sign-in screen.** `GET /me` reads
  `x-forwarded-user` and `x-forwarded-user-name` from whatever fronts the
  console and falls back to a development author when nothing does, which is
  what an app behind an authenticating proxy ordinarily looks like and is
  consistent with `AGENTS.md`'s own statement that session handling lives
  outside this cut. `identifyAuthor` is called from the shell once consent has
  been granted, so
  [`keep-a-running-count-of-an-authors-visits`](../scenarios/keep-a-running-count-of-an-authors-visits/)
  still has the two concrete `.set()` calls it points at — that scenario's own
  task prompt describes the wrapper as still waiting for sign-in, which was
  true when it was written and is the one thing #310 left behind for its own
  change to correct.
- **`getPostSaveMutationOptions` writes the saved post into the detail cache
  and never invalidates the site's post list**, so a draft save leaves the
  title and timestamp on the list page stale until something else refetches
  it. One scenario asks a model what a `useMutation` should invalidate when
  the list goes stale after it succeeds, and this is that list. It is a gap
  the project has rather than one planted in it: forgetting the list while
  remembering the record you just wrote is among the most common real
  mistakes in this library, and the publish mutation beside it invalidates
  both — which is what a project looks like when one path was written
  carefully and its neighbour was not.
- **Log levels are applied plainly rather than exemplarily**, for the same
  reason: choosing between `warn` and `info` is a subject this shape leaves
  available, not yet claimed by any declared scenario.
- **The test suite is mixed in quality.** Coverage is real but not exhaustive
  and some names describe the implementation rather than the behaviour. An
  exemplary suite would hand a control run the conventions the evaluation
  detects; a uniformly poor one would flatter a treatment run by leaving
  something obvious to correct.
  [`judge-what-the-publish-toast-commit-leaves-unchecked`](../scenarios/judge-what-the-publish-toast-commit-leaves-unchecked/)
  claims one specific instance of this mix: the publish toast component ships
  with no test of its own, while its four sibling components under
  `src/components/` — `Button`, `Card`, `ConsentBanner`, and `Sidebar` — each
  ship a `.browser.test.tsx`.
- **There is no dashboard, settings page, onboarding flow, or sign-in
  screen.** The sidebar's two sections are Posts and Revisions.
  [`sketch-a-screen-for-how-an-authors-posts-are-doing`](../scenarios/sketch-a-screen-for-how-an-authors-posts-are-doing/)
  asks a model to sketch the first of those, the author performance
  dashboard. The new-author onboarding path is a genuinely different
  subject the same skill could measure, and is recorded here as
  **unclaimed** rather than dropped — #423's coverage policy does not
  budget a second `wireframe-design` scenario in this slice. The settings
  page is a different case from onboarding's: no scenario, old or planned,
  has ever taken it as a subject, so its absence rests on the product-stage
  reasoning alone, the same footing the sign-in screen's absence already
  stands on. The absence is honest at this stage of a product, and
  `AGENTS.md` says so in the project's own voice rather than leaving a
  reader to wonder; session handling is stated there as living outside this
  cut, which is also why no sign-in screen exists.
- **There is no design-token layer and no dark mode.** Plain CSS Modules. The
  token layer belongs to the Expo mock, where Unistyles' core API is themes and
  a light/dark pair is idiomatic; here it would be a bolted-on device, and the
  scenarios that need tokens are hosted there.
- **The API trusts its caller.** There is no authentication or authorisation in
  front of the Hono routes, because the console is assumed to be served behind
  the same session boundary the SPA assumes — `GET /me` reports whoever that
  boundary forwarded, without verifying it. That is a real product-cut
  boundary rather than an oversight, and no scenario here measures it.

- **The seed writes sites and posts but no revisions**, so a fresh database
  lands the Revisions screen on its empty state until something is published.
  `server/db/queries.test.ts` asserts that a rolled-back publish leaves
  `revisions` empty against a seeded database, and seeding revisions would
  force that assertion looser. A product that writes history only when history
  happens is also the honest shape.
- **`npm run lint` reports one warning and exits 0** —
  `react-refresh/only-export-components`, where `src/lib/consent.tsx` exports a
  provider and its hook from one file. Splitting a context across three files
  to silence a fast-refresh hint is worse code than the warning, and a mock
  whose check surface is immaculate is less like the projects this evaluation
  is about than one carrying the warning every codebase of this shape carries.

### `inkwell` — fixture artifacts

None. Every dependency is real and installed, every command in its `README.md`
resolves, and its four checks pass in a materialized copy.

### `recall` — choices made for coverage

- **The commit history is inconsistent in style**, for the same reason
  `tsuzuri`'s is: a tidy log would let a control run copy the
  convention out of context.
- **Sign-in is a local stub against no backend.** It accepts any
  well-formed email address and issues a local account id, persisted on the
  device — there's no account service behind it. A probe workspace has no
  network and no credentials to sign in against a real one, and
  [`stop-the-analytics-identity-rotating-every-launch`](../scenarios/stop-the-analytics-identity-rotating-every-launch/)
  needs a genuine sign-out path for its `reset()` call to sit in.
- **Deck content is seeded on first launch rather than fetched.** Same
  reason: a probe workspace has no network, and studying needs cards to
  work with from the first run.
- **The signed-in group is gated by redirecting out of a layout component,
  not by a guard at the navigator.** `authenticated-layout.tsx` returns
  `<Redirect href="/sign-in" />` for a signed-out visitor rather than
  mounting or omitting the `(app)` group declaratively, so the route a
  learner was heading for is gone by the time they have signed in — a real
  gap a competent Expo developer could easily have left in place before
  reaching for the framework's own declarative guard.
  [`fix-a-deep-link-that-loses-its-destination-at-sign-in`](../scenarios/fix-a-deep-link-that-loses-its-destination-at-sign-in/)
  asks a model to close it.
- **Nothing in the app has a disabled state.** Three flows that wait on
  async work — adding a card, signing in, signing out — swap their
  control's label and leave it pressable throughout, and the theme
  declares no disabled role in either palette. An app whose only submit
  flows are these three, none of them urgent enough to have provoked a
  double-submit complaint yet, is an ordinary place for this to still be
  missing. [`add-a-screen-for-editing-an-existing-card`](../scenarios/add-a-screen-for-editing-an-existing-card/)
  asks a model to add one.
- **Every styled component reads from the styling library's theme, and
  `AGENTS.md` states that as the project's own rule in its own voice** —
  never from React Native's own `StyleSheet`, with `src/ui/text-field.tsx`
  and `src/ui/action-button.tsx` named as the two components to read for how
  it's done here.
  [`replace-a-conditional-style-with-a-proper-variant`](../scenarios/replace-a-conditional-style-with-a-proper-variant/)'s
  patch reverts one of those two away from that convention while its sibling
  keeps demonstrating it — and that same sentence in `AGENTS.md` is also the
  confounder the scenario's own description records: a skill-absent run can
  reach the correct fix by reading the working component beside the broken
  one, without ever discovering the skill.

### `recall` — fixture artifacts

None.

Not on either list, and therefore bugs if you find them: unresolved imports,
checks that do not pass, framework or library APIs used incorrectly, or
anything a mock's own checks would reject — `npm run format:check`,
`npm run lint`, `npm run typecheck`, `npm test`, and, in `tsuzuri`,
`npm run test:e2e`.
