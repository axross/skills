# Deployment

Operational notes for running this site outside a local checkout. This
fixture does not include a deployment target or a build script — read this as
what a real deployment of the full site adds on top of what is here.

## Environments

| Environment | Trigger                     | Notes                            |
| ----------- | --------------------------- | -------------------------------- |
| Production  | Push to `main`              | Serves the default locale first. |
| Preview     | Pull request opened/updated | One preview per pull request.    |

## Locale fallback

A reader's accepted locales come from their browser's `Accept-Language`
header. `shared/resolve-translation.ts` is what turns that preference list
into the translation a post detail page renders — see its own documentation
for the exact resolution order. Deployment does not change that order; it only
changes which posts and translations exist in the content store a running
instance reads from.

## Rolling back

Redeploy the previous commit's build. There is no database migration in this
fixture's thinned-down scope, so a rollback here is just a redeploy — the full
project's own deployment docs cover the case where a migration also needs to
be reverted.
