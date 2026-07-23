---
name: observability-guidelines
description: Tool-agnostic conventions for making software observable — the three signal types (logs, metrics, traces) plus the error handling and error tracking that make them actionable. Covers structured-logger usage and module child loggers, log-level choice, "Started / Completed" structured-log messages, try/catch placement and error propagation to the root call site, error-reporting capture calls, breadcrumbs, top-level error boundaries, trace/replay sampling, PII boundaries in telemetry, and product/usage event tracking. Names roles ("your structured logger", "your error tracker", "your analytics tool") rather than specific SDKs.
when_to_use: Use whenever writing, reviewing, or modifying code that logs, throws, catches, reports an error, tracks an event, or configures a logger, error tracker, tracing, or analytics tool — even when the request only mentions "logging", "log level", "structured logs", "capture exception", "error boundary", "breadcrumb", "trace sampling", "metrics", "analytics", "event tracking", or debugging an unhandled exception.
user-invocable: false
---

# Observability Guidelines

Apply these rules when writing, reviewing, or modifying any code that emits telemetry — logs, errors, traces, or product events — or that configures the tools those signals flow into.

The guidance is deliberately tool-agnostic. It names roles — **your structured logger**, **your error tracker** (error-reporting service), **your analytics tool** — rather than specific SDKs, and the code snippets use placeholder function names such as `logger.info(...)`, `reportError(...)`, and `trackEvent(...)` that map onto whatever your project has adopted. Substitute the concrete names when applying a rule; keep the shape.

Observability rests on three signal types — **logs**, **metrics**, and **traces** — made actionable by disciplined **error handling** and a dedicated **error tracker**. Each reference below owns one of those concerns; load the ones the change touches.

## Error Handling

See [error-handling.md](./references/error-handling.md) for:

- Where to place try-catch blocks and how errors propagate to the root call site
- Rethrowing errors that are caught only for a side effect such as logging
- Reporting caught errors before an early return, redirect, or fallback path
- Top-level error boundaries and writing actionable error messages

## Error Tracking

See [error-tracking.md](./references/error-tracking.md) for:

- Integrating an error-reporting service behind one project wrapper or init/config file
- Which failures are worth capturing and which are ordinary control flow
- Breadcrumbs, trace/replay sampling, and instrumentation boundaries
- Keeping secrets and PII out of telemetry event context

## Logging

See [logging.md](./references/logging.md) for:

- When an operation is worth logging and when it is noise
- Choosing a log level (`info` / `warn` / `debug`; `error` reserved for projects without an error tracker)
- Deriving module-scoped child loggers from one shared root logger
- Structured context objects and "Started / Completed" message conventions

## Metrics and Product Analytics

See [metrics-and-analytics.md](./references/metrics-and-analytics.md) for:

- Emitting metrics and product/usage events through one typed, centralized wrapper
- Stable event and property naming conventions
- Gating telemetry behind a runtime flag and honoring user consent
- Keeping PII and raw content out of event properties
