---
status: accepted
---

# Validate a scenario with a zero-dependency JSON Schema validator

Making `tools/evaluation/scenario.schema.json` the one declaration of a
scenario's shape meant something had to evaluate it, and this repository had no
JSON Schema validator. Its dependency list held three packages —
`markdownlint-cli2`, `prettier`, `vitest` — all of them tools a contributor
runs, none of them code the instrument imports at runtime. `AGENTS.md` singles
out the dependency and supply-chain surface as one of the few areas warranting a
human reviewer in addition to the independent review, so the choice was a
supply-chain decision before it was a technical one.

Chose [`@cfworker/json-schema`](https://www.npmjs.com/package/@cfworker/json-schema),
pinned at 4.1.1. It has **no transitive dependencies**, ships native ESM, and
implements draft 2020-12 — including the two keywords this schema actually leans
on, `propertyNames` for the no-budget rule and a recursive `$ref` that carries
that rule to any depth. Installing it grew `package-lock.json` by eight lines
and `node_modules` by one directory.

Rejected [`ajv`](https://www.npmjs.com/package/ajv), which is the ecosystem's
standard and the better-known answer. It brings four transitive packages —
`fast-deep-equal`, `fast-uri`, `json-schema-traverse`, `require-from-string` —
taking this repository from three dependencies to eight, and it is CommonJS, so
every import site pays an interop step. Neither cost is large on its own. Both
are paid permanently, by a repository whose entire runtime dependency count was
zero, to buy capability this schema does not use: `ajv`'s compilation speed
matters to a service validating on every request, not to a validator compiled
once per process against fewer than thirty documents.

Rejected writing an evaluator by hand as well. It would have added no dependency
and given complete control over the error text, but it would have meant
maintaining a partial implementation of a published specification — and the
whole point of writing a standard JSON Schema is that an editor, a reviewer, or
a tool outside this repository reads the same file the same way. A validator
that agreed with the specification only on the subset someone remembered to
implement would quietly break that.

The cost accepted is reach. `ajv` is downloaded far more, audited by far more
people, and is what a contributor is likelier to have used before, so a defect
in `@cfworker/json-schema` is likelier to be found here first rather than
already fixed upstream. That risk is bounded by what the validator is asked to
do: it runs offline, over files this repository authors, in a tool that gates no
deployment. Should it stop being maintained, or should this schema come to need
a keyword it does not implement, swapping it is a change to one import and one
`validate` call in `tools/evaluation/src/scenario.mjs` — the schema itself is
standard and moves to any conforming validator unchanged.
