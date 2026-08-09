# content-site

A personal blog: a portrait and bio on the home page, and posts underneath.
Each post can carry more than one translation, and a reader is served
whichever translation best matches the locales their browser sends.

## Getting started

```bash
npm install
```

## Commands

| Command                | What it does                                              |
| ----------------------- | ---------------------------------------------------------- |
| `npm run dev`           | Serves the site locally with hot reload.                   |
| `npm run build`         | Builds the production bundle.                              |
| `npm run start`         | Serves a build produced by `npm run build`.                |
| `npm run format`        | Rewrites the project in place to its house style.          |
| `npm run format:check`  | Reports formatting drift without rewriting anything.       |
| `npm run lint`          | Lints the whole project; also checks formatting.           |
| `npm run typecheck`     | Type-checks the project. The test runner compiles without checking types, so this is the only thing that does. |
| `npm test`              | Runs the unit test suite.                                  |
| `npm run test:e2e`      | Runs the end-to-end suite. Builds the app and serves it first, so it needs a browser — `npx playwright install chromium` once per machine. |

## Layout

- `app/(site)/` — the reader-facing route group: the home page, the post
  detail page, and the small data module they both read from.
- `shared/` — code shared by more than one part of the app, independent of any
  one route. `shared/resolve-translation.ts` is the locale-fallback logic a
  post detail page calls into; `shared/blog-post-slug.ts` is the slug shape
  every post's `slug` is validated against.
- `shared/*.spec.ts` — unit tests, colocated with the code they cover.
- `e2e/` — end-to-end specs, kept apart from the unit tests above because they
  exercise the whole running app rather than one module in isolation.
- `docs/` — operational notes that do not belong in code comments, such as
  [deployment](docs/deployment.md).
- `.github/workflows/` — the checks that run on every pull request.

## Contributing

Changes go through a pull request rather than landing straight on `main`.
Before writing code, sketch the plan and get it approved — this catches a
misunderstood requirement while it is still cheap to redirect, rather than
after the diff exists. A pull request is reviewed by someone other than the
person who wrote it, and merges only once that review is clean and the checks
above pass.
