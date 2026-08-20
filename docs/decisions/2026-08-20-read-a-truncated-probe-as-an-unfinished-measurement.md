---
status: accepted
---

# Read a truncated probe as an unfinished measurement

## Context

[#441](https://github.com/axross/skills/issues/441) asked whether the turn cap
is doing what it was put there to do, having stopped three of the five probes
of [run 31981990871](https://github.com/axross/skills/actions/runs/31981990871)
— the only real measurement this instrument has taken. It named three readings
consistent with that outcome and refused to pick between them: the cap is set
too low, those three probes ran away, or the cap is the wrong instrument
altogether. It also named what would distinguish them cheaply — the transcripts
themselves, retained until 2026-08-24.

They were re-read on 2026-08-20, from the five stored probe artifacts of that
run under measurement directory
`give-the-empty-post-list-a-real-empty-state-66b9a99c`. Every figure below
comes from a `metadata.json` or a `transcript.jsonl` in them.

**None of the three truncated probes was running away.** Each finished editing
the two files the task was about early, and spent the rest of its budget trying
to **look at what it had changed** — installing dependencies, installing
Chromium, starting the API and Vite dev servers, putting the database into
the empty state the task describes, screenshotting the page, and diagnosing why the frontend's requests returned
nothing. `skill-absent-2` traced the request path through `server/app.ts`,
`vite.config.ts`, and `src/lib/api.ts`, then restarted the dev server on three
different ports. `skill-present-1` wrote its own `test-api-server.ts` to serve
the route the dev server would not proxy. `skill-present-3` reached the same
diagnosis and edited `vite.config.ts` to add the missing proxy. The repetition
in those stretches is retry-with-variation against a real fault in the
workspace, not a probe grinding on a check that had already passed.

| Probe             | assistant events | `metadata.turns` | tool calls | last edit to a target file | first browser-verification step             | ended                                          |
| ----------------- | ---------------- | ---------------- | ---------- | -------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `skill-absent-2`  | **100**          | 61               | 59         | event 18                   | event 30, `npx playwright install chromium` | killed running `prettier --write`              |
| `skill-absent-3`  | 36               | 21               | 20         | event 20                   | none                                        | cleanly                                        |
| `skill-present-1` | **100**          | 65               | 61         | event 22                   | event 31, the `run` skill                   | killed running `prettier --check`              |
| `skill-present-2` | 41               | 26               | 24         | event 26                   | none                                        | cleanly                                        |
| `skill-present-3` | **100**          | 63               | 60         | event 24                   | event 34, `npx playwright install chromium` | killed after `git diff --stat`, before cleanup |

**The two probes that finished are the two that never looked.** `skill-absent-3`
and `skill-present-2` went from the edit to `typecheck`, `lint`, and the test
suite and stopped there; neither started a server or took a screenshot. So the
cap did not fall where work happened to be long. It fell on the probes that
tried to verify a visual change visually, on a scenario whose whole subject is
a visual change.

**What consumed the turns is the workspace, not the model.** Three faults, each
paid for by every probe that attempted visual verification: the probe workspace
carries no `node_modules`, so a probe spends an `npm install` that then dirties
`package-lock.json` and has to be reverted; it carries no Chromium, so a probe
spends `npx playwright install chromium`; and the mock's frontend requests a
path the Vite dev server does not proxy to the API, which cost each of the three
between 20 and 40 assistant events to diagnose.

**The cap and the recorded `turns` are different quantities.** `probe-process.mjs`
counts lines of the CLI's stream-json output whose `type` is `"assistant"`.
`transcript/parse.mjs` records the `num_turns` the CLI's own `result` event
reports. Across these five probes the first ran 1.54 to 1.71 times the second,
so a reader checking a stored `turns` of 61 against a cap of 100 concludes a
probe stopped well short of a limit that had in fact just killed it.

**#441's cost figures are close but not exact**, and the stored ones are used
here instead. `metadata.costUsd` records 1.3247531, 1.4971047 and 1.5642363 for
the truncated probes against 0.436764 and 0.5053462 for the two that finished.
The shape of the comparison — roughly three times the spend for a probe that
stores less — survives the correction.

## The decision

**A probe the turn cap truncates is read as an unfinished measurement, not as a
runaway.** The guard's own premise — that a probe reaching the cap was doing
something a measurement is better off without — is not what the one measurement
taken so far shows, and a truncated record is treated accordingly: as a probe
stopped mid-task, whose stored remains under-describe what it did.

This settles what #441 asked and nothing beyond it. What the cap should
be, whether it should keep killing on a turn count at all, and whether
`--max-budget-usd` should replace it are open, and this record does not
prejudge them: it establishes what a truncation currently means, which is what
any argument about the mechanism has to start from.

## What was rejected

**Reading the three as runaways.** This is the reading the cap was designed
around, and the transcripts contradict it. A runaway repeats an action whose
outcome it already has; these three pursued a diagnosis, changed approach on
each failure, and were cleaning up when they were killed.

**Reading the cap as merely set too low.** True as far as it goes, and
misleading as a conclusion: it points at the number, and the number is the
smaller half. Roughly 40 to 50 events per truncated probe went to friction the
workspace could remove, so a cap raised without removing it buys an `npm install`
and a Chromium download.

**Deciding the cap's replacement here.** #441 holds the `how` out of scope
until the question is settled, and the evidence supports more than one answer —
a dollar bound would have cut these three at a comparable place, and so would a
workspace that did not cost them 40 events. Settling the mechanism on this
evidence in the same breath as settling the reading would smuggle a design
choice through as a finding.

**Generalizing from these three to the instrument as a whole.** One scenario,
one task, five probes. What is established is what truncation did here, which
is enough to constrain how a truncated record is read and not enough to claim a
rate.

## Consequences

**A truncated probe's stored record is not evidence about the skill under
test.** Its final message is absent — the `result` event carries no text — and
what remains is a mid-task fragment. A factor that reads what the agent
concluded has nothing to read in such a probe, which is the constraint
[#427](https://github.com/axross/skills/issues/427) already hit and
[#439](https://github.com/axross/skills/issues/439) records the rest of.

**A truncated probe's artifact can carry scaffolding it never got to revert.**
`skill-present-3` was killed before its cleanup ran, so its stored
`changes.patch` holds `vite.config.ts` and `package-lock.json` beside the two
files the task was about — the proxy it added to see the page, and the lockfile
its `npm install` moved. An `outcome` factor reading that diff reads the
truncation rather than the skill, and a factor asserting that nothing outside
the task's own files changed would fail a probe that intended to change nothing
outside them.

**Truncation selects against visual verification.** It removes the probes that
went furthest to check their own work, which is not a neutral loss on a
scenario about appearance: the surviving records are systematically the ones
that never looked. A measurement of such a scenario containing truncated probes
is a fact about the cap before it is a fact about the skill, and reads that way
until the cap question is answered.

**Removing the friction is a separate change from moving the cap, and neither
is scheduled here.** The three faults named above are the workspace's, and no
issue carries them today; this record is where they are written down.
