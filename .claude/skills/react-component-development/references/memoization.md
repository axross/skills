# Memoization

Apply this reference when deciding whether to wrap a component in `memo`, a callback in `useCallback`, or a derived value in `useMemo`.

Memoization buys **referential stability**, not speed on its own. A memoized child still re-renders whenever a prop's identity changes, so the technique only pays off when every input identity is stable too — which is why the three APIs are almost always applied together or not at all.

## Check the Compiler First

A gotcha worth knowing before anything else: when the host project enables an auto-memoizing React compiler, it inserts equivalent memoization during the build, so hand-written `memo`/`useCallback`/`useMemo` is often redundant ceremony that still costs a reader's attention.

Enabling the compiler does not, in practice, mean a codebase stops memoizing by hand — plenty of compiler-enabled projects keep doing both, and a file's existing style is a better guide than the build flag alone. So establish the regime, then match what is already there rather than converting either way as a side effect of an unrelated change.

**Guidelines:**

- MUST determine whether the host project enables an auto-memoizing compiler before reasoning about whether memoization is needed at all.
- MUST match the surrounding file's existing practice rather than introducing a second convention beside it, whichever regime the project is in.
- SHOULD leave new manual memoization out of a compiler-enabled project unless the surrounding code memoizes by hand, a measurement shows the compiler missed the case, or one of the narrow cases below applies.
- MUST NOT strip existing manual memoization from a compiler-enabled project as a side effect of another change; removing it is its own change, with its own verification.

## What to Memoize

Under manual memoization, the cases that reliably pay for themselves are narrow: a component rendered many times over, a value whose construction is proportional to the data, and any callback or object feeding one of those.

Everything else — a scalar comparison, a string concatenation, a component rendered once — costs more in cache bookkeeping and reader attention than it saves.

**Guidelines:**

- MUST memoize a component rendered once per item in a long or virtualized list; this is the case where re-render cost scales with the data (see [virtualization.md](./virtualization.md)).
- MUST wrap a callback in `useCallback` when it is passed to a memoized child, an effect's dependency list, or a virtualized list's render path — an unstable callback identity defeats the child's memoization entirely.
- SHOULD memoize a derived collection — a grouping, a sort, a filter over fetched data — whose construction is proportional to the data size.
- SHOULD memoize an object or array literal passed as a prop to a memoized child, since a fresh literal is a new identity on every render.
- MUST NOT memoize a cheap scalar derivation; the comparison costs more than recomputing it.
- MUST NOT reach for memoization as a first response to a slow surface — find what actually re-renders, and prefer moving state closer to where it is used.

## Keeping a Memo Honest

A memo is a cache, and a cache with a wrong key returns stale data. The dependency list is that key, so an incomplete one does not merely under-optimize — it produces a value that disagrees with the props and state it was derived from.

**Guidelines:**

- MUST NOT silence a dependency-completeness lint rule to keep a memo stable; restructure so the value genuinely does not change, or accept the recomputation. Listing every reactive value the computation reads is what that rule already enforces.
- MUST NOT define a component inside another component's body where it renders as part of that component's own tree — it is a new type on every render, so its subtree remounts and loses its state regardless of any memoization around it. Building a lookup table of components inside a body and rendering them elsewhere is a different shape and is fine, provided the table itself is stable across renders.
- SHOULD prefer a stable identity at the source — a module-scope constant, a value from a store — over memoizing the same construction at each consumer.
