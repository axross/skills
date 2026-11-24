---
type: Architecture
title: Job dispatch
description: How timers and API requests hand work to a bounded worker pool.
---

# Job dispatch

The API records a run in the queue. The scheduler takes the same path when a
timer fires. A fixed worker pool claims queued jobs and runs attempts. The
pool size bounds concurrent execution across all templates. Claims are
idempotent so a repeated delivery cannot start a second copy of a job.

Running work on the timer thread once let forty templates sharing a 09:00
schedule exhaust the database connection pool. Throttling one timer leaves
other producers free to start work, and a per-template cap still allows all
forty templates to start together. Counting slots where all work converges
bounds the resource that ran out.

For the states that callers observe while waiting for a slot or retry, see
[Scheduling](./scheduling.md#states).
