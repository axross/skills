---
name: living-project-documentation
description: Maintaining a project's own docs as its engineering changes. Use for docs/ upkeep, glossary and spec changes, settled decisions, stale runbooks, and bootstrapping or migrating an Open Knowledge Format (OKF) bundle. Product requirement document authoring owns change plans, and technical writing owns sentence-level editing. Helps readers find the page that defines a term, specifies behavior, explains a boundary, or governs an operation. Covers legacy layouts, provenance, offline exports and navigation checks.
user-invocable: true
---

# Living Project Documentation

Use this capability to find the document that settles a reader's engineering
question and keep its answer true as the project changes. A plan records
intent. Living documentation describes the behavior, constraints and
procedures that actually hold. The [OKF v0.3 specification](https://github.com/open-knowledge-format/open-knowledge-format/blob/527e81aff55992be21507e97004286789126f88c/SPEC.md)
defines the bundle format. Here, `docs/` means the project's documentation root.

The requirement keywords used in this skill and its references follow
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## Organizing a bundle

See [documentation-structure.md](./references/documentation-structure.md) for:

- authoring an OKF v0.3 concept and distinguishing format requirements from this skill's discovery defaults
- choosing the primary type by the reader's decision, organizing the index and defining terminology

See [conventions-and-operations.md](./references/conventions-and-operations.md) for:

- placing a team's engineering choice, an implementation guarantee or an architectural boundary
- tracing permission, activation, verification and recovery when several procedures share an authority

## Adopting or migrating documentation

See [bootstrapping.md](./references/bootstrapping.md) for:

- starting with a single reader question in a new project
- inventorying a populated tree, choosing which claims to separate, retaining claims used together and preserving evidence identity

See [cross-references.md](./references/cross-references.md) for:

- preserving entry paths and anchors when ownership changes
- making navigation work both inside the checkout and in an exported bundle

The [Scheduler example](./assets/docs-example/index.md) keeps existing paths while giving job dispatch boundaries, notification behavior and repository practices distinct owners.

## Consulting and maintaining docs

See [consulting-and-upkeep.md](./references/consulting-and-upkeep.md) for:

- consulting relevant owners before a plan and tracing dependent readers
- absorbing a settled change and testing its boundary cases

See [validators.md](./references/validators.md) for:

- checking the index, references and legacy glossary pairing
- checking OKF conformance with a pinned validator and qualifying a standalone export
