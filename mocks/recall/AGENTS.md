# AGENTS.md

## What this project is

Recall is a spaced-repetition flashcard app. A learner keeps a handful of
decks, each holding cards with a front and a back — a term and its
definition, a question and its answer, whatever the deck is for. A card can
also carry a photo of what it's about, captured from the device camera when
the card is added.

Studying a deck shows its due cards one at a time: tap the card to reveal the
back, then say whether it was recalled or forgotten — swipe the card, or use
the two grading buttons beside it if swiping isn't how you'd rather do it.
How a card is graded decides how soon it comes back; see "The scheduler,
briefly" below.

Signing in only asks for an email address. There's no backend behind it yet,
so it issues a local account id and remembers it on the device — good enough
to gate the signed-in screens and to give the analytics identity something
stable to attach to, without standing up an account service this early.

## How the code is organized

`app/` is routes only. Every file in it is a thin route module — it renders
one screen component and does nothing else — because that is what Expo
Router expects a routes directory to hold, and because the styling library's
build plugin is configured with a single root directory for the rest of the
app. That root is `src/`, grouped by the feature that owns each piece rather
than by what kind of file it is: `decks/`, `study/`, `cards/`, `session/`,
`settings/`, `analytics/`, `scheduler/`, and `theme/` each keep their
component, their hook if they have one, and their own tests side by side.
`src/ui/` is the exception — the small primitives more than one feature
reuses, such as the app's one tappable control and its one text field, live
there instead of inside any single feature.

Every styled component's stylesheet comes from the styling library this
project uses, never from React Native's own `StyleSheet` — the two look
similar but only the former recomputes when the theme or the device's safe
area changes, so mixing them in produces a component that quietly stops
following a theme switch. A stylesheet that needs a closed set of looks — a
button's kind, a focused state, an input's error state — expresses that
with the library's variants rather than a hand-rolled conditional style
array; `src/ui/text-field.tsx` and `src/ui/action-button.tsx` are the
components to read first for how that's done here.

Read `README.md` for the command list and the full directory layout before
touching either.

## How changes are made

Nothing lands on the main branch directly. A change starts as a pull
request, and before the implementation exists, the plan for it does — write
down what you intend to change and why, and get that plan agreed on before
writing code against it. This catches a misread requirement while it is
still a sentence to fix rather than a diff to unwind.

A pull request is reviewed by someone other than whoever wrote it. That
reviewer's job is to find what the author can no longer see in their own
work, not to rubber-stamp it, and a change merges only once that review has
nothing left to raise and the project's checks are green.

Keep a change scoped to the problem it set out to solve. A pull request that
also reformats unrelated files, renames things in passing, or fixes an
unrelated bug it happened to notice is harder to review for the same reason
it was hard to write: two different changes reasoned about as if they were
one. Split it, or leave the unrelated part for its own pull request.

## The scheduler, briefly

`src/scheduler/scheduler.ts` is the one function that decides when a graded
card comes back: `schedule(state, grade, now)`, given a card's current
scheduling state and how it was just graded, returns its next one. Forgetting
a card resets its interval to a day out and nudges its ease factor down
toward a floor; recalling it steps the interval up — a short first success, a
longer second one, then the previous interval scaled by the ease factor — and
nudges the ease factor up toward a ceiling. It takes `now` as a parameter
rather than reading the clock itself, which is what keeps it a pure function
and its tests deterministic.

Nothing else in the app recomputes a due date by hand. `src/decks/deck.ts`'s
`dueCards`/`dueCount` read the `dueAt` a scheduling state already carries;
only `gradeCard` (in `src/decks/deck-repository.ts`) calls `schedule` and
persists what it returns. Read `scheduler.ts` (and its own tests) before
changing how a grade affects the next due date, rather than re-deriving the
curve from scratch at a call site.
