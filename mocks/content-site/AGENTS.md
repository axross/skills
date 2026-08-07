# AGENTS.md

## What this project is

A personal blog. The home page shows a portrait, a short bio, and a list of
posts; each post has its own page. Posts can be written in more than one
language, and a visitor sees whichever language best matches what their
browser asks for — that matching lives in `shared/`, described below.

## How the code is organized

Route code lives under `app/`, grouped into folders that correspond to what a
visitor sees rather than to file type — a page's template, the small helpers
it alone needs, and its own tests all sit together rather than being sorted
into parallel `components/`, `helpers/`, and `tests/` trees. Anything more
than one route needs — a validation rule, a piece of business logic, a type
both a page and a test import — belongs in `shared/` instead, one level above
any single route, so it is obvious at a glance that changing it can affect
more than the page you're looking at.

Read `README.md` for the command list and the full directory layout before
touching either.

## How changes are made

Nothing lands on the main branch directly. A change starts as a pull request,
and before the implementation exists, the plan for it does — write down what
you intend to change and why, and get that plan agreed on before writing code
against it. This catches a misread requirement while it is still a sentence to
fix rather than a diff to unwind.

A pull request is reviewed by someone other than whoever wrote it. That
reviewer's job is to find what the author can no longer see in their own
work, not to rubber-stamp it, and a change merges only once that review has
nothing left to raise and the project's checks are green.

Keep a change scoped to the problem it set out to solve. A pull request that
also reformats unrelated files, renames things in passing, or fixes an
unrelated bug it happened to notice is harder to review for the same reason it
was hard to write: two different changes reasoned about as if they were one.
Split it, or leave the unrelated part for its own pull request.

## Locale fallback, briefly

A post's `translations` list is not guaranteed to include a translation for
every locale the site otherwise supports, and it can be empty for a post that
has not been translated at all yet. Whatever renders a post page has to
degrade gracefully through that: prefer an exact locale match, fall back to
matching just the language, then to the post's own default locale, and only
show nothing when none of those exist. `shared/resolve-translation.ts` is
where that order is implemented — read it (and its own comments) before
changing how a post's language is chosen, rather than re-deriving the order
from scratch at the call site.
