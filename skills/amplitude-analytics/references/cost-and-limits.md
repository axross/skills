# Cost and Limits

Apply this reference when deciding whether an instrumentation change is affordable, diagnosing a bill that moved, or reviewing a change that could multiply event volume. Amplitude's pricing is driven by two different meters, and the cheapest way to learn which one your plan uses is not from an invoice.

Verified against Amplitude's documentation on **2026-07-29**. Plan structures and prices change; confirm the current terms with whoever owns the Amplitude contract rather than treating any figure here as your plan's.

## The Two Meters

| Meter                           | Counts                         |
| ------------------------------- | ------------------------------ |
| **MTU** (monthly tracked users) | Distinct users seen in a month |
| **Event volume**                | Events ingested                |

Which one prices your plan is a contract question. Amplitude also applies an **MTU guardrail**: an average of up to **1,000 events per MTU**, with excess converting into additional MTUs at plan rates. So an MTU-priced plan is not indifferent to event volume — it is indifferent only until the ratio crosses that line.

**Guidelines:**

- MUST find out which meter the project's plan prices on before making a change that multiplies either, since the same change can be free on one plan and expensive on the other.
- SHOULD estimate the events-per-user ratio a new instrumentation adds, because the MTU guardrail converts a high ratio into MTU cost even on an MTU-priced plan.

## What Counts and What Does Not

Verified as of the date above:

**Does not count toward event volume:**

- `Identify` and `Group Identify` calls
- Blocked and deleted events
- Events from blocked user ids or device ids
- `[Experiment] Exposure` and `[Experiment] Assignment` events

**Does count:**

- Hidden events — hiding affects the UI, not ingestion
- Backfilled events
- Autocaptured events, exactly like hand-written ones
- A **custom** event used in place of the built-in exposure event

**Guidelines:**

- MUST NOT expect hiding an event to reduce its cost; hidden events still count and hiding is a display control.
- SHOULD use the built-in `[Experiment] Exposure` event rather than a custom substitute, because the built-in one is excluded from volume and MTU and a custom one is not.
- MUST use blocking rather than hiding when the goal is to stop an event from counting, and understand that blocking discards the data rather than shelving it.
- SHOULD account for autocapture in a volume estimate; `elementInteractions` in particular can exceed the hand-written event volume of an entire application.

## Unlinked Devices Inflate MTU

Every device that has not been linked to a user id is its own tracked user. A product where users browse anonymously before signing in therefore counts more MTUs than it has people — and when those users do log in, Amplitude's backend merge collapses them, which can make MTU appear to _drop_ after an instrumentation fix.

**Guidelines:**

- MUST set the user id as early as authentication allows, since every unlinked device is a separately-counted MTU until it is linked.
- SHOULD expect MTU to fall after fixing identity, and MUST NOT read that fall as a loss of users.
- MUST NOT create identity churn — a `reset()` on every launch, or an unpersisted device id — because each churn event mints a new tracked user.

## What a Runaway Release Costs

The expensive failures are structural, not gradual. An event emitted in a render path, a retry loop without an `insert_id`, or an event name templated with an identifier can multiply volume by orders of magnitude between a release and the moment somebody notices.

> An event in a component that re-renders on scroll does not add a percentage to event volume. It adds a multiple.

**Guidelines:**

- MUST NOT emit an event from a render path, an effect that re-runs, or a polling loop; emit where the fact becomes true, once.
- MUST set an `insert_id` on retryable server-side events so a retry storm deduplicates rather than multiplying.
- SHOULD configure volume alert thresholds in Amplitude so a runaway release surfaces within hours rather than at the invoice.
- SHOULD review any new instrumentation for its per-user event count before release, since that ratio is what the MTU guardrail meters.

## Scale and Sampling

Amplitude offers dynamic behavioural sampling on its higher tiers. The trade it makes is explicit: adopting it **forfeits MTU-based pricing**. That is a contract decision, not an engineering one.

**Guidelines:**

- MUST NOT enable behavioural sampling as an engineering cost optimisation; it changes the pricing basis and belongs to whoever owns the contract.
- SHOULD reduce volume by fixing over-emission at the source before considering any sampling mechanism, because sampled data answers fewer questions.
