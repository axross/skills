# AGENTS.md

## What this project is

A small hosted CMS. An author signs in — session handling lives outside this
cut of the product — and manages one or more customer sites from the same
account. Each site has its own posts; opening a post gives you a full-page
editor with a title, a body, a draft save, and a publish action. Publishing
snapshots the post into a revision and calls the site's deploy hook so the
static build actually goes out.

There's no dashboard, no settings page, and no onboarding flow yet. The
sidebar's "Posts" entry is the only section that exists — a second one is
easy to add once there's a second thing worth building.

## How the code is organized

`src/` is the SPA: `routes/` holds the two real screens (a per-site post list
and the post editor) plus the shell they render inside, `components/` holds
what's reusable across more than one of them, `lib/` is where a cross-cutting
concern — the API client, the query client, consent, analytics — gets exactly
one home, and `queries/` holds the TanStack Query option factories, one
export per file, grouped by the resource they read or write rather than by
the screen that happens to call them first.

`server/` is the API: a thin Hono app in `app.ts`, the Drizzle schema and its
generated SQL migrations under `db/`, and the deploy-hook call in its own
module because it's the one thing in this app that talks to somebody else's
infrastructure and needed a retry policy to go with it.

`shared/` is the one thing both sides import — right now just the logger.
Anything that earns a place there has to make sense with zero DOM APIs and
zero Node APIs in scope, since it's bundled into the browser build and run
directly by the API both.

Read `README.md` for the full command list and layout before touching either
side.

## How changes are made

Nothing lands on `main` directly. Sketch the change and get it agreed on
before writing it — a plan is a much cheaper place to catch a misunderstood
requirement than a finished diff is. A pull request gets reviewed by someone
other than whoever wrote it, and it merges once that review has nothing left
to raise and the checks in `README.md` are green.

Keep a pull request to the problem it set out to solve. Renaming something
you noticed in passing, reformatting a file you didn't otherwise touch, or
folding in an unrelated fix makes the diff harder to review for the same
reason it was harder to write: two changes being reasoned about as though
they were one. Split it, or leave the rest for its own change.

## Publishing, briefly

Publish does three things, in order: write a revision snapshot of the post's
current title and body, flip the post to `published`, and call the site's
deploy hook. The first two are one transaction; the third is best-effort — a
site's deploy hook lives on somebody else's infrastructure, and a slow or
briefly-down webhook shouldn't cost the author their published content. The
API reports whether the deploy actually fired (`deployTriggered`) and the
editor tells the author which case they're in, rather than pretending publish
either fully succeeded or fully failed. `docs/deploy-hooks.md` has the retry
policy and the reasoning behind it; read it before changing
`server/deploy-hook.ts` or the publish route that calls it.
