# Marked Counts

A number written in prose drifts the moment the file it describes changes, and
nothing here notices by default: format, lint, and structural checks all read
text, not arithmetic. A `count:` marker closes that gap for the numbers a
contributor chose to wrap.

## The Marker

A marker wraps a number inline and is invisible once the page renders:

```markdown
The <!-- count:distributable-skills -->twenty-nine<!-- /count --> here cover the
whole arc.
```

`npm test` holds the wrapped text to the file it describes — the skill count at
the top of `README.md`, a round cap quoted from a skill, a byte cap a validator
enforces. Each key is registered in
[`tests/repository/documented-counts.mjs`](../../tests/repository/documented-counts.mjs)
alongside the derivation that proves it, and a mismatch reports the file, the
claim, the truth, and what else moves with the number — so a contributor fixes
the sentence from the failure alone.

## Three Rules

A marker MUST sit inline, whole, on one line, and MUST NOT begin a line. A line
beginning with `<!--` is an HTML block in CommonMark, so a marker placed there
splits the paragraph it was meant to sit inside into two.

A marker MUST NOT appear in a distributable skill. A distributable skill
installs into other people's projects, where the derivation names a file that
does not exist and nothing can verify anything — a marker there is not a
weaker claim, it is a broken one.

A registered key MUST be marked somewhere in the repository. A key nothing
marks is dead machinery that reads as coverage while checking nothing, so the
registry test fails on it deliberately, which keeps a derivation from
outliving the sentence it was written for.

## The Deliberate Limit

Marking is opt-in: a number nobody wrapped still drifts silently, and stays a
reviewer's job rather than a check's. Grepping prose for digits was the
alternative, and it both misses a count spelled as a word and fires on every
unrelated number — worse on both counts than a limit that simply requires a
contributor to choose marking.

A marker is invisible only in prose. Inside a fenced code block it renders as
literal text, so a code sample a reader copies carries none — the marker in
this document's own example above is the exception, since it demonstrates the
syntax rather than being copied verbatim, and it is a real, checked claim for
exactly that reason.
