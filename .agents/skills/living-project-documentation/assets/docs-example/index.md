---
okf_version: "0.3"
title: Scheduler engineering
description: Job execution, notification delivery and operating procedures for Scheduler.
---

# Documentation

Start with the [Scheduler glossary](./glossary.md) for the terms used in job
execution, notifications and release procedures.

## Specifications

- [Scheduling](./specs/scheduling.md) — job creation, retry timing, terminal states and output retention.
- [Job dispatch](./specs/dispatch.md) — how timers and API requests hand work to a bounded worker pool.
- [Notifications](./specs/notifications.md) — how terminal job outcomes reach channels, immediately or in a digest.

## Conventions

- [Directory structure](./conventions/directory-structure.md) — module placement, import direction and route naming for the API and worker.

## Operations

- [Deployment](./operations/deployment.md) — how the release operator migrates the schema, deploys, verifies and rolls back Scheduler.
