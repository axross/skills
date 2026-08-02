# Tooling and Versions

Apply this reference when setting up linting for this layer, diagnosing a cache problem, or bringing a codebase forward from v4.

## The Eight Rules

The library ships [an ESLint plugin](https://tanstack.com/query/latest/docs/eslint/eslint-plugin-query). Each of its rules is stated below as something a reader can check without the linter installed, because a project that lints with a different tool still needs the rule — an axis the plugin's own pages do not present.

| Rule                            | What it requires                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `exhaustive-deps`               | every value the `queryFn` reads that changes the result appears in the key                |
| `no-rest-destructuring`         | no `...rest` on a query result, which subscribes to every field                           |
| `stable-query-client`           | the client is not constructed inside a render body                                        |
| `no-unstable-deps`              | a query or mutation result object is not put in a React hook's dependency array           |
| `infinite-query-property-order` | `queryFn` precedes both page-param callbacks; those two are unordered                     |
| `no-void-query-fn`              | the `queryFn` returns a value                                                             |
| `mutation-property-order`       | `onMutate` precedes `onError` and `onSettled`; those two are unordered                    |
| `prefer-query-options`          | key and function are wrapped in an option helper, and cache calls reuse the factory's key |

Seven are in the recommended set; `prefer-query-options` is in the stricter one, and it is the rule that mechanically enforces the pattern in [option-factories.md](./option-factories.md).

**One of them cannot see the factory pattern.** `mutation-property-order` matches `useMutation()` call sites only; its sibling also matches `infiniteQueryOptions`. So a project following [option-factories.md](./option-factories.md) — where mutation callbacks live in `mutationOptions()`, never inline — gets **no** linter coverage of the mutation ordering rule, even with the plugin installed. It stays a review check regardless.

**The two ordering rules are looser than the plugin's own documentation says.** Its pages list a strict three-way order for each, but both implementations sort a _leading_ property before an unordered _group_ — `queryFn` before `{getPreviousPageParam, getNextPageParam}`, and `onMutate` before `{onError, onSettled}`. The table above states what the rules enforce. Treating the documented three-way order as normative makes a reviewer flag correct code.

**Guidelines:**

- MUST satisfy all eight rules whether or not the linter runs; each corresponds to a defect stated elsewhere in this skill.
- SHOULD install `@tanstack/eslint-plugin-query` and enable its stricter preset **only where the host repository already lints with ESLint**; adding ESLint solely for this is not worth the second toolchain.
- MUST treat the rules as review checks in a repository that lints with another tool, since nothing else will catch them.
- SHOULD NOT disable `no-rest-destructuring` unless the project sets `notifyOnChangeProps` deliberately and has accepted responsibility for re-render scope.

## Inspecting the Cache

The [devtools](https://tanstack.com/query/latest/docs/framework/react/devtools) show every entry, its key, its status, its data, and its observers — which turns most cache defects from guesswork into reading. They ship as a separate package and are excluded from production builds by default.

Four things they answer quickly:

- **Two entries where one was expected** — a key carrying something unstable, or a missing tenancy root.
- **An entry nothing observes** — a key mismatch between the writer and the reader.
- **An entry stuck `paused`** — no connectivity, or an unwired online manager.
- **An entry refetching constantly** — `staleTime: 0` plus a remounting observer.

Browser extensions provide the same view without adding a dependency. React Native has no first-party panel; the options there are third-party and change often enough to be worth checking rather than assuming.

**Guidelines:**

- SHOULD reach for the devtools before reasoning about a cache defect from the code; the key and the observer count usually name the problem outright.
- SHOULD prefer a browser extension over the package where the project does not want another dependency.
- MUST confirm the devtools are excluded from production builds rather than assuming the default holds under the project's bundler configuration.

## Arriving From v4

Every rename and removal is enumerated in [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) — `cacheTime` to `gcTime`, `useErrorBoundary` to `throwOnError`, positional arguments to a single options object, and the rest.

What that guide does not sort for you is which changes fail **loudly** and which fail **silently**. Two are silent: the removed per-query `onError`/`onSuccess`/`onSettled` are ignored rather than rejected, and `status: 'loading'` became `status: 'pending'` while `isLoading` was redefined as `isPending && isFetching` — so a v4-era loading check keeps compiling and type-checking while meaning something different. Everything else on the list breaks at build time and finds itself.

Minimums rose too: React 18 and TypeScript 5.4.

**Guidelines:**

- MUST re-check every per-query `onError`/`onSuccess`/`onSettled` when migrating; they are silently ignored, not flagged.
- MUST re-read every `isLoading` check, since its meaning changed while its name did not.
- SHOULD run the library's codemod for the mechanical renames and review the result rather than trusting it wholesale.

## Reading Documentation at the Installed Version

Behaviour has moved **inside** v5. The mutation callback signatures gained arguments, and `staleTime: 'static'`, `subscribed`, `environmentManager`, and `mutationOptions` are all recent additions — a codebase on an earlier 5.x does not have them. The [React adapter's own documentation](https://tanstack.com/query/latest/docs/framework/react/overview) tracks `latest` rather than an installed version, so it describes APIs a project may not have.

The adapters also version independently: the React package being on v5 says nothing about what the Vue or Svelte packages are on, and documentation for one is not documentation for another.

**Guidelines:**

- MUST check the installed version before relying on any API this skill marks as version-sensitive.
- MUST read the React adapter's documentation specifically; another adapter's guide can describe a different major.
- SHOULD state the version a rule was verified against when recording a project-local convention derived from it.
- MUST treat an experimental export as experimental — the streaming helper and the per-query persister both carry the prefix, and their signatures move between releases.

**Review checks:**

- Any of the eight rules violated in a repository whose linter cannot catch it — severity as stated by the owning reference.
- ESLint added to a project solely for this plugin — **Minor**; a second toolchain for eight rules that can be reviewed.
- Devtools reachable in a production bundle — **Major**; it exposes the full cache, including whatever the responses contain.
- A v4-era per-query `onError` surviving a migration — **Major**; it silently never runs.
- A v4-era `isLoading` check unreviewed after migration — **Major**; the meaning changed under the same name.
- A version-sensitive claim in project documentation with no version stated — **Minor**.
