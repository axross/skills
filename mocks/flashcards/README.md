# Recall

A spaced-repetition flashcard app. A learner keeps decks of cards, studies
whichever are due, and grades each one as recalled or forgotten — which
decides how soon it comes back. A card can carry a photo of what it's about,
captured from the device camera when it's added.

## Getting started

```bash
npm install
npm start
```

`npm start` boots the Metro bundler and prints a QR code plus a small menu
for opening the app — in Expo Go, in a simulator, or on a connected device.

## Environment variables

Copy `.env.example` to `.env` and fill in real values for anything you need.

| Variable                        | What it's for                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_AMPLITUDE_API_KEY` | Amplitude project API key. Analytics no-ops when it's unset, so the app runs normally without one. |

## Commands

| Command                | What it does                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm start`            | Starts the Metro bundler for Expo Go, a simulator, or a device.                                                |
| `npm run android`      | Builds and runs the app on a connected Android emulator or device.                                             |
| `npm run ios`          | Builds and runs the app on a connected iOS simulator or device.                                                |
| `npm run web`          | Starts the Metro bundler targeting a browser.                                                                  |
| `npm run format`       | Rewrites the project in place to its house style.                                                              |
| `npm run format:check` | Reports formatting drift without rewriting anything.                                                           |
| `npm run lint`         | Lints the project with ESLint.                                                                                 |
| `npm run typecheck`    | Type-checks the project. The test runner compiles without checking types, so this is the only thing that does. |
| `npm test`             | Runs the unit test suite.                                                                                      |

## Generating the native projects

`android/` and `ios/` aren't kept in git — they're
[Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
output, regenerated from `app.config.ts` (and the config plugins it lists,
such as the one that supplies the camera permission's copy) whenever you
need them:

```bash
npx expo prebuild
```

There's no `npm run prebuild` for this. npm treats a script name that starts
with `pre` as a lifecycle hook rather than an ordinary script — a
`prebuild` entry would silently try to run before any script literally named
`build`, which this project doesn't have — so it's invoked directly instead
of aliased.

## Layout

- `app/` — routes only. Every file here is a thin route module: it renders
  one screen component from `src/` and nothing else. `app/sign-in.tsx` is
  the signed-out entry; the `(app)/` group is everything behind it — the
  deck list, a deck's detail screen, its study screen and add-card screen
  (both parameterised by `deckId`), and settings.
- `src/` — everything the routes render, grouped by the feature that owns
  it: `decks/`, `study/`, `cards/`, `session/`, `settings/`, `analytics/`,
  `scheduler/`, and `theme/`. Each keeps its component, its hook if it has
  one, and its own tests together.
- `src/ui/` — the small primitives more than one feature shares: the app's
  one tappable control, its one text field, and the screen wrapper every
  route renders into.
- `src/*/*.spec.ts(x)` — unit tests, colocated with the code they cover.
- `.github/workflows/` — the checks that run on every pull request.

## Contributing

Changes go through a pull request rather than landing straight on `main`.
Before writing code, sketch the plan and get it approved — this catches a
misunderstood requirement while it is still cheap to redirect, rather than
after the diff exists. A pull request is reviewed by someone other than the
person who wrote it, and merges only once that review is clean and the
checks above pass.
