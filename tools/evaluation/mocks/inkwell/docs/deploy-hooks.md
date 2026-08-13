# Deploy hooks

Operational notes on what happens after a post is published — the part that
doesn't belong in a code comment because it spans two files (`server/app.ts`
and `server/deploy-hook.ts`) and one decision worth explaining once rather
than re-deriving at either call site.

## What publishing actually does

Publishing a post is three steps, in order:

1. Write a `revisions` row — a snapshot of the post's title and body at the
   moment of publish.
2. Flip the post's `status` to `published`.
3. Call the site's `deployHookUrl`.

The first two are a single logical write and either both happen or neither
does. The third is best-effort: a site's deploy hook is usually a webhook on
someone else's static host (Vercel, Netlify, and similar all expose one), and
those are occasionally slow or briefly unavailable — worth a retry, not worth
losing the author's published content over.

## Why a failed deploy hook doesn't fail the publish

By the time `triggerDeployHook` runs, the post and its revision are already
committed. Rolling that back because a webhook timed out would throw away
real work over a problem that's usually transient and, worse, outside this
app's control entirely. Instead, the publish response carries
`deployTriggered: boolean`, and the editor shows the author which case they're
in — see `PostEditorPage.tsx`'s toast copy.

## The retry policy

Three attempts, with a linear backoff between them. That's tuned for "a cold
serverless function taking a moment to wake up," not for a target that's
genuinely down — three attempts a few hundred milliseconds apart won't save a
publish from a deploy hook that's been deleted or misconfigured. When every
attempt fails, `deploy-hook.ts` logs the exhaustion at `error` (there's no
error tracker on the API side to hand it to instead — see `shared/logger.ts`)
and returns `{ ok: false }` rather than throwing, so the route above always
gets a definite answer either way.

## Rolling back a bad publish

There's no unpublish button in this cut of the product. The revision a
publish writes is a record of what went out, not an undo mechanism —
reverting live content means editing the post back to the previous
revision's text and publishing again.
