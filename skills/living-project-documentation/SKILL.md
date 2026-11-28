---
name: living-project-documentation
description: Maintaining a project's engineering docs and migrating existing collections to the Open Knowledge Format (OKF). Use for requests to adopt OKF, set up a new bundle, repair stale runbooks, or update specs, glossary entries and settled decisions. Product requirement document authoring owns change plans, and technical writing owns sentence-level editing. Covers subject layout, missing answers, evidence, published paths and offline exports.
user-invocable: true
---

# Living Project Documentation

Use this capability to find the document that settles a reader's engineering
question and keep its answer true as the project changes. A plan records
intent. Living documentation describes the behavior, constraints and
procedures that actually hold. Update their owning pages in place. In a Git
project, commits and pull requests carry the history of changes and checks.
The [OKF v0.3 specification](https://github.com/open-knowledge-format/open-knowledge-format/blob/527e81aff55992be21507e97004286789126f88c/SPEC.md)
defines the bundle format. Here, `docs/` means the project's documentation root.

When migrating a populated collection, start at the project's published entry
point and follow [Assess the collection](./references/bootstrapping.md#assess-the-collection).
Consult worked examples when a particular placement or recovery choice is
unclear. Open the validator instructions when ready to check the edited root.

The requirement keywords used in this skill and its references follow
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## Organizing a bundle

See [documentation-structure.md](./references/documentation-structure.md) for:

- authoring an OKF v0.3 concept and distinguishing format requirements from this skill's discovery defaults
- choosing the subject that owns a decision, reviewing its page type, and routing readers from a subject index or glossary

See [conventions-and-operations.md](./references/conventions-and-operations.md) for:

- placing a team's engineering choice, an implementation guarantee or an architectural boundary
- tracing permission, activation, verification and recovery when several procedures share an authority

## Adopting or migrating documentation

See [bootstrapping.md](./references/bootstrapping.md) for:

- starting with a single reader question in a new project
- migrating an existing collection to OKF, including a tree that already passes validation, or carrying out an explicitly format-only request
- designing the layout from questions in handoffs and callers, checking each answer and its limits at the destination, and reporting the questions and checks still open

See [cross-references.md](./references/cross-references.md) for:

- settling support for published paths and fragments, updating callers and checking record identifiers
- making navigation work both inside the checkout and in an exported bundle

The [Scheduler migration](./assets/scheduler-migration.md#target-and-evidence)
compares a heading repair and a subject split. Its
[rollback procedure](./assets/docs-example/operating/deployment.md#rolling-back)
shows which steps stay together.

## Consulting and maintaining docs

See [consulting-and-upkeep.md](./references/consulting-and-upkeep.md) for:

- consulting relevant owners before a plan and tracing dependent readers
- following a question from real entry points before and after a move, including the exception that changes the answer

See [validators.md](./references/validators.md) for:

- running one whole-root check for OKF conformance and engineering rules from the first day of migration
- interpreting evidence warnings and the editorial type list, using focused checks and qualifying a standalone export
