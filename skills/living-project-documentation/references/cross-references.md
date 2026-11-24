# Cross-References

## Preserve the reading route

A link to a formula can settle an eligibility question; the same link cannot
tell a caller which result a mode returns. A link can resolve and still lead
to the wrong authority. A relocated section may also have readers arriving via
a published bookmark outside the checkout.

**Guidelines:**

- SHOULD link a precondition to its Specification, a release procedure to the Policy that grants permission, and a summary term to its full Definition when the calculation matters.
- MUST check inbound paths, fragments and heading text when moving content, including contributor instructions, templates and tests. Point editable references directly to the new owner.
- MUST retain a published or externally used heading or explicit anchor at its old path, with a forwarding link when the claim has moved.
- MUST repair prose whose meaning depended on its former position, including “the table above”, “see below” and “this guide owns”.

## Portable targets

In OKF a leading slash resolves from the bundle root. A relative path resolves
from the directory of the file containing it, including in source metadata.
A link to a neighboring repository file should follow the branch a contributor
is reading. For example, a relative link from a runbook to a workflow opens
the workflow beside that runbook, including on a branch that introduces both.
When exporting the documentation alone, resolve the target in the same commit
and write its published file or directory URL into the export. Keep the
section fragment. See the [export checks](./validators.md).

**Guidelines:**

- SHOULD use file-relative links for readers browsing local Markdown. Use the exact filename, percent-encode spaces and retain the fragment when the destination is a section.
- MUST keep navigation between indexes, concepts and bundled assets usable offline.
- SHOULD author same-repository source links relative to their page when the source changes with the branch. Keep an explicitly historical citation pinned to the revision it describes.
- MUST give an exported source outside the bundle a resolvable URL for the revision used, or include a permitted copy inside the bundle. Preserve immutable evidence and its approved assets byte-for-byte.
