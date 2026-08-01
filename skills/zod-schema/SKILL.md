---
name: zod-schema
description: The ability to model a type schema with Zod 4, decode and encode unsanitized data across a boundary, and enforce validation where untrusted data enters. Covers the one-parse boundary and schema-derived types; schema modules, composition, and branded primitives; the object, collection, and union constructors; optionality, defaults, and prefaults; refinements, transforms, pipes, and codecs; coercion traps and config parsing; `parse` versus `safeParse`; error shape, formatting, and customization; metadata registries and JSON Schema; model structured output and tool schemas; form resolvers; database, ORM, and CMS converter pairs; performance and bundle footprint; what a parse does not make safe; testing a schema; and Standard Schema interop. Pins every rule to a verified version.
when_to_use: Use whenever a change touches Zod — `z.object`, `z.infer`, `safeParse`, `z.codec`, `z.coerce`, `z.brand`, `z.discriminatedUnion`, `.refine`, `.transform`, `zodResolver`, `z.toJSONSchema`, `ZodError`, a schema module, a validation boundary, or an unvalidated `fetch` or `JSON.parse` result. For which inputs are untrusted at all, use an application-security capability.
user-invocable: false
---

# Zod Schema

Use this capability whenever a change touches Zod — a schema being written, a parse being placed, a payload being decoded, or an error being surfaced. It owns the **schema layer**: the shape, the parse call, the type that shape yields, the error it produces, and the codec that carries data between a wire format and a domain model.

It does **not** own four neighbouring questions, each owned by a capability of its own:

- **Whether an input is untrusted at all**, and so must be checked — an application-security capability's judgment. This skill assumes that judgment is made and says how Zod carries it out.
- **That a hook exists for the parse to sit inside** — a route handler, a server function, a form action — a framework capability's fact.
- **When a fetched payload is refetched, cached, or invalidated** — a server-state capability's concern. This skill only puts a parse inside the query function it owns.
- **How a component receives, renders, and is tested against the parsed result** — a component-development capability's concern.

Where a rule here has a counterpart in one of those, this skill states the Zod mechanism and names the other as owner.

**Version discipline.** This skill is written against **Zod 4 only**. Zod 3 is out of scope as a supported line: no migration path, no `zod/v3` guidance, and no rule stated in its Zod 3 form. The one place Zod 3 appears is as a **detection signal** — a list of superseded idioms, so stale code can be recognised and replaced with the current form. That is a Zod 4 rule about a Zod 4 codebase, not coverage of Zod 3. The boundary matters more than usual here, because Zod 3 answers still outrank Zod 4 answers across tutorials, forum posts, and model recall — and most Zod 3 idioms still compile against a Zod 4 install, so "it runs" is not evidence a rule is current. Zod 4 also moves within its own major: `z.xor`, `z.invertCodec`, and the `.brand` direction parameter all arrived after 4.0. Every version-sensitive statement here names what it was verified against, and where a surface is known to move the rule is a **lookup** — consult the installed version's own documentation — rather than a frozen API name. Treat an unversioned claim about a Zod API, in this skill or anywhere else, as suspect.

**Verified against** `zod@4.4.3`, published 2026-05-04, with TypeScript 5.5+ and `strict: true` as stated prerequisites.

**Out of scope.** Zod 3 in every form. The `4.5.0-canary` line, which no rule here was derived against. Other validation libraries except where a boundary is shared with one — Standard Schema interop is covered, Valibot's or ArkType's own APIs are not. Code generation tools that emit Zod schemas are named where they change what you must still write by hand, but their own configuration is theirs.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## The Validation Boundary

See [validation-boundary.md](./references/validation-boundary.md) for:

- deciding where in a system the parse belongs, and how many times data is parsed
- what stays this skill's business and what belongs to a security, framework, or component capability
- typing everything upstream of a parse, and deriving the downstream type from the schema
- recognising the places a schema is the wrong tool
- running Zod alongside a second validation library

## Version and Packages

See [version-and-packages.md](./references/version-and-packages.md) for:

- telling a Zod 3 answer from a Zod 4 answer before acting on either
- choosing an import path from the package's export map
- the compiler settings the library assumes are already on
- checking a claim against the installed version rather than the newest one
- recognising the superseded idioms that still compile

## Schema Modules

See [schema-modules.md](./references/schema-modules.md) for:

- deciding which module owns a schema, and what to name it
- building a vocabulary of shared primitive schemas rather than repeating constraints
- giving an identifier a nominal type so it cannot be confused with a bare string
- deriving a variant schema from an existing one instead of restating it
- keeping schema construction out of a request, a render, or a loop

## Primitives and Formats

See [primitives-and-formats.md](./references/primitives-and-formats.md) for:

- validating an email, URL, identifier, timestamp, or other formatted string
- choosing between the strict and permissive form of a format that has both
- expressing a project's own string format or a template-literal pattern
- constraining a number, an integer, or a fixed-width numeric type
- modelling a closed set of values

## Objects and Collections

See [objects-and-collections.md](./references/objects-and-collections.md) for:

- deciding what happens to keys the schema does not model
- reshaping an object schema into a variant of itself
- modelling a structure that contains itself, and the type error that follows
- modelling an array, a fixed tuple, a keyed map, a set, or an uploaded file
- validating many items without paying per-item construction cost

