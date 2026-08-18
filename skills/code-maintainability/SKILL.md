---
name: code-maintainability
description: Writing, refactoring, or reviewing code for maintainability or design — "readable", "too long", "refactor", "abstraction", "cohesion", "magic number", "dead code", "what should this be called", or "should this live elsewhere". Cohesion as the test of what belongs in one unit, naming and file organization with a fallback identifier vocabulary, route-local versus shared abstraction boundaries, complexity and readability limits, self-explanatory implementation, magic-number and dead-code discipline, scope control, and SOLID/DRY/KISS/YAGNI judgment. While authoring, each concern is a practice to uphold; while reviewing, a finding to raise against the diff.
user-invocable: false
---

# Code Maintainability

Use this capability whenever you write, refactor, or review changed code, to keep it readable and cheap to change. Each concern below is one lens with two modes: a practice to uphold while you author the code, and a finding to raise while you review a change. Hold the line the same way in both modes — the standard does not soften because you wrote the code yourself.

Where the project's development or structure conventions own a rule — or a project-defined component, routing, or domain skill does — this capability applies the maintainability lens and defers to that owner by name rather than restating it. Rules gated on "if the project has such a convention" are conditional: skip them cleanly on a project that has none.

**Guidelines:**

- MUST defer each rule to its owning skill by name where one exists (the project's development, structure, component, routing, or domain conventions), summarizing rather than duplicating its wording.
- MUST treat a concern gated on a project-specific convention as inapplicable — not a violation — on a project that does not ship that convention.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## Naming and Organization

See [naming-and-organization.md](./references/naming-and-organization.md) for:

- Keeping file names on the project's established file-naming convention (e.g., kebab-case) and the co-located sibling files that convention requires (such as a paired style-module file)
- Placing components, helpers, and data-access modules in the correct directory tier (route-local before group-shared before global), with a decision flowchart for the tier
- Following the project's own routing convention, if it defines one, and co-locating a route's required sibling files (props/types, not-found, social-image)
- Matching identifier names and casing to the conventions in and around the changed file
- Why a stated fallback vocabulary is worth having at all, and how it yields to a project convention, an owning capability, or a platform/host API the value crosses into

### Default Vocabulary

This is the fallback vocabulary for a name nothing else governs.

| Pattern              | Names                                                                       | Example                                     |
| -------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| `is<Noun>`           | a boolean, or a function returning one, saying the subject is that noun     | `isUser`                                    |
| `is<Adjective>`      | a boolean, or a function returning one, saying the subject is in that state | `isEnabled`, `isProcessing`, `isApplicable` |
| `<pastParticiple>At` | the instant an event happened, or will happen                               | `expiredAt`                                 |
| `<verb>In`           | the span remaining until an event happens                                   | `expiresIn`                                 |
| `<plural>`           | a list- or array-shaped value                                               | `users`                                     |

**Guidelines:**

- MUST apply this vocabulary only where nothing already governs the name — the project's own convention, a capability that owns that kind of value (a component capability owning prop names, for one), or the platform or host API the value crosses into. Where any of those governs, it wins, and a divergence from the table is not a finding.
- MUST put a boolean value, or a function returning one, on the `is<Noun>` or `is<Adjective>` form wherever it asks whether the subject **is** that thing or is in that state; a boolean asking something else (possession, capability, obligation) is outside this table and takes the form its own question calls for.
- MUST keep a boolean on the bare form a platform or host API already uses where the value crosses that boundary — a DOM-shaped prop mirroring an HTML boolean attribute (`disabled`, `checked`, `required`), a wire field, a configuration key — rather than prefixing it into a name that boundary does not use.
- MUST name an instant with the `At` suffix on a past participle, keeping the past participle when the instant lies in the future (`expiredAt` for an expiry not yet reached), so the suffix marks a timestamp rather than a tense.
- MUST name a span remaining until an event with the `In` suffix on the plain verb (`expiresIn`), so it is never read as the instant the `At` form carries.
- MUST reserve a plural noun for a value that is a list or an array, and MUST NOT pluralize the name of one that is not.

## Abstraction Boundaries

See [abstraction-boundaries.md](./references/abstraction-boundaries.md) for:

- Why a weak grouping costs every later reader, and why the cohesion scale is non-linear — functional far stronger than the rest, coincidental and logical far weaker than the intermediate levels
- Placing new shared logic at the lowest tier that has more than one caller (route-local before group-shared before global)
- Splitting the server / client boundary per the project's own component convention, if it defines one
- Keeping a domain-specific pipeline (such as a content-rendering chain) behind its single owning module, per the project's own domain convention, if it defines one
- Keeping tier imports pointed the right way, so shared code never depends on route-local code

### Cohesion

Cohesion is what the parts of a unit are grouped by, and it decides whether an abstraction was worth making at all.

| Level (strongest first) | Its parts are grouped because                     | Where it stands                              |
| ----------------------- | ------------------------------------------------- | -------------------------------------------- |
| Functional              | every one is essential to a single job            | the target at every granularity              |
| Sequential              | each one's output is the next one's input         | the floor for a module bundling several jobs |
| Communicational         | they all read from or write to the same data      | the same floor                               |
| Procedural              | they run in a fixed order, for different jobs     | below the floor — split it                   |
| Temporal                | they happen at the same moment                    | not a basis for an abstraction               |
| Logical                 | they are the same kind of thing, picked by a flag | not a basis for an abstraction               |
| Coincidental            | they happened to be sitting together              | not a basis for an abstraction               |

A unit's own name is the cheapest test of where it sits, and it reads straight off the diff without reconstructing the design:

| The name                                                        | What it says about the unit                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| one verb plus one object (`deserializeTemplate`, `sendRequest`) | one job — functionally cohesive                                         |
| two verbs, or an `and` (`parseAndSendRequest`)                  | two concerns wearing one name                                           |
| a vague object (`parseData`)                                    | the data model is under-schematised, or the unit covers several targets |

**Guidelines:**

- MUST build a function or class on functional cohesion — one job every part is essential to — and treat one whose parts are grouped by shared timing, by a kind selected through a flag, or by nothing at all as the finding.
- MUST hold a module that bundles several jobs to sequential or communicational cohesion at worst, and split one whose parts merely run in a fixed order for unrelated jobs.
- SHOULD read a name carrying two verbs or an `and` as two concerns in one unit and split it rather than renaming around it; a name of that shape denoting one settled operation is the exception to argue for, not to assume.
- MUST treat a vague object in a name as evidence that the data model needs schematising or that the unit spans several targets, and fix whichever it is rather than accepting the name.
- MUST justify a new abstraction by what its cases have in common — their kind, or the purpose they serve — and state that commonality; whether two similar-looking blocks qualify at all is decided by the duplication rules in [scope-discipline.md](./references/scope-discipline.md).
- SHOULD treat a name that needs a descriptive clause to stay accurate as evidence the unit should be split.

## Complexity and Readability

See [complexity-and-readability.md](./references/complexity-and-readability.md) for:

- Staying within the project's configured linter and complexity budget instead of silently bypassing it
- Giving magic numbers and strings a named constant or design token, reserving an inline lint-suppression directive (with a justifying comment) for the rare justified case
- Removing dead code (unused imports, unreachable branches, commented-out blocks)
- Why a comment is the fallback rather than the plan, the precision-or-intuition test for what a comment must add, and why a boundary doc-comment that has to describe implementation details signals a shallow interface
- Deferring doc-comment, restating-comment, and comment-voice rules to the project's development conventions, and extracting a repeated inline type into a named alias in a statically-typed language

### Self-Explanatory Implementation

An implementation should read as its own explanation; a comment then covers only what the code structurally cannot state.

**Guidelines:**

- MUST write the implementation so it carries its own explanation, and reserve a comment for what the code cannot state; what such a comment then says, and in what voice, belongs to the project's development conventions, which the Comments and Doc-Comments section in [complexity-and-readability.md](./references/complexity-and-readability.md) routes to.
- SHOULD name the intermediate steps of a procedure so the flow reads as an account of what happens rather than as a sequence to be decoded; the KISS rules in [scope-discipline.md](./references/scope-discipline.md) own the single unreadable line, while this rule owns the flow it sits in.
- MUST let the types carry the shape of what a unit takes and returns, in a statically-typed language, rather than leaving a reader to infer it from the body or from a comment restating it.
- MUST hold a doc-comment on a module or domain boundary to one criterion — a caller can use the function, class, or constant without reading its implementation — and treat a boundary unit that fails it as the finding. This deliberately extends the project's development conventions, which require a doc-comment on an exported type and on a function past a length threshold, to every symbol sitting on a boundary, a constant included; how much detail that takes, and in what format, stays with those conventions rather than being decided here.
- SHOULD treat a comment that exists to compensate for an unclear name or an unclear flow as a finding against that name or flow, not as a comment worth keeping.

## Scope Discipline

See [scope-discipline.md](./references/scope-discipline.md) for:

- Keeping the change matched to its stated goal — no drive-by refactors, per the project's development conventions
- Flagging pre-existing problems separately instead of bundling them into this change
- Justifying a new abstraction with two or more concrete call sites (YAGNI), and consolidating repeated logic only when it is truly the same concern (DRY without coupling unrelated callers)
