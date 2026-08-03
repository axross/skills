# Experiment Interface

Apply this reference when an application reads a feature flag or an experiment variant from Amplitude, or when experiment data appears in the analytics project and someone needs to know where it came from. This file covers the **interface** — the events, the user property, the evaluation modes, and the cost treatment. Designing an experiment, sizing it, and reading its results are a different discipline and belong to an experimentation capability, not here.

Verified against [Amplitude Experiment's documentation](https://amplitude.com/docs/feature-experiment) on **2026-08-02**.

## The Two Events

Amplitude Experiment emits two events with exact bracketed names, documented in [Amplitude's Experiment documentation](https://amplitude.com/docs/feature-experiment): `[Experiment] Assignment`, when a variant was assigned to a user, and `[Experiment] Exposure`, when the user was actually exposed to it.

**`[Experiment] Exposure` is the one analysis runs on.** It determines which variant a participant experienced and powers the core analysis queries. Assignment records that a bucket was chosen; exposure records that it mattered.

The distinction is the difference between a correct result and a diluted one. Assigning a variant to every user who loads the app, when only a fraction reach the changed surface, dilutes the measured effect across people who never saw it.

**Guidelines:**

- MUST use `[Experiment] Exposure` as the exposure event for analysis rather than assignment, since assignment counts users who may never have encountered the variant.
- MUST NOT fire exposure on assignment; exposure belongs at the point the user actually encounters the variant-dependent surface.
- MUST NOT hand-write an event that duplicates either built-in event, because the built-in ones are excluded from billing and a custom substitute is not.

## The User Property

Each flag produces a user property named `[Experiment] <flag_key>`, whose value is the assigned variant key. That is what lets any non-experiment event be segmented by variant.

Amplitude supports **up to 1,500 experiment user properties per project** — a real ceiling for an organization that runs many flags and never retires them.

**Guidelines:**

- MUST retire flags and their properties once an experiment concludes, since the 1,500-property ceiling is per project and accumulates across every flag ever run.
- SHOULD segment ordinary product events by the `[Experiment] <flag_key>` property rather than duplicating variant information onto each event's own properties.

## Cost Treatment

> _"Exposure (`[Experiment] Exposure`) and assignment (`[Experiment] Assignment`) events don't count toward your organization's event volume or Monthly Tracked Users (MTU)."_

Custom events used in their place **do** count. This makes rolling your own exposure event a decision with a bill attached.

**Guidelines:**

- MUST NOT replace the built-in exposure event with a custom one for convenience; the built-in is free of volume and MTU and the custom one is not.
- SHOULD account for exposure being billing-exempt when comparing the cost of experimentation against other instrumentation.

## Local Versus Remote Evaluation

| Mode       | Where the decision happens                   | Trade                                                        |
| ---------- | -------------------------------------------- | ------------------------------------------------------------ |
| **Remote** | Amplitude's servers, fetched by the client   | Full targeting; a network round trip on the path             |
| **Local**  | In-process, against a downloaded flag config | No round trip; the targeting a local config can express only |

**Guidelines:**

- SHOULD use local evaluation where the latency of a fetch would be visible to the user or would gate a first render.
- MUST verify a targeting rule is supported by local evaluation before relying on it there, since local evaluation cannot express every remote rule.
- MUST have a defined default variant for the case where evaluation has not resolved, and MUST NOT block a render on a flag fetch without one.

## Where This Stops

This reference covers wiring. It does not cover experiment design, sample sizing, sequential testing, correction for multiple comparisons, or reading a result — all of which Amplitude documents and all of which belong to an experimentation discipline rather than to instrumentation.

**Guidelines:**

- MUST NOT infer an experiment's outcome from the instrumentation alone; whether a difference is real is a statistical question this reference does not answer.
- SHOULD hand experiment design and analysis to whoever owns experimentation, and keep this skill's involvement to emitting exposure correctly.
