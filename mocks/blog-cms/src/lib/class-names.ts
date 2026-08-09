/**
 * Joins whichever class names are truthy. No call site here wants the object
 * or array forms `clsx` adds, so it doesn't earn the dependency. `Card` and
 * `Button` also merge a caller's own `className` through it.
 */
export function cx(...classNames: ReadonlyArray<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}
