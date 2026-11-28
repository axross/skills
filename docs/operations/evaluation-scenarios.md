---
type: Scenario Registry
title: Evaluation Scenarios
description: Declared evaluation tasks, their mock projects, target skills and the behaviors their factors measure.
---

# Evaluation Scenarios

Under `tools/evaluation/scenarios/`, <!-- count:declared-scenarios -->thirty-two<!-- /count --> scenarios are declared today: fourteen against `inkwell`, fourteen against `tsuzuri`, and four against `recall`.

- [`quiet-the-stale-post-list-after-a-draft-save`](../../tools/evaluation/scenarios/quiet-the-stale-post-list-after-a-draft-save)
  targets `tanstack-query-development`, alongside `react-component-development`
  and `code-maintainability` as peers, and carries a `discovery` factor, two
  `outcome` factors, and a `transcript` factor judged by reasoning.
- [`respect-reduced-motion-in-the-publish-toast`](../../tools/evaluation/scenarios/respect-reduced-motion-in-the-publish-toast)
  and
  [`give-the-empty-post-list-a-real-empty-state`](../../tools/evaluation/scenarios/give-the-empty-post-list-a-real-empty-state)
  both target `react-component-styling`, claiming the two subjects
  `tools/evaluation/mocks/README.md`'s own "choices made for coverage" list
  names for `inkwell`: the toast's missing `prefers-reduced-motion` guard,
  and the property order the mock's stylesheets deliberately never
  demonstrate.
- [`give-every-screen-one-loading-and-error-treatment`](../../tools/evaluation/scenarios/give-every-screen-one-loading-and-error-treatment)
  targets `react-component-development`, alongside `code-maintainability` and
  `react-component-styling` as peers, against the four route components that
  each hand-roll their own loading and error branches in three different
  shapes — its own `scenario.json` still says three, which is what there were
  when it was declared. It carries a `discovery` factor and two `outcome`
  factors — one checking the repetition landed in one new module both screens
  import, the other checking that module still lets each screen say its own
  thing — and no `transcript` factor.
- [`sketch-a-screen-for-how-an-authors-posts-are-doing`](../../tools/evaluation/scenarios/sketch-a-screen-for-how-an-authors-posts-are-doing)
  targets `wireframe-design`, alongside `high-fidelity-ui-design` and
  `react-component-styling` as peers, against a screen `inkwell` deliberately
  does not have: an author's own performance dashboard. It carries a
  `discovery` factor and two `outcome` factors — one checking a
  self-contained document exists and names this screen's own subject, the
  other checking it stays at breadboard fidelity — and no `transcript`
  factor.
- [`confirm-a-draft-save-like-a-publish-does`](../../tools/evaluation/scenarios/confirm-a-draft-save-like-a-publish-does)
  targets `github-operation` on an ordinary `inkwell` task with nothing
  GitHub-shaped about it — this practice's **negative control** (see
  [`docs/glossary.md`](../glossary.md)), its one measurement of its own
  noise floor. It declares no `discovery` factor, for the reason its own
  `scenario.json` states.
- [`bring-the-analytics-event-names-into-one-scheme`](../../tools/evaluation/scenarios/bring-the-analytics-event-names-into-one-scheme)
  targets `software-instrumentation`, with `amplitude-instrumentation` and
  `code-maintainability` as peers, and
  [`keep-a-running-count-of-an-authors-visits`](../../tools/evaluation/scenarios/keep-a-running-count-of-an-authors-visits)
  targets `amplitude-instrumentation`, with `software-instrumentation` and
  `sentry-instrumentation` as peers — each names the other as its own peer,
  since a scheme for an event's name and which `Identify` operator a running
  count needs are the same kind of question read two ways. Both carry a
  `discovery` factor and two `outcome` factors, every factor judged by
  script, and neither declares a `transcript` phase.
- [`restore-real-file-names-in-production-stack-traces`](../../tools/evaluation/scenarios/restore-real-file-names-in-production-stack-traces)
  targets `sentry-instrumentation`, alongside `software-instrumentation` and
  `software-development` as peers, and is the first scenario in the tree to
  declare a `patch`: a unified diff that turns off `inkwell`'s working
  source-map upload, applied at materialization rather than shipped in the
  mock. Every factor, including its transcript factor, is judged by script —
  see [Skill Evaluation](../specs/skill-evaluation.md) on `patch`, and
  [Directory Structure](../conventions/directory-structure.md) for the
  convention it follows.
