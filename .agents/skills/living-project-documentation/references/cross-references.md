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
A neighboring repository file can be available in a checkout and absent after
export. See the [export checks](./validators.md).

**Guidelines:**

- SHOULD use file-relative links for readers browsing local Markdown. Use the exact filename, percent-encode spaces and retain the fragment when the destination is a section.
- MUST keep navigation between indexes, concepts and bundled assets usable offline.
- MUST give a source outside the bundle a published, resolvable URL or include a permitted copy inside the bundle. Pin its revision when a claim depends on its precise bytes.
