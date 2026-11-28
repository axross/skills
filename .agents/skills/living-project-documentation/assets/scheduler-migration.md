# Migrating the Scheduler handbook

“Please migrate the Scheduler engineering docs to OKF.” The example follows
the job outcomes, notification rules and release procedure through that change.
The trees show the paths involved. The [finished bundle](./docs-example/index.md)
also covers job creation, worker dispatch and contribution practices.

## Before

```text
docs/
├── index.md
├── specs/
│   └── jobs.md
└── guides/
    └── handbook.md
```

The root offered **Specifications → Jobs** and **Guides → Handbook**.
Starting there, a new API client author asking “Can a cancelled job run
again if it still has retries?” had to guess the document type.
`specs/jobs.md#states` listed `cancelled` among the possible states.
Its retry section said “A failed job may be retried three times.” Neither
section answered the cancellation question.

The handbook mixed three decisions.

- **Notifications.** “A rule fires on a terminal state. Check the job states
  to decide which outcomes qualify.” Its link pointed to `../specs/jobs.md#states`.
- **Checking a release.** “Watch the claim rate for five minutes. Jobs
  waiting for a retry appear as queued. A job gets three tries in all.”
- **Undoing a release.** “Use the recorded previous revision. If a destructive
  contract migration already removed data, stop and hand the restore to
  on-call. Otherwise run `npm run deploy -- --revision <previous>`.”

## Target and evidence

Adding links to the handbook headings would shorten the operator's route.
It would still leave the API contract divided between the Jobs specification
and a release check. Changing the retry budget would require finding both
accounts. A subject entry for scheduling can give client authors the job
contract, while the operator can change the release check independently.

The illustrative checkout's adopted decision defines when retries end.
The worker's transition table dispatches retries only on failure. The
cancellation test exercises the case where two retries remain. The
[exported state contract](./docs-example/scheduling/outcomes.md#states)
links the relevant decision and test excerpts so a reader can check exactly
what was decided and what the test observes.

| Legacy passage or question                        | Destination and reason                                                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Jobs / States and the missing cancellation answer | Move the state contract to Scheduling / Job outcomes. Add what happens on cancellation with retries left from the adopted decision.                                                                    |
| Jobs / Retries and Handbook / Checking a release  | Consolidate the conflicting counts at Job outcomes. Extract the public `queued` behavior from the runbook. Keep the five-minute claim-rate check in Deployment and link directly to the retry passage. |
| Handbook / Notifications                          | Move the rules to Notifications. Keep the decision to send a message here and point its state lookup directly to Job outcomes.                                                                         |
| Handbook / Undoing a release                      | Keep the rollback command, its authority and the stop/restore branch together in Deployment. An operator about to redeploy needs all three.                                                            |

One client question remains open. How long after cancellation can an external
process keep writing? The transition test observes the job state and retry
queue. It measures no process shutdown time, and the adopted decision gives
no deadline. Record that clients cannot choose an output-read timeout from
this evidence. Leave the deadline out of the contract.

## After

```text
docs/
├── index.md
├── scheduling/
│   ├── index.md
│   ├── jobs.md
│   ├── outcomes.md
│   ├── attempts.md
│   └── dispatch.md
├── notifications.md
└── operating/
    └── deployment.md
```

Replay the client's question from the [revised root](./docs-example/index.md).
**Scheduling → Which job states are terminal?** lands on “A cancelled job
receives no automatic retry, even if retries remain.” Someone starting at the
glossary with the dashboard term “Retries remaining” reaches the retry contract.
[Scheduling index](./docs-example/scheduling/index.md) · [Owning state contract](./docs-example/scheduling/outcomes.md#states) · [Dashboard term](./docs-example/glossary.md)

Start again with the handbook’s original question about which outcomes
can trigger a notification rule. A link relabeled “configure a channel” could resolve and
still lose that question. The edited [notification rule](./docs-example/notifications.md#rules)
links directly to the state contract, where the reader can check cancellation
with retries left. [Verifying a release](./docs-example/operating/deployment.md#verifying-a-release)
links to the retry passage and tells the operator when to check the claim rate.

Walk [Rolling back](./docs-example/operating/deployment.md#rolling-back) twice.
With the data intact and the previous revision compatible, the release operator
can roll the code back. With data already removed, the operator stops and hands
the restore to on-call. Offering the same deploy command as a fallback in the
second case would leave the data missing. Removing it from both cases would
lose the supported code rollback.

Try placing a neighboring contract about the state a client sees while a
job waits for its first worker. Scheduling owns the state returned to the
client. Notifications owns whether a recipient is told about it. Two entry
points route contributors to that [placement rule](./docs-example/contributing/documentation.md#choose-a-subject).

| Project entry | Edited instruction                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `README.md`   | `When contributing docs, [choose the owning subject](./docs/contributing/documentation.md#choose-a-subject).`          |
| `AGENTS.md`   | `Before adding a contract, consult the [placement convention](./docs/contributing/documentation.md#choose-a-subject).` |

In this example the published bookmark `index.md#specifications` is
supported. The [retained heading](./docs-example/index.md#specifications)
links to the subject owners. The project approved retiring the two internal
legacy page paths after switching their editable callers. Record those path
decisions alongside the change. The work record marks job outcomes,
notifications and release operations covered, with the shutdown-time
question unresolved. Job creation and dispatch still need their own reader
checks before the whole collection can be reported as migrated.
