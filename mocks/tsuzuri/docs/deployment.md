# Deployment

Operational notes for running this site outside a local checkout. `npm run
build` produces what is served and `npm run start` serves it; everything below
is what a real deployment target adds around that pair.

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
changes which posts and translations the deployed build carries.

## Rolling back

Redeploy the previous commit's build. There is no database to migrate back —
the post catalog and everything else the app reads live in the build itself —
so a rollback here is just a redeploy.
