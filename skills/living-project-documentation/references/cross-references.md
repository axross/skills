# Cross-References

## Preserve the reading route

Prefer the shortest link that answers the question at the point it arises.
Link a precondition to the Specification that owns it, a release procedure to the
Policy that grants permission, and a summary term to a Definition when the
reader needs its full calculation. Link to a heading when the page covers more
than one decision point.

When moving a section, search the checkout for its path, fragment and heading
text, including contributor instructions, templates and tests. Update editable
links to the new owner. If the anchor is published or used outside the
checkout, retain the original heading at the old path with one sentence routing
readers forward. If the project renderer exposes explicit anchor IDs, preserve
those too. Re-read prose such as “the table above”, “see below” and “this guide
owns”. A link can resolve and still lead the reader to the wrong authority.

## Portable targets

In OKF a leading slash resolves from the bundle root. A relative path resolves
from the directory of the file containing it, including in source metadata.
Prefer file-relative links for readers browsing local Markdown. Use the exact
filename, percent-encode spaces and keep the fragment when a heading matters.
A nested index should lead back into the same bundle without an internet
connection.

A neighboring repository file may resolve in a checkout but disappear when
only the bundle ships. For external source material use a published URL that
the intended reader can resolve. Pin the revision when a claim depends on
the precise bytes. Alternatively include the permitted source or asset with
the bundle and point to its internal path. Check URLs against the source
revision. See [Validators](./validators.md) for separate checkout and export
checks.