- [`run-the-toast-tests-the-suite-never-collects`](../../tools/evaluation/scenarios/run-the-toast-tests-the-suite-never-collects)
  targets `vitest-testing`, alongside `unit-testing` and `software-development`
  as peers, and likewise declares a `patch`: one that adds a real-DOM test for
  `PublishToast` named so it matches neither Vitest project's own `include`.
  Its two outcome factors are textual, structural reads of `vitest.config.ts`
  rather than a glob evaluator, and its transcript factor, like the sentry
  scenario's, is judged by script.
- [`find-out-what-a-change-has-to-pass-here`](../../tools/evaluation/scenarios/find-out-what-a-change-has-to-pass-here)
  targets `software-development` on `inkwell`, alongside `quality-assurance` and
  `unit-testing` as peers, on a plain contributor question rather than a code
  change. It carries a `discovery` factor and three `transcript` factors — two
  judged by script (reading the project's own contributor documentation, then
  naming every check it lists) and one by reasoning (conveying the
  format-then-lint loop as an ordered discipline rather than a flat checklist) —
  and declares no `outcome` phase, since the task leaves no artefact in the
  working tree for one to read. Its own `scenario.json` records why its two
  scripted transcript factors are expected to be weak discriminators: the mock's
  own `AGENTS.md` already points any agent at `README.md`, in both conditions.
- [`go-through-the-routes-commit-before-anyone-else-does`](../../tools/evaluation/scenarios/go-through-the-routes-commit-before-anyone-else-does)
  targets `code-review`, alongside `quality-assurance`, `code-maintainability`,
  and `loop-engineering` as peers, on `inkwell`'s `routes + shell` commit — its
  real front end, not the trivial `docs` commit at `HEAD`. It carries a
  `discovery` factor and three `transcript` factors — two judged by script
  (scoping the review from the commit's own diff, then anchoring findings to
  real lines of the commit's own files) and one by reasoning (naming an actual
  defect) — with no `outcome` phase, for the same reason as above.
- [`judge-what-the-publish-toast-commit-leaves-unchecked`](../../tools/evaluation/scenarios/judge-what-the-publish-toast-commit-leaves-unchecked)
  targets `quality-assurance`, alongside `code-review` and `unit-testing` as
  peers, on a different `inkwell` commit from the review scenario above —
  `publish toast` — and a differently framed question: not what a reviewer would
  raise about the change, but what signing it off would mean taking on trust. It
  carries a `discovery` factor and two `transcript` factors — one judged by
  script (requiring the format-and-lint gate as evidence) and one by reasoning
  (naming the untested toast as the actual gap) — again with no `outcome` phase.
- [`publish-an-edit-without-a-redeploy`](../../tools/evaluation/scenarios/publish-an-edit-without-a-redeploy)
  targets `next-app-development` against `tsuzuri`'s build-time post catalog
  — [`tools/evaluation/mocks/README.md`](../../tools/evaluation/mocks/README.md)'s
  own "choices made for coverage" list names it — alongside
  `tanstack-query-development` and `code-maintainability` as peers, and
  carries a `discovery` factor and two `outcome` factors. It declares no
  `transcript` factor, and its own `scenario.json` says why: the mock
  states this defect's cause in its own prose, in both conditions, so a
  transcript scan for that reasoning would measure reading rather than
  reasoning.
- [`accept-a-page-number-from-a-url`](../../tools/evaluation/scenarios/accept-a-page-number-from-a-url)
  targets `zod-schema` against a URL page number `tsuzuri` parses nowhere
  today, alongside `next-app-development` and `react-component-development`
  as peers, and carries a `discovery` factor and two `outcome` factors.
- [`let-readers-leave-a-note-on-a-post`](../../tools/evaluation/scenarios/let-readers-leave-a-note-on-a-post)
  targets `application-security` against a reader-note feature invented in
  its own prompt, alongside `zod-schema` and `next-app-development` as
  peers, and carries a `discovery` factor, two `outcome` factors, and a
  `transcript` factor judged by script.
- [`let-readers-choose-which-language-a-post-shows-in`](../../tools/evaluation/scenarios/let-readers-choose-which-language-a-post-shows-in)
  targets `loop-engineering` on `tsuzuri`, alongside
  `product-requirement-document-authoring`, `software-development`, and
  `next-app-development` as peers. It declares a `discovery` factor judged by
  script and nothing else, because the other two phases cannot be judged
  honestly for a skill that governs how an agent works — see
  [Skill Evaluation](../specs/skill-evaluation.md).

- [`document-a-rollback-someone-can-follow`](../../tools/evaluation/scenarios/document-a-rollback-someone-can-follow)
  targets `technical-document-authoring` against `docs/deployment.md`'s
  bare "Rolling back" section, alongside `living-project-documentation`
  and `product-requirement-document-authoring` as peers, and carries a
  `discovery` factor, two structural `outcome` factors reading that section,
  and an `outcome` factor judged by reasoning.
