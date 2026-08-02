# Boundary and Versions

Apply this reference when deciding whether a question belongs to this capability at all, when a project is choosing or questioning Jest as its runner, and whenever a rule's behavior depends on which Jest is installed.

Verified against `jest` 30.4.2 — [Jest — Upgrading to Jest 30](https://jestjs.io/docs/upgrading-to-jest30).

## What This Capability Owns

Two capabilities meet at every Jest test file, and confusing them produces either duplicated rules or a gap where neither answers.

| Question                                                        | Owner                         |
| --------------------------------------------------------------- | ----------------------------- |
| Is this behavior worth a test, and at which level?              | unit-testing capability       |
| What should this `describe` block and case be called?           | unit-testing capability       |
| Does this assertion pin behavior or implementation?             | unit-testing capability       |
| Is this fixture duplicated helpfully or abstracted too early?   | unit-testing capability       |
| Which Jest API expresses that decision?                         | **this capability**           |
| Which configuration option, CLI flag, or file does it need?     | **this capability**           |
| Why does the suite behave differently on this machine or in CI? | **this capability**           |
| Should a browser or a device drive this test?                   | end-to-end-testing capability |

The practical test: if the answer would change when a project migrated from Jest to Vitest, it belongs here. If it would survive the migration unchanged, it belongs upstream.

**Guidelines:**

- MUST state the Jest mechanism and name the runner-agnostic capability as owner when a rule here has a counterpart there, rather than restating the upstream rule.
- MUST NOT use a Jest mechanism to justify a testing decision the runner-agnostic capability has already made differently.
- SHOULD answer "which API expresses this?" here and "should this be tested this way?" upstream, in that order, when a task raises both.

## When Jest Is the Wrong Runner

Recommending Jest by default is a disservice in three cases, and saying so early costs far less than discovering it after a suite exists.

- **A Vite project.** Jest is not supported by Vite, because of incompatibilities with Vite's plugin system. Vitest exists precisely here and its API is close enough that most Jest knowledge transfers directly.
- **A browser- or device-driven test.** Jest's emulated DOM is not a browser. A test that depends on layout, real navigation, or genuine input belongs in a runner that drives one.
- **An asynchronous React Server Component.** Jest cannot render one; that confidence has to come from an end-to-end test.

None of these makes Jest wrong for the rest of a codebase. A project routinely runs Jest for its logic and something else for its user journeys — which is what makes the discovery rules in [test-discovery.md](./test-discovery.md) matter.

**Guidelines:**

- MUST say so plainly, and name the alternative, when a project's constraints put Jest outside its supported ground, rather than configuring around it.
- MUST NOT propose Jest as the runner for a new Vite-based project.
- SHOULD keep Jest for the logic layer even when another runner owns the user journeys, rather than consolidating onto one runner that fits neither well.

## What Jest 30 Removed

These are removals, not deprecations: the call no longer exists. Every alias below had been deprecated since Jest 26, so a codebase that ignored the warnings breaks all at once on upgrade.

| Removed                                           | Replacement                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `toBeCalled`, `toBeCalledTimes`, `toBeCalledWith` | `toHaveBeenCalled`, `toHaveBeenCalledTimes`, `toHaveBeenCalledWith` |
| `lastCalledWith`, `nthCalledWith`                 | `toHaveBeenLastCalledWith`, `toHaveBeenNthCalledWith`               |
| `toReturn`, `toReturnTimes`, `toReturnWith`       | `toHaveReturned`, `toHaveReturnedTimes`, `toHaveReturnedWith`       |
| `lastReturnedWith`, `nthReturnedWith`             | `toHaveLastReturnedWith`, `toHaveNthReturnedWith`                   |
| `toThrowError`                                    | `toThrow`                                                           |
| `jest.genMockFromModule`                          | `jest.createMockFromModule`                                         |
| `jest.SpyInstance` (type)                         | `jest.Spied<T>`                                                     |
| `jest --init`                                     | `npm init jest@latest`                                              |
| `--testPathPattern`                               | `--testPathPatterns` (now variadic)                                 |

The matcher aliases have a mechanical migration: `eslint-plugin-jest`'s `no-alias-methods` rule is auto-fixable and is in its recommended config, so enabling the plugin finds and rewrites every occurrence.

**Guidelines:**

- MUST replace a removed alias rather than pinning Jest below 30 to keep it working.
- MUST use `eslint-plugin-jest`'s `no-alias-methods` rule to find every occurrence, rather than grepping for the ones you remember.
- MUST update a script passing `--testPathPattern`; the flag is renamed and now takes multiple patterns.
- SHOULD re-run the full suite after the rewrite, since an alias replaced by hand is easy to mistype into a matcher that does not exist.

## What Changed Without Changing a Name

These are the dangerous ones: nothing errors, and a suite that passed on Jest 29 either fails for a reason that looks unrelated, or keeps passing while asserting something different.

- **`jest.mock()` paths are now case-sensitive.** A mock registered as `./FILENAME.js` against a file named `filename.js` used to work and now does not.
- **`toEqual` ignores non-enumerable properties.** An object whose property was defined with `Object.defineProperty` and no `enumerable: true` now compares as absent.
- **Snapshots include `Error.cause`,** so a wrapped error's snapshot changes on upgrade.
- **React snapshots omit empty strings,** so `<div>{""}</div>` serialises differently.
- **`.mts` and `.cts` joined the defaults** for `testMatch` and `moduleFileExtensions`; a non-test file with one of those extensions may now be collected as a test.
- **Glob matching moved to `glob@10`,** with stricter brace and extglob behavior, so a custom `testMatch` may silently select nothing.
- **jsdom moved to v26,** TypeScript's floor is 5.4, and Node's is 18.14.

**Guidelines:**

- MUST re-run the full suite and review every snapshot diff after upgrading to Jest 30, rather than trusting a green run on a subset.
- MUST verify a custom `testMatch` still selects the files it did before, using `--listTests`, after the glob upgrade.
- SHOULD check that a suite's file count did not change on upgrade; a silent drop to zero selected files reports as a pass under `--passWithNoTests`.
- SHOULD treat an unexplained equality failure after upgrade as a non-enumerable-property or case-sensitivity change before suspecting the code under test.

## Reading a Verified-Against Marker

Every reference in this skill names the Jest it was verified against. That marker exists so a rule can be disbelieved cheaply.

**Guidelines:**

- MUST check the installed Jest version before applying a version-sensitive rule, and consult that version's own documentation when it differs from the marker.
- MUST state which version an answer came from when reporting a version-sensitive conclusion.
- MUST NOT extrapolate an option's existence from an adjacent release; Jest's option surface changes within majors as well as across them.
- SHOULD treat an unversioned claim about a Jest option — here or in any other source — as unverified until confirmed against the installed version.
