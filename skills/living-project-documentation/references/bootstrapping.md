# Bootstrapping and Migrating Documentation

## Detect before proposing

A documentation tree can contain current guidance, observations recorded at a
particular revision, and files left out of a distribution. Its name alone
does not identify those roles or establish that the project has adopted OKF.

**Guidelines:**

- MUST locate the documentation root, index, glossary, tools, external entry points and export boundary before proposing a layout.
- MUST preserve a working legacy layout until the project adopts migration.

## Start with a reader

One recurring question is enough to begin. For a new bundle the root index can
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

The [worked bundle](../assets/docs-example/index.md) shows topic directories and
a glossary in use.

**Guidelines:**

- SHOULD answer the first question from the implementation or an adopted decision, give the answer a primary type, and link it from the index.
- SHOULD add a glossary entry when readers need a term defined and a directory when related topics need grouping.

## Migrate one reading route

A metric's formula, its result-buffer contract and its presentation can change
independently. A sampled stage can compute values for several participants
while returning a score for only one. A caller needs the result Specification
to know whose score is available. By contrast, a configuration name, its
requiredness and its failure behavior together tell the operator what to set.
A testing convention and the counterexample that motivated it also belong
together.

**Guidelines:**

- MUST inventory the route's paths, headings, callers, assets, metadata and byte-pinned evidence before editing.
- SHOULD split claims when they serve different decisions and can change independently. Keep facts that a reader must apply together on one page; page length and heading count alone do not justify a split.
- MUST type each living page while retaining existing metadata and established type names. Update scope statements and [reading routes](./cross-references.md) after extraction.
- MUST read each extracted page independently, exercise a boundary case and trace a route from an established entry point to its owner.
- SHOULD report one justified split and one justified decision to keep content together when evaluating a migration.

## Preserve evidence identity

An approval that names a file by SHA-256 binds to its bytes, including its first
line and newline convention. A dated feasibility study can support a current
conclusion for the revision and conditions it observed. A successful rerun
produces new evidence.

**Guidelines:**

- MUST preserve the original bytes and give immutable evidence a typed companion that identifies the pinned source and links to the acceptance record.
- MUST state which revision, environment and conditions the evidence supports. Preserve recorded provenance without inferring verification, authorship, ownership, approval or license from migration.
- MAY extract reusable inspection steps from a dated report into a Procedure.
- MUST record hashes before migration and compare the exported evidence and linked assets byte-for-byte with their originals.
- MUST report intentional untyped evidence by path during verification so an accidental omission elsewhere remains visible.
