/**
 * Joins whichever class names are truthy. Small enough not to earn a
 * dependency on `clsx` for the two components that need it — `Card` and
 * `Button`, both of which accept and merge a caller's own `className`.
 */
export function cx(...classNames: ReadonlyArray<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}
