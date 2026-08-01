---
name: vitest-testing
description: The ability to configure, drive, and keep honest a Vitest suite on the 4.x line — the runner-specific layer beneath a tool-agnostic unit-testing capability. Covers the config file and test projects; environments and the run lifecycle; the test API, fixtures, assertions, and async tests; the whole `vi` mocking surface — functions, modules, timers, ambient state, and network; snapshots; coverage providers; pools, isolation, and performance; filtering and test tags; reporters including the agent-aware `minimal` reporter; Browser Mode with component and visual-regression testing; type and in-source tests; debugging and the documented failure modes; suite hygiene; and the operational rules an agent driving the runner needs. Names the release each rule was verified against, and prescribes a lookup wherever the option surface moved between v3 and v4.
when_to_use: Use whenever a change touches Vitest — `vitest.config`, `defineConfig` from `vitest/config`, `vi.mock`, `vi.fn`, `vi.spyOn`, `vi.useFakeTimers`, `expect.poll`, `toMatchInlineSnapshot`, `test.extend`, `describe.concurrent`, `projects`, `pool`, `isolate`, `maxWorkers`, `--coverage`, `browser.instances`, `toMatchScreenshot`, `*.test-d.ts`, `import.meta.vitest`, `--tags-filter`, a `vitest run` invocation, or a config key Vitest 4 silently ignores. For what to assert and how a spec is shaped, use a unit-testing capability; for journeys, locators, and server lifecycle, use an end-to-end capability; for another runner, use that runner's own capability.
user-invocable: false
---

# Vitest Testing

This skill equips you to configure, run, debug, and review a Vitest suite: the runner's own surface — its config file, its `vi` API, its pools and reporters, its coverage providers, and its Browser Mode — plus the operational rules an agent needs to drive it without hanging a session or burning a context window.

It is the **runner-specific layer**. A tool-agnostic unit-testing capability owns what to assert, how to name a spec, what makes a fixture good, and whether a behavior deserves a unit test at all; those questions have the same answers whatever runner executes them. This skill owns the mechanism underneath: which option, which file, which `vi` call, which flag. Where a rule here touches judgment — mock only what is slow or non-deterministic, prefer a readable diff — it names the tool-agnostic owner rather than re-deciding it.

Two neighbours are disclaimed explicitly. An end-to-end capability owns user journeys, the locator fallback hierarchy, server lifecycle, and scenario coverage **even when the runner underneath is Vitest**; this skill owns the runner configuration that suite runs on. A component-development capability owns test-hook conventions such as `data-testid` and `testID`; this skill owns the Browser Mode machinery that queries them. A project on a different runner should reach for that runner's own capability, not this one.

**Version posture is lookup-first.** Rules are verified against **Vitest 4.1.10** (Node >= 20, Vite >= 6) and name the release they were checked against. Vitest 4 moved or removed roughly two dozen configuration options and **silently ignores the old names rather than erroring**, so a v3-era answer copied off the open web fails invisibly — the suite runs, the option does nothing. Wherever a surface is known to have moved, consult the installed version's own documentation rather than recalling an option name.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## Running Vitest as an Agent

See [running-as-an-agent.md](./references/running-as-an-agent.md) for:

- invoking the runner so it terminates instead of entering watch mode and hanging the session
- auditing a project's own test script before trusting it
- narrowing a run to one file, one name, or one line instead of re-running everything
- the reporter that trims output for an agent, and the configuration that silently switches it off
- reading a failure once rather than re-running the suite to confirm it

## Version Discipline

See [version-discipline.md](./references/version-discipline.md) for:

- the 4.x baseline, its Node and Vite floors, and the per-release feature gates
- the options that moved between v3 and v4, and the ones removed outright
- why a renamed option fails silently, and how to detect one already in a config
- the behavior changes that pass type-check and fail at runtime
- deciding when to consult the installed version's docs instead of recalling a name

## Configuration

See [configuration.md](./references/configuration.md) for:

- choosing between a dedicated test config and a `test` block in the Vite config
- file discovery, and the default exclusion set that shrank in v4
- explicit test-API imports versus injected globals, and what the latter costs
- mock hygiene as configuration rather than a remembered hook
- timeouts, console handling, and the experimental block as a distinct risk class

## Test Projects

See [test-projects.md](./references/test-projects.md) for:

- running several configurations in one process, and what replaced the workspace file
- the entry shapes a project list accepts, and the config-file naming rule
- inheritance, which is off by default and surprises people
- the options that are process-wide and therefore illegal in a project
- splitting Node and browser suites, or fast and slow ones, without forking the command

## Test Environment

See [environments.md](./references/environments.md) for:

- picking the cheapest environment that answers the question
- overriding the environment for one file instead of the whole suite
- the dependency-import failure that only appears under a DOM environment
- custom environments, and the field that replaced the v3 transform mode
- recognizing when a DOM shim can no longer answer the question

## Run Lifecycle

See [run-lifecycle.md](./references/run-lifecycle.md) for:

- what runs once, once per file, and once per test
- the global-setup scope boundary, and the only supported way across it
- where mock registration and matcher extension belong
- what changes when isolation is disabled, and what stays cached
- watch-mode behavior that surprises a suite with external state

## Test API

See [test-api.md](./references/test-api.md) for:

- the test and suite signatures, and the argument position that moved in v4
- the modifier set, and the two parametrization forms that differ in how they spread
- options that change semantics rather than selection, and what a retry hides
- the hook set, including the wrapper hooks added in 4.1
- per-test cleanup that survives concurrent execution

## Fixtures and Test Context

See [fixtures-and-context.md](./references/fixtures-and-context.md) for:

- the context every test receives, and why concurrent snapshots need its assertion entrypoint
- declaring fixtures with type inference, and registering their teardown
- test, file, and worker scope, and the dependency rule between them
- why destructuring the context is load-bearing rather than stylistic
- overriding a fixture for one suite, and injecting per-project values

## Assertions and Async Tests

See [assertions-and-async.md](./references/assertions-and-async.md) for:

- the three equality matchers and what separates them
- asserting the part that matters instead of pinning a whole payload
- retrying an assertion until it holds, and the limits of the polling form
- guarding against a test that asserts nothing
- awaiting promise assertions, and the v4 behavior when one is not awaited
- custom matchers, their result shape, and the type augmentation they need

## Function Mocks and Spies

See [function-mocks.md](./references/function-mocks.md) for:

- creating a boundary versus observing an existing one
- what a spy cannot see, and why import-time work is invisible to it
- setting implementations and return values, including the 4.1 throw helpers
- the three reset calls stated precisely, and what none of them reaches
- inspecting recorded calls, results, instances, and ordering

## Module Mocking

See [module-mocking.md](./references/module-mocking.md) for:

- hoisting, and what it does to anything the factory closes over
- partial mocks, automocking rules, and the spy option that keeps real behavior
- mock directories, and the condition that makes them inert
- mocking built-ins and modules that do not exist
- the same-file call that cannot be mocked, and the refactor that is the only fix

## Timers and Ambient State

See [timers-and-ambient-state.md](./references/timers-and-ambient-state.md) for:

- installing and restoring a fake clock so it cannot leak into later files
- advancing time, and when the asynchronous variant is required
- freezing a date so a snapshot stops drifting
- stubbing globals a DOM shim lacks, and environment variables in both places they appear
- an in-memory file system, and the mock files it needs

## Network Mocking

See [network-mocking.md](./references/network-mocking.md) for:

- intercepting at the network layer instead of stubbing the fetch primitive
- the handler lifecycle across setup, each test, and teardown
- the setting that turns a silent real request into a failure
- where this stops and a real-dependency end-to-end suite begins

## Snapshots

See [snapshots.md](./references/snapshots.md) for:

- choosing among the inline, external, file, and accessibility-tree forms
- serializers, and the format defaults a reviewer will see
- updating snapshots, and the modes the update flag accepts
- the two CI behaviors that catch an abandoned edit
- the discipline no tool enforces

## Coverage

See [coverage.md](./references/coverage.md) for:

- the two providers, which is default, and the packages v4 makes you install
- the inclusion model that quietly flatters a percentage
- thresholds as a ratchet rather than a target
- ignore hints, and the suffix without which they are stripped
- what coverage measures, and what it does not

## Performance and Parallelism

See [performance-and-parallelism.md](./references/performance-and-parallelism.md) for:

- the two axes work is spread across, and which one a slowdown lives on
- pool selection, and why the compatible default is the default
- disabling isolation — the largest win and the largest footgun
- concurrent tests, and the documented ceiling on what concurrency buys
- reading the runner's own timing buckets before changing anything
- sharding, profiling, and finding what keeps a worker alive

## Filtering and Tags

See [filtering-and-tags.md](./references/filtering-and-tags.md) for:

- narrowing by path, name, and line, and the guard against a focused test reaching CI
- declaring tags, applying them per test or per module, and filtering on expressions
- skipping expensive setup the current filter does not need
- the cost model no filter escapes
- listing what would run without running it

## Reporters and CI Output

See [reporters-and-ci.md](./references/reporters-and-ci.md) for:

- the built-in reporters and what each is for
- the agent-aware reporter, its automatic selection, and what suppresses it
- CI-facing output, annotations, and machine-readable formats
- combining reporters and routing each to its own file
- attaching context to a test that a reporter will surface

## Browser Mode

See [browser-mode.md](./references/browser-mode.md) for:

- the bug class a DOM shim cannot see, and when that justifies a real browser
- providers as installable packages, and the import path that changed in v4
- locators, the asynchronous element assertion, and driven user interaction
- rendering components, and bridging a testing-library render
- the documented limits, and separating browser suites from Node ones

## Visual Regression

See [visual-regression.md](./references/visual-regression.md) for:

- capturing and comparing a screenshot, and where references are stored
- comparator tolerances, masking, and the two limits whose stricter one wins
- why a local screenshot never matches CI's, and what actually fixes it
- the accessibility-tree alternative that does not break on a font bump
- the cost this carries, and deciding whether it is worth paying

## Type and In-Source Tests

See [types-and-in-source.md](./references/types-and-in-source.md) for:

- type-level assertions, the file convention, and the flag that runs them
- why a dynamic test name is not evaluated in a type test
- tests colocated inside a source file, and the config that discovers them
- the production-build setting without which those tests ship to users
- the scope the documentation puts on colocated tests

## Debugging and Failure Modes

See [debugging-and-failure-modes.md](./references/debugging-and-failure-modes.md) for:

- the flag combination that makes a breakpoint work, and why each part is needed
- attaching a debugger across watch reruns
- diagnosing a run that will not exit, and a log with no owner
- the documented error catalogue, its causes, and its fixes
- the pool switch that resolves a whole class of native-code failure

## Suite Hygiene

See [suite-hygiene.md](./references/suite-hygiene.md) for:

- lint rules that catch what review misses
- the guards against an abandoned edit reaching the default branch
- making hygiene configuration rather than remembered discipline
- detecting work that outlives the test that started it
- the review questions specific to this runner

## Extending Vitest

See [extending-vitest.md](./references/extending-vitest.md) for:

- custom reporters against the v4 interface, and the hooks that no longer exist
- custom environments and pools, and why almost nothing needs the latter
- driving the runner from a script instead of the CLI
- tracing a run, and the startup cost it adds
- deciding whether an extension point is warranted at all