- [`specify-reader-corrections-before-anyone-builds-it`](../../tools/evaluation/scenarios/specify-reader-corrections-before-anyone-builds-it)
  targets `product-requirement-document-authoring` against a feature the mock
  has never specified, alongside `technical-document-authoring` and
  `living-project-documentation` as peers, and carries a `discovery` factor,
  three structural `outcome` factors — one per required heading, since a
  factor result is never a ratio — and an `outcome` factor judged by reasoning.
- [`keep-the-locale-notes-true-after-changing-the-fallback`](../../tools/evaluation/scenarios/keep-the-locale-notes-true-after-changing-the-fallback)
  targets `living-project-documentation` against a behaviour change that
  invalidates what the project already documents, alongside
  `technical-document-authoring` and `next-app-development` as peers. It
  carries a `discovery` factor, a guard `outcome` factor confirming the
  requested behaviour change actually happened, two structural `outcome`
  factors reading whether the documentation it invalidated was corrected, and
  an `outcome` factor judged by reasoning.
- [`make-room-for-a-third-language-matching-rule`](../../tools/evaluation/scenarios/make-room-for-a-third-language-matching-rule)
  targets `code-maintainability` against the duplicated translation search in
  `shared/resolve-translation.ts`, alongside `code-review` and `unit-testing`
  as peers, and carries a `discovery` factor, an improvement `outcome` factor,
  and a non-effect `outcome` factor that neither requires nor forbids the
  mock's own declared choice to keep its helpers exported. It declares no
  `reasoning` factor: its artefact is code and both of its expectations are
  mechanically checkable.
- [`cover-the-locale-fallback-nothing-tests`](../../tools/evaluation/scenarios/cover-the-locale-fallback-nothing-tests)
  targets `unit-testing` against `tsuzuri`, alongside `jest-testing` and
  `end-to-end-testing` as peers, and asks a fix to cover
  `shared/resolve-translation.ts` — the one module under `shared/` that ships
  no spec — with both outcome factors checking spec craft the mock's own
  `blog-post-slug.spec.ts` demonstrates only the opposite half of, or not at
  all: naming a callable subject with `()`, and grouping a shared condition
  under its own `describe("when ...")` block.
- [`show-real-titles-in-the-post-list-and-commit-it`](../../tools/evaluation/scenarios/show-real-titles-in-the-post-list-and-commit-it)
  targets `conventional-commits` against `tsuzuri`, alongside
  `next-app-development`, `github-operation`, and `loop-engineering` as peers,
  on a small reader-facing want — the home page's post list renders each post's
  slug where its title belongs — with the commit that carries it asked for in
  the owner's own words. It carries a `discovery` factor and two `transcript`
  factors, both judged by script (that a commit was made at all, then that its
  header conforms), and declares no `outcome` phase: `capture.mjs` compares
  content against the commit a probe started from, so a commit message reaches
  no diff. It is the only scenario whose artefact is a commit message, and so
  the first to claim the commit-history entries all three mocks carry in
  [`mocks/README.md`](../../tools/evaluation/mocks/README.md). Two limits
  are recorded in its own `scenario.json` rather than left for review: the work
  reaches `shared/resolve-translation.ts`, which three other scenarios already
  own, so it costs turns the measurement is not about; and `tsuzuri`'s own
  `AGENTS.md` asks for a plan and a pull request before a change lands, which
  may make a probe branch before committing — captured identically either way.
- [`show-what-the-test-run-never-reaches`](../../tools/evaluation/scenarios/show-what-the-test-run-never-reaches)
  targets `jest-testing` against `tsuzuri`, alongside `unit-testing` and
  `quality-assurance` as peers, and asks for real coverage visibility rather
  than trust in a green run — checking that a fix declares
  `collectCoverageFrom` (so an untouched file stays visible as uncovered
  instead of disappearing from the report) and sets `coverageProvider` to
  `v8` (the instrumentation `jest-testing` prefers for a project transformed
  by SWC rather than Babel), neither of which `jest.config.cjs` declares
  today.
- [`broaden-a-suite-that-never-opens-a-post`](../../tools/evaluation/scenarios/broaden-a-suite-that-never-opens-a-post)
  targets `end-to-end-testing` against `tsuzuri`, alongside `unit-testing`
  and `next-app-development` as peers, and asks for the post pages
  `e2e/home.spec.ts` never opens — checking that a fix drives a reader whose
  accepted language matches only by language rather than by exact locale,
  and drives the one post the home page links to that has no translation at
  all and so 404s.

