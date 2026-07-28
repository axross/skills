---
name: react-component-development
description: The ability to build a React component — its composition, props contract, extracted logic, state, memoization, loading and error surfaces, testability, and list virtualization — on web and mobile native alike. Covers kebab-case files and cohesion-grouped directories, named exports and flat name-prefixed compound parts wired through a private variant context, the `ComponentProps` base type, one-level props destructuring and the mandatory `...props` spread, whole-model props, closed-union variants, `data-*` attributes, the styling-prop merge contract on both platforms, helpers-versus-hooks extraction, platform-forked files, `useState`/Context/store-library state, the auto-memoizing-compiler check, scope-relative test hooks, and when a list earns virtualization.
when_to_use: Use when writing, reviewing, or refactoring a React component or its props — "props", "spread props", "compound component", "data-testid", "testID", "extract a hook", "where should state live", "memo", "useCallback", "virtualize", "FlatList", or a surface that re-renders or scrolls badly. For styling — CSS Modules, Unistyles, tokens, themes — use a React component styling capability instead.
user-invocable: false
---

# React Component Development

Use this capability whenever you write, review, or refactor a React component. It owns **how a component is built**: the files it occupies, the props contract it publishes, the logic it refuses to hold, where its state lives, what it re-renders, what it shows before its data arrives, how a test reaches into it, and when a list of them earns virtualization.

It does **not** own how a component looks. Design tokens, colour, typography, spacing, themes, container and media queries, adaptive rules, and the stylesheet's internal structure belong to a React component styling capability. The one place the two touch is the styling **prop** — a component's `className` or `style` is part of its props contract — so [styling-props.md](./references/styling-props.md) states that contract in full and marks itself as a deliberate twin of the styling capability's equivalent section.

Two further boundaries keep this skill portable:

- **Server-state libraries are out of scope.** How queries, mutations, cache keys, and invalidation are organized belongs to whatever server-state capability the host project uses. This skill stops at the boundary: a component consumes server state, it does not fetch.
- **Framework specifics are out of scope.** React Server Components, `"use client"`, Suspense streaming, and framework caching directives belong to a web-framework capability; navigator, safe-area, and native-module concerns belong to a mobile-framework capability.

**The host project's existing convention always wins.** Every rule here names a default for a project that has not decided yet. Where the surrounding codebase, its linter, or its formatter already answers a question — barrel files, export syntax, `readonly` style, the styling mechanism, the virtualization library — match what is there and do not migrate the codebase toward this skill as a side effect of an unrelated change.

## Composition

See [composition.md](./references/composition.md) for:

- naming a component file and deciding when a component earns its own directory
- grouping sub-components with their parent by cohesion
- choosing named versus default exports, and whether to add a barrel file
- building a compound component from flat, name-prefixed parts wired through a private context
- separating primitive components from domain-specific ones, and promoting a repeated pattern
- accepting an icon as a prop rather than a glyph name

## Props Contract

See [props.md](./references/props.md) for:

- basing a props type on the rendered element and declaring an explicit return type
- destructuring props exactly one level deep and spreading the rest onto the root element
- ordering the spread so a consumer can still override what the component set
- naming handler props and their local handlers
- passing a whole model rather than flattened scalar fields
- expressing variants as closed string unions instead of boolean props
- supporting a controlled and an uncontrolled value from one component
- using `data-*` attributes as variant carriers, entity selectors, and third-party state hooks on web
- accepting and forwarding a ref

## Styling Props

See [styling-props.md](./references/styling-props.md) for:

- the contract every styled component owes its consumer: accept the styling prop, never drop it, merge it last
- composing class names on web, and which merge helper the host's styling mechanism implies
- merging styles on mobile native, and the array form a style runtime depends on
- deciding what a consumer may override versus what belongs behind a variant prop

## Logic Extraction

See [logic-extraction.md](./references/logic-extraction.md) for:

- keeping data fetching and persistence out of a component body
- choosing between a pure helper, a reusable hook, and a module-scope function
- leaving a single-use presentational sub-component unexported beside its only caller
- splitting a component across platform-forked files without duplicating its prop contract

## State Handling

See [state.md](./references/state.md) for:

- keeping local state in the smallest component that owns it
- sharing state through context by default, and what a context provider should expose
- using the host project's store library when it has one, and exposing narrow selector hooks
- recognizing state that belongs to a server-state layer rather than to the component

## Memoization

See [memoization.md](./references/memoization.md) for:

- establishing whether the project auto-memoizes at build time before adding any by hand
- the narrow set of cases where `memo`, `useCallback`, and `useMemo` pay for themselves
- why an unstable callback or object identity defeats a memoized child
- keeping a dependency list complete, and why an incomplete one returns stale values
- the nested-component-definition mistake that remounts a subtree regardless of memoization

## Loading, Empty, and Error Surfaces

See [component-states.md](./references/component-states.md) for:

- factoring the shared shape behind empty, error, and placeholder screens into one surface component
- wrapping that surface per feature so each keeps its own action control
- mapping a failure to user-facing copy outside the component body
- selecting among loading, error, empty, and loaded branches in one readable place

## Testable Components

See [testability.md](./references/testability.md) for:

- placing a stable test hook on every element a test needs to reach
- naming hooks scope-relative by default, and when a flat runner forces globally unique ones
- giving each state branch its own hook so loading, error, empty, and loaded are separately assertable
- propagating a caller-supplied hook through the props spread, including to a loading fallback
- choosing the mocking seam so the component's real logic still runs under test
- letting accessibility props serve as locators where no test hook fits

## List Virtualization

See [virtualization.md](./references/virtualization.md) for:

- the item count at which a web list earns virtualization, and why that call goes to the human
- choosing a web virtualization library, and preferring one the project already installs
- deciding between a scroll container, a flat list, and a sectioned list on mobile native
- never nesting a virtualized list inside another scrolling container of the same orientation
- shaping a list component so the wrapper owns the container and the row stays separately testable
- memoizing rows, separators, and headers, and supplying an explicit key extractor
