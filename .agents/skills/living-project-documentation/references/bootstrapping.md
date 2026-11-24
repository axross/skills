# Bootstrapping and Migrating Documentation

## Detect before proposing

Locate the documentation root, its index, glossary, tools and external entry
points. Ask which pages are edited as current guidance, which record evidence
at a revision and which files are actually distributed. Keep a working legacy
layout until the project adopts migration. An unrelated directory named
`docs/` is insufficient evidence of adoption.

## Start with a reader

Take one recurring question and answer it from the implementation or an adopted
project decision. Choose its primary type. For a new bundle the root index can
begin with this frontmatter, followed by a topic heading and a link to the
concept.

```yaml
---
okf_version: "0.3"
title: Scheduler engineering
description: Job execution and delivery guarantees for Scheduler contributors.
---
```

A concept at `jobs/retries.md` could begin:

```markdown
---
type: Specification
title: Job retries
description: Retry timing, attempt limits and the state callers observe between attempts.
---

# Job retries

A job waiting for its next attempt appears as queued.
```

Add a glossary entry when there is a term to define. Add directories when
subjects need grouping. The [worked bundle](../assets/docs-example/index.md)
shows how these choices look in a populated tree.

## Migrate one reading route

1. Inventory paths, headings, entry points, references, assets and metadata.
   Record any byte-pinned evidence before editing. Begin with one question a
   reader currently has to answer across several sections.
2. Identify the owning claim and the reader who acts on it. Split when claims
   serve different decisions and can change independently. For a metric,
   separate the definition from the result-buffer contract and the screen's
   display rules. Exercise each page alone. In sampled mode the producer can
   compute values for several participants while returning a score for just
   one. Which participant can the caller read? The result Specification owns
   that answer; neither the formula nor the display can settle it.
3. Keep claims that a reader must apply together. Keep a configuration variable
   with its requiredness and failure behavior, and a testing convention with
   the counterexample that justifies it. Page length, the presence of a table
   and heading count do not establish separate ownership.
4. Add frontmatter to each living page, retaining existing metadata and
   project-specific type names. Use the project layout as the starting point.
   Rewrite scope statements and surrounding transitions after extraction.
   Preserve the route from the old path and heading, and update editable
   callers. See [Cross-references](./cross-references.md).
5. Re-read the extracted page on its own and follow at least one route from an
   established entry point to its owner. Repeat for the next topic. Report one
   split and one decision to keep claims together, with the reader and change
   that justify each.

## Preserve evidence identity

An approval that names a file by SHA-256 binds to its bytes, including its first
line and newline convention. Leave the evidence file intact. Write a companion
concept with the applicable type, a pinned source path or revision URL and a
link to the acceptance record. State the exact revision, environment and
conditions the evidence supports. A dated feasibility study can support a
current conclusion while its repeatable inspection steps become a Procedure.
A successful rerun produces new evidence; it cannot retroactively verify the
old revision. Record the actual digest before migration and compare it after
export. Apply the same byte check to linked assets.

Do not infer `verified`, authorship, ownership, approval or license from a
migration. Preserve existing provenance as recorded. Name any intentionally
untyped evidence file during verification so that a second, accidental omission
is still reported.