## Unions

See [unions.md](./references/unions.md) for:

- modelling a payload that arrives in several shapes
- choosing between a tagged union, an untagged one, and an exclusive one
- what a discriminator has to be for the fast path to apply
- combining two object schemas whose fields must both hold
- recognising a union that should have been one object

## Optionality and Defaults

See [optionality-and-defaults.md](./references/optionality-and-defaults.md) for:

- choosing between absent, null, and either, from what the producer actually emits
- supplying a fallback, and deciding whether it is validated on the way through
- swallowing a parse failure deliberately rather than by accident
- normalising a source that treats null and undefined as interchangeable
- what a strict optional-property compiler setting does to the inferred type

## Refinements

See [refinements.md](./references/refinements.md) for:

- adding a constraint no built-in check expresses
- reporting several problems from one check, or reporting one against a specific field
- stopping a chain early, and skipping a check whose inputs are already invalid
- validating against something that has to be awaited
- deciding when a rule belongs in the schema and when it belongs in the domain

## Transforms and Pipes

See [transforms-and-pipes.md](./references/transforms-and-pipes.md) for:

- reshaping a validated value, and fixing one up before validation
- keeping a runtime change from destroying the schema's introspectability
- distinguishing the type a schema accepts from the type it produces
- signalling a failure from inside a transform
- knowing where decoding ends and business logic starts

## Codecs

See [codecs.md](./references/codecs.md) for:

- modelling a boundary that has to be crossed in both directions
- decoding and encoding, safely or asynchronously, and inverting the pair
- the conversions that already exist and are worth copying rather than writing
- the operations that apply in only one direction, and the one that breaks encoding
- building a codec that cannot throw, for a path where failure must not be silence

## Coercion and Configuration

See [coercion-and-config.md](./references/coercion-and-config.md) for:

- converting a value whose type the producer got wrong, and the results that surprise
- reading a boolean out of a string that says `"false"`
- the three sources where every value arrives as a string
- validating a process's configuration, and what should happen when it fails
- keeping secret configuration out of logs and out of client bundles

## Parsing

See [parsing.md](./references/parsing.md) for:

- choosing between the throwing and the result-returning parse
- parsing something whose validation cannot complete synchronously
- keeping the library's error type out of a domain signature
- deciding how often a value is parsed on its way through a system
- what a failed parse should record

## Errors

See [errors.md](./references/errors.md) for:

- reading what a failure actually says, and reshaping it for a caller
- replacing a default message at one site, at one call, or globally
- which customization wins when more than one applies
- presenting messages in the reader's language
- keeping the offending value out of a message that travels

## Metadata and JSON Schema

See [metadata-and-json-schema.md](./references/metadata-and-json-schema.md) for:

- attaching a title, description, or example to a schema, and getting it back
- defining a project's own metadata shape and constraining what may carry it
- why metadata disappears when a schema is derived from another
- emitting a JSON Schema document, and choosing the dialect the consumer parses
- the types that have no JSON Schema representation, and what to do about them

## Model Structured Output

See [model-structured-output.md](./references/model-structured-output.md) for:

- using a schema as the output contract for a model call or a tool definition
- writing field descriptions that are prompt surface rather than documentation
- the optionality constructs a strict structured-output mode rejects
- keeping a model's output type tied to the domain type it feeds
- recovering from output that is nearly valid, and sanitizing what goes back out

## Forms

See [forms.md](./references/forms.md) for:

- wiring a schema into a form library, and the vendor-neutral alternative
- the two different types a form needs when the schema transforms
- landing a cross-field error on the field that should show it
- the numeric and boolean field traps that come from string-valued inputs
- deciding whether the form schema and the API schema are the same object

## Data Store Boundaries

See [data-store-boundaries.md](./references/data-store-boundaries.md) for:

- separating the stored shape from the shape the application works with
- writing the read and write halves of a store boundary as one pair
- validating a partial write, and a create that differs from an update
- modelling a driver's own types and constraining one of their fields
- a payload whose shape changes with query depth, draft state, or locale

## Performance and Footprint

See [performance-and-footprint.md](./references/performance-and-footprint.md) for:

- what the library costs at runtime, at compile time, and in a bundle
- choosing the tree-shakable distribution, and when it is not worth its cost
- the schema construction and parse placement that dominate a hot path
- the constructs that are measurably cheaper than their obvious alternative
- deciding whether a measured problem justifies build-time compilation

## Security Posture

See [security-posture.md](./references/security-posture.md) for:

- what unknown-key handling does and does not protect against
- the things a successful parse is routinely mistaken for having done
- constraining input before an expensive check runs against it
- the schema shapes that let a caller consume unbounded work
- keeping user input out of an error that travels, and private fields out of a response

## Testing Schemas

See [testing-schemas.md](./references/testing-schemas.md) for:

- deciding which schemas earn a test and which do not
- writing fixtures that survive a change to the schema's transforms
- asserting the failures, not only the successes
- checking that a two-way boundary survives a round trip
- what generated data can and cannot establish

## Interop and Library Code

See [interop-and-library-code.md](./references/interop-and-library-code.md) for:

- accepting a schema a caller supplied, without losing what it is
- consuming a schema without depending on which library produced it
- what a library rather than an application should depend on and how
- the internals that are explicitly not a stable surface
