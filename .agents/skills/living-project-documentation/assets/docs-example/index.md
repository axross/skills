---
okf_version: "0.3"
title: Scheduler engineering
description: Job execution, notification delivery and operating procedures for Scheduler.
---

# Scheduler engineering

## Running a job

- [Scheduler glossary](./glossary.md) — terms used for scheduled work, notifications and packages.
- [Scheduling](./specs/scheduling.md) — job creation, retry timing, terminal states and output retention.
- [Job dispatch](./specs/dispatch.md) — how timers and API requests hand work to a bounded worker pool.
- [Notifications](./specs/notifications.md) — how terminal job outcomes reach channels, immediately or in a digest.

## Working on Scheduler

- [Directory structure](./conventions/directory-structure.md) — module placement, import direction and route naming for the API and worker.
- [Deployment](./operations/deployment.md) — how the release operator migrates the schema, deploys, verifies and rolls back Scheduler.
