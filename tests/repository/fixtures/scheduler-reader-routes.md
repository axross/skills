# Scheduler reader routes

These traces compare the distributed example at
[b7595b3](https://github.com/axross/skills/tree/b7595b3f93c7569cfc312edd7ad10f7801c676f6/skills/living-project-documentation)
with the [current bundle](../../../skills/living-project-documentation/assets/docs-example/index.md).
Paths below are relative to the example bundle unless the starting point is
the skill entry. A reader can stop at the last section shown.

| Reader and decision                                                            | Before (pages and sections opened)                                                            | After (pages and sections opened)                                                                | Answer and boundary                                                                                                                                        |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| From the root, will a failed job run again?                                    | `index.md#specifications` → `specs/scheduling.md#attempts-and-retries`                        | `index.md#documentation` → `scheduling/index.md` → `scheduling/outcomes.md#attempts-and-retries` | The job queues for another attempt while retries remain. At exhaustion it ends failed with the last exit status.                                           |
| From the scheduling subject, will a failed job run again?                      | The flat index had no subject index.                                                          | `scheduling/index.md` → `scheduling/outcomes.md#attempts-and-retries`                            | The same outcome and exhaustion condition are discoverable without returning to the root.                                                                  |
| From a notification rule, does one failed attempt send a message?              | `specs/notifications.md#rules` → `specs/scheduling.md` → States on that page                  | `notifications.md#rules` → `scheduling/outcomes.md#states`                                       | Only a matching terminal outcome fires the rule. A failed attempt with a retry remaining returns to the queue.                                             |
| From the skill's worked example, is code rollback safe after a failed release? | `SKILL.md` → `index.md` → Operations → `operations/deployment.md` → Rolling back on that page | `SKILL.md` → `operating/deployment.md#rolling-back`                                              | Use the previous compatible revision and leave the schema in place. If the contract migration removed data, stop and hand recovery to on-call for restore. |

The rollback comparison starts at the actual skill link in each revision.
Both routes supply the stop condition. The direct link skips the Scheduler
index, which also covers jobs, notifications and contributor conventions.
Within the standalone export, the root's Operations bookmark reaches the
same rollback decision without consulting the skill.

For the dashboard label **Retries remaining**, start at `glossary.md`. For a
release-health investigation, start at `operating/deployment.md#verifying-a-release`.
Both link directly to `scheduling/outcomes.md#attempts-and-retries`. A reader
can stop there after learning that the job can be queued while awaiting a
retry and that an exhausted job ends failed.

From the scheduling index, follow the run question to **Creating a job**. A
manual or scheduled run returns one queued job. A repeated worker claim cannot
start another copy. For historical output, both the subject index and the
glossary point to **Output and pruning**. The job output link survives pruning,
while earlier attempts’ output expires with the record. Readers investigating
an earlier failure can stop at that exception.

## What to reject in editorial review

- Change the notification link to the existing `#attempt-budget` in
  `scheduling/attempts.md`. It explains counting, but leaves the notification
  reader without the terminal states and transition back to the queue.
- Move both outcomes links from `scheduling/index.md` to the root and leave
  the subject index without a retry route. Root reachability still passes.
  A reader starting in Scheduling cannot select the retry contract there.
- Route the skill's rollback example through the root again. The answer still
  exists, but the caller has to reopen an unrelated overview. Linking directly
  to the deploy command would also fail if the reader missed the restore case.

## Glossary migration

The old scheduling group covered **Job Template**, **Schedule**, **Job**,
**Attempt** and **Job output**. Template identity, UTC recurrence, manual
runs and output retention belong with job creation and history. Counting
belongs with the attempt Definition. The outcome and retry contract owns
the consequences of the last attempt. The short Run and Job output entries
point to the owning sections.

The old notification group covered **Notification Rule**, its account scope,
**Channel**, channel multiplicity, and **Digest**, including its interval.
These distinctions now live under Rules, Channels and Digests in the
notification contract. The former development term **Package** and the reason
the API and worker cannot import each other live with directory structure.
