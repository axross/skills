# Memoization

Apply this reference when deciding whether to wrap a component in `memo`, a callback in `useCallback`, or a derived value in `useMemo`.

Memoization buys **referential stability**, not speed on its own. A memoized child still re-renders whenever a prop's identity changes, so the technique only pays off when every input identity is stable too — which is why the three APIs are almost always applied together or not at all.

## Check the Compiler First

A gotcha that inverts the usual advice: when the host project enables an auto-memoizing React compiler, it inserts equivalent memoization during the build. Hand-written `memo`/`useCallback`/`useMemo` then becomes redundant ceremony that still costs a reader's attention and can mask a genuinely missing dependency.

Expect to find hand-memoization in a compiler-enabled project anyway — a codebase that predates the compiler, or that adopted it without unwinding what came before, carries the ceremony forward. That is legacy, not a convention: it is the one place in this skill where the surrounding code is the wrong guide.

**Guidelines:**

- MUST determine whether the host project enables an auto-memoizing compiler before adding manual memoization, rather than assuming either regime.
- MUST NOT add manual memoization to a compiler-enabled project except where a measurement shows the compiler did not cover the case, and say so in a comment when you do.
- MUST NOT read surrounding hand-memoization in a compiler-enabled project as license to add more; flag it as legacy instead.
- SHOULD remove legacy hand-memoization as its own change with its own verification, rather than as a side effect of an unrelated one.
- MUST follow the surrounding file's existing practice where the project's regime is genuinely ambiguous, rather than introducing a second convention beside it.

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

## Where the Wrap Goes

`memo` takes two arguments, and settling the first says nothing about the second. A custom comparator _replaces_ the default shallow compare rather than extending it, so every prop it does not name stops being compared at all — and nothing in `memo`'s type obliges it to name any. Where the props type follows [props.md](./props.md) and extends the root rendered element's own props, it is **open**: a comparator reading two of its dozens of props type-checks cleanly, and no tool reports the rest.

Placement is what fixes that, because the fix is closing the props type and only a call site can close one. A call site knows exactly what it passes; a definition site cannot enumerate its callers. So the wrap goes where the type can be closed, and the comparator is written as a per-prop record over that closed type rather than as a boolean expression over an open one. The familiar `export default memo(Component)` is a definition-site wrap, and stays available only to a component whose props are all static.

**Example:**

```tsx
// at the call site, close the type to exactly what this caller passes
type RowProps = {
  item: Item;
  selected: boolean;
  subtitle?: string;
  onPress: (id: string) => void;
};

const Row = (props: RowProps) => <ListRow {...props} />;

// `-?` is what makes the record exhaustive. without it an optional prop such as
// `subtitle` may be left out with no diagnostic at all, which is the silent
// omission this shape exists to catch.
type Comparators<P> = { [K in keyof P]-?: (a: P[K], b: P[K]) => boolean };

function propsAreEqual<P extends object>(comparators: Comparators<P>) {
  // walked once here, not on every comparison
  const keys = Object.keys(comparators) as (keyof P)[];
  return (prev: P, next: P) =>
    keys.every(<K extends keyof P>(key: K) =>
      comparators[key](prev[key], next[key]),
    );
}

const MemoRow = memo(
  Row,
  propsAreEqual<RowProps>({
    item: (a, b) => a.id === b.id && a.revision === b.revision,
    selected: Object.is,
    subtitle: Object.is,
    // excluded: the caller holds onPress in useCallback, so a new identity here
    // carries no new behaviour. a reader sees a stale handler only if that
    // useCallback is dropped, which the caller-side rule already forbids.
    onPress: () => true,
  }),
);
```

**Guidelines:**

- MAY wrap a component at its definition site when every prop it takes is static — a primitive, a boolean, a data attribute, or `style` where this project's conventions make it static.
- MUST wrap every other component at the call site: one taking a callback, an object, an array, `children`, or a render prop. A virtualized list's row is this case rather than the one above, since a row takes both a callback and an item object (see [virtualization.md](./virtualization.md)).
- MUST settle which prop kinds count as static once per project rather than per component, since a definition site cannot enumerate its callers and only a claim about all of them supports the permission above. The determination is conservative: one component receiving computed values for a prop kind makes that kind non-static project-wide.
- MUST NOT write a custom comparator as a boolean expression over an open props type. Close the type at the call site and express the comparator as an exhaustive per-prop record, so a prop left out of the comparison is a compile error; write an excluded prop explicitly, and say in its comment what stale value the exclusion admits and when a reader could observe it.
- MUST stabilise what the caller passes before wrapping — a wrap over props that never carry a stable identity only adds comparison cost.
- SHOULD hoist the record's key list out of the comparison, since a helper that rebuilds it on every comparison pays that cost on every render the wrap was added to save.
- SHOULD treat a shared component wrapped at several call sites as a known limit: the record may be re-derived at each, and nothing here prescribes a shared source of truth for it.

## Keeping a Memo Honest

A memo is a cache, and a cache with a wrong key returns stale data. The dependency list is that key, so an incomplete one does not merely under-optimize — it produces a value that disagrees with the props and state it was derived from.

**Guidelines:**

- MUST NOT silence a dependency-completeness lint rule to keep a memo stable; restructure so the value genuinely does not change, or accept the recomputation. Listing every reactive value the computation reads is what that rule already enforces.
- MUST NOT define a component inside another component's body where it renders as part of that component's own tree — it is a new type on every render, so its subtree remounts and loses its state regardless of any memoization around it. Building a lookup table of components inside a body and rendering them elsewhere is a different shape and is fine, provided the table itself is stable across renders.
- SHOULD prefer a stable identity at the source — a module-scope constant, a value from a store — over memoizing the same construction at each consumer.
