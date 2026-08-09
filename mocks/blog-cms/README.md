# blog-cms

A small hosted CMS: an author manages one or more customer sites, works
through a site's posts, and publishes one. Publishing writes a revision and
calls the site's deploy hook. See `AGENTS.md` for the shape of the product and
`docs/deploy-hooks.md` for what happens after Publish is clicked.

## Getting started

```bash
npm install
npx playwright install chromium # once per machine — the browser test project needs it
npm run db:generate # only after changing server/db/schema.ts
npm run db:migrate # creates/updates server/db/data/blog-cms.db
npm run dev:api # in one terminal
npm run dev # in another
```

The dev server proxies `/api` to the API at `http://localhost:8787` — see
`vite.config.ts`. The API seeds a few demo sites and posts on first run
against an empty database.

## Commands

| Command                | What it does                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`          | Serves the SPA locally with hot reload.                                                                                              |
| `npm run dev:api`      | Starts the Hono API on `PORT` (default `8787`).                                                                                      |
| `npm run build`        | Type-checks, then builds the production SPA bundle.                                                                                  |
| `npm run preview`      | Serves a build produced by `npm run build`.                                                                                          |
| `npm run format`       | Rewrites the project in place to its house style.                                                                                    |
| `npm run format:check` | Reports formatting drift without rewriting anything.                                                                                 |
| `npm run lint`         | Lints the whole project with ESLint.                                                                                                 |
| `npm run typecheck`    | Type-checks both the SPA and the API/server projects.                                                                                |
| `npm test`             | Runs the Vitest suite: the Node project (SPA logic, the API, `shared/`) and the browser project (real-DOM component tests) together. |
| `npm run db:generate`  | Generates a SQL migration from `server/db/schema.ts` into `server/db/migrations/`.                                                   |
| `npm run db:migrate`   | Applies pending migrations to the SQLite file at `DATABASE_PATH` (default `server/db/data/blog-cms.db`).                             |

## Layout

- `src/routes/` — the two real screens (`PostListPage`, `PostEditorPage`) and
  the `Layout` shell they render inside, which owns the persistent sidebar.
- `src/components/` — reusable pieces: `Card`, `Button`, `Sidebar`,
  `ConsentBanner`, `PublishToast`.
- `src/lib/` — the API client, the TanStack Query client, consent state, and
  the Amplitude wrapper.
- `src/queries/` — TanStack Query option factories, one export per file.
- `server/` — the Hono API, the Drizzle schema, and the generated SQL
  migrations under `server/db/migrations/`.
- `shared/` — code imported by both the SPA and the API. Just the logger
  today.
- `docs/` — operational notes that don't belong in a code comment, such as
  [deploy hooks](docs/deploy-hooks.md).
- `.github/workflows/` — the checks that run on every pull request.

## Environment variables

See `.env.example`. Every one of them is optional in local development — a
missing Amplitude key or Sentry DSN just disables that feature rather than
failing to start.

Three are build-time only and belong to whatever runs `npm run build` for a
real deploy rather than to a developer's machine: `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG` and `SENTRY_PROJECT`. Without them the build still succeeds and
still emits source maps; it just doesn't upload them, which is why a
production stack trace from a build that lacked the token stays minified.

## Contributing

Changes go through a pull request rather than landing straight on `main`.
Before writing code, sketch the plan and get it approved — this catches a
misunderstood requirement while it's still cheap to redirect, rather than
after the diff exists. A pull request is reviewed by someone other than the
person who wrote it, and merges only once that review is clean and the
commands above pass.