- [`fix-a-deep-link-that-loses-its-destination-at-sign-in`](../../tools/evaluation/scenarios/fix-a-deep-link-that-loses-its-destination-at-sign-in)
  targets `expo-app-development` against `recall`, alongside
  `react-component-development` and `application-security` as peers, and
  carries a `discovery` factor and two `outcome` factors. It claims a gap
  [`tools/evaluation/mocks/README.md`](../../tools/evaluation/mocks/README.md)'s
  own "choices made for coverage" list names for `recall`: the signed-in
  group gated by an imperative redirect rather than a declarative guard at
  the navigator, so a deck link loses its destination at sign-in.
- [`add-a-screen-for-editing-an-existing-card`](../../tools/evaluation/scenarios/add-a-screen-for-editing-an-existing-card)
  targets `high-fidelity-ui-design` against `recall`, alongside
  `wireframe-design`, `react-component-styling`, and
  `react-component-development` as peers, and carries a `discovery` factor
  and two `outcome` factors. It claims the other gap that same list names
  for `recall`: nothing in the app has a disabled state.
- [`stop-the-analytics-identity-rotating-every-launch`](../../tools/evaluation/scenarios/stop-the-analytics-identity-rotating-every-launch)
  targets `amplitude-instrumentation` against `recall`, alongside
  `software-instrumentation` and `expo-app-development` as peers, and declares a
  `patch` — the first against a mock other than `inkwell`. That patch is
  additive rather than a move: it adds a `forgetUser()` call to
  `app/_layout.tsx`'s startup path beside the existing sign-out one, which is
  what rotates the analytics identity on every launch while leaving `recall`'s
  own suite green. One outcome factor carries the measurement; three more are
  "what had to not change" guards, each expected to contribute a zero
  differential on its own. Its transcript factor is judged by reasoning rather
  than by script, a deliberate divergence from the two `inkwell` patch scenarios
  above, recorded in this scenario's own `scenario.json` description. It claims
  the gap
  [`tools/evaluation/mocks/README.md`](../../tools/evaluation/mocks/README.md)'s
  own "choices made for coverage" list names as `amp-rn-identity-resets`.
- [`replace-a-conditional-style-with-a-proper-variant`](../../tools/evaluation/scenarios/replace-a-conditional-style-with-a-proper-variant)
  is also against `recall` and also declares a `patch`, targeting
  `react-component-styling` alongside `react-component-development` and
  `high-fidelity-ui-design` as peers. Its patch reverts
  `src/ui/action-button.tsx` to React Native's own `StyleSheet.create`, with
  hard-coded colour literals and a conditional style array standing in for the
  styling library's variants. It is declared in the knowledge that its outcome
  differential is expected to be at or near zero: `recall/AGENTS.md` states the
  very convention its factors assert, in the project's own voice, and names this
  component as one of the two to read for how it is done — an accepted limit
  recorded at this scenario's plan gate rather than found in review.

- In the [scenario source directory](../../tools/evaluation/scenarios),
  `separate-locale-matching-from-deployment/scenario.json` targets
  `living-project-documentation` against `tsuzuri`. Readers follow the original
  bookmark to the extracted language-selection contract. Operators still find
  the rollback action beside the reason a redeploy suffices.

- [Repair the reading routes for unmatched languages](../../tools/evaluation/scenarios/repair-the-reading-routes-for-unmatched-languages)
  targets `living-project-documentation` against `tsuzuri`. It exercises a
  wrong but resolving shortcut, a missing subject-index route and a README
  detour. Editors still need both terms from a retired handbook. A deployment
  bookmark has no retirement decision. The [worked reader traces](../../tools/evaluation/scenarios/repair-the-reading-routes-for-unmatched-languages/review/reader-traces.md)
  describe how to evaluate the edited destinations and their limits.

- [Migrate the engineering manual to OKF](../../tools/evaluation/scenarios/migrate-the-engineering-manual-to-okf)
  asks for a collection migration in `inkwell`. An editor needs to find the
  publishing and revision contracts from the manual's front page. An operator
  needs the stop condition at the point of recovery. The factors check whether
  the agent discovers the competing owners, uses project evidence to fill a gap
  and preserves the supported entry and its evidence. Its work-account factor
  reads the agent’s own messages for a reported change and before/after route.

Fifteen scenarios inspect transcripts. Of their twenty-one transcript factors, ten
use script judgments and eleven use reasoning judgments. The remaining scenarios
exercise discovery or inspect the resulting artifacts.

For execution, follow [Evaluation Dispatch](./evaluation-dispatch.md). For the
meaning of a discovery, outcome or transcript judgment, see
[Skill Evaluation](../specs/skill-evaluation.md#three-phases).
