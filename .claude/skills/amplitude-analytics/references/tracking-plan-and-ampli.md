# Tracking Plan and Ampli

Apply this reference when the project governs its taxonomy in Amplitude Data, or when deciding whether to generate a typed wrapper with Ampli instead of writing one. The tracking plan is where an organization's event definitions live; Ampli is the code generator that turns them into a typed client. Neither is mandatory, and choosing to skip both is legitimate — but it should be a decision rather than an omission.

None of the three inspected repositories uses a tracking plan or Ampli. All three hand-wrote a wrapper, and two of them drifted in naming as a direct result.

Verified against Amplitude's documentation on **2026-07-29**. Amplitude Data's governance surfaces move more than the SDK's; where this file says to look something up, look it up rather than trusting a remembered menu.

## What the Tracking Plan Holds

A tracking plan is organised around **sources** — an SDK integration, a server, a warehouse import — with events and properties defined against them, each carrying metadata, a type, and rules. Ampli generates a wrapper for a source, so events must be assigned to one before it can.

What an event should be called is owned by the naming section of a vendor-neutral product-event capability, and this file does not restate it. Amplitude adds exactly one thing to that: its documentation prescribes **Title Case**, which is the dimension the neutral rule deliberately leaves to the project. Adopt it or override it in writing — but pick one, because the plan is the artifact that has to hold it.

The Amplitude-specific hazard is not a badly-named event; it is two conventions arriving in one project.

> **Found across `axross/oraculo` and `axross/porousel`**: Title Case in one, kebab-case in the other, for the same kind of event. One project per convention is survivable; two conventions in one Amplitude project is not — Amplitude distinguishes names that differ only in case, so the two never merge into one series.

**Guidelines:**

- MUST assign events to a source before expecting Ampli to generate anything for them.
- SHOULD write the plan's naming convention down in the repository as well as in Amplitude, since the repository is where the next engineer looks.
- MUST apply one casing convention across every source feeding a project, because Amplitude treats names differing only in case as different events and no later transformation merges their history cleanly.

## Branches, Publishing, and Versions

Amplitude Data supports branching and publishing, which maps onto Git in the obvious way: a plan branch alongside a code branch, published when the code merges.

**Guidelines:**

- SHOULD open a tracking-plan branch alongside the code branch that implements it, so the definition and the emitter land together.
- MUST publish the plan branch when the implementing code merges, or the running code emits events the plan does not describe.
- SHOULD look up the current branch, publish, and merge workflow in Amplitude's documentation before scripting against it, since these surfaces change more often than the SDK's.

## Observe and Schema Settings

Amplitude Data reports on how instrumentation actually behaves — which planned events are arriving, which are not, and which unplanned ones showed up. Schema settings decide what happens to data that violates the plan: broadly, a violation can be recorded and surfaced, or rejected at ingestion.

Two properties of this are worth knowing regardless of the current menu:

- **Observe cannot see what never arrives.** Data filtered upstream — blocked at a proxy, dropped by a plugin, suppressed by consent — is invisible to it. A clean report is not proof of complete instrumentation.
- **Rejecting is destructive.** A rejected event is not stored, so a mistakenly strict rule loses data permanently rather than flagging it.

**Guidelines:**

- MUST NOT read a clean Observe report as proof that instrumentation is complete; it cannot see events that were filtered before ingestion.
- SHOULD prefer marking violations over rejecting them until the plan is known to match reality, because rejection discards data that cannot be recovered.
- MUST look up the current violation classes and their available actions in Amplitude's own settings before relying on a specific enforcement behaviour.
- SHOULD treat an inactive planned event as an instrumentation gap to investigate rather than a definition to delete, since the emitting code may simply be unreachable.

## Ampli

Ampli generates a typed wrapper from the tracking plan, so event names and property types are enforced at compile time rather than by convention.

| Command           | Does                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ampli pull`      | Downloads the generated wrapper for a source, optionally to a given `--path`                                          |
| `ampli status`    | Scans the source tree, reports how many times each event is tracked, and errors when planned events are unimplemented |
| `ampli configure` | Changes the source's platform, language, or SDK                                                                       |

`ampli.json` and the generated wrapper are both committed.

`ampli status` is the interesting one: it is a **coverage check** that can run in CI, turning "we planned it but never shipped it" from a discovery into a build failure.

**Guidelines:**

- MUST commit `ampli.json` and the generated wrapper, since the generated code is what the application imports.
- MUST NOT hand-edit generated Ampli output; the next `ampli pull` discards it.
- SHOULD run `ampli status` in CI to fail the build when a planned event has no implementation.
- MUST look up the current CI authentication mechanism and any branch-workflow flags in Amplitude's Ampli documentation rather than assuming; these are the parts of the tooling that move.

## When a Hand-Written Wrapper Is the Better Trade

Ampli buys type safety and coverage checking at the cost of a generator, a credential in CI, and a plan that must stay authoritative. For a small application with a handful of events and one engineer, a hand-written typed wrapper delivers most of the benefit with none of the machinery — which is what all three inspected repositories chose, defensibly.

What they did not do is the part that matters: keep the schema. `axross/oraculo` has a typed `Event` map; `axross/porousel` has the same wrapper **minus the schema**, and its naming drifted immediately.

**Guidelines:**

- SHOULD hand-write a typed wrapper for a small, single-team application, and MUST keep a closed event schema in it — the schema is what prevents drift, not the generator.
- SHOULD adopt Ampli when several teams emit into one taxonomy, where a shared plan is the only thing keeping names consistent.
- MUST NOT ship a wrapper with no schema at all; an untyped `trackEvent(name, props)` is a naming convention enforced by nothing.
