# Documentation

This repository's own documentation, alongside its README. Which body answers
which question: **what does this library measure, and why?** → `specs/`.
**What must a change satisfy?** → `conventions/`. **How is something run or
released?** → `operations/`. `decisions/` sits beside all three and holds why
a constraint exists, for the constraints whose reasoning cannot be recovered
from the code. The vocabulary all four bodies use is in
[glossary.md](./glossary.md).

Documents under `conventions/` and `operations/` use MUST, MUST NOT, SHOULD,
SHOULD NOT, and MAY as [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html)
describes. `specs/skill-evaluation.md` describes rather than instructs, and
uses none of them.

## Specifications

- [specs/skill-evaluation.md](./specs/skill-evaluation.md) — what it means to
  measure whether a skill works, and the evaluation scenario it describes,
  run under two conditions and checked across three phases.

## Conventions

- [conventions/directory-structure.md](./conventions/directory-structure.md)
  — where a skill's files live, the two skill tiers, where a validator or an
  agent definition belongs, and the layout of the evaluation subsystem under
  `tools/evaluation/`.
- [conventions/verification-gates.md](./conventions/verification-gates.md) —
  what makes a check a gate, a report, or a scheduled audit, and the traps
  each can fall into.
- [conventions/marked-counts.md](./conventions/marked-counts.md) — the
  `count:` marker that ties a number in prose to the file it describes.
- [conventions/skill-portability.md](./conventions/skill-portability.md) —
  what a distributable skill may not contain here, and the dependencies whose
  docs are consulted before a change.

## Operations

- [operations/development-workflow.md](./operations/development-workflow.md)
  — how a change gets from a stated intent to a merged pull request.
- [operations/agent-skills.md](./operations/agent-skills.md) — installing and
  refreshing a skill, and confirming both hosts loaded it.
- [operations/agent-sessions.md](./operations/agent-sessions.md) — how a
  session starts here, its hooks, and its telemetry tagging.
- [operations/code-review.md](./operations/code-review.md) — running
  `@claude review` on a pull request.
- [operations/evaluation-dispatch.md](./operations/evaluation-dispatch.md) —
  running the two evaluation instruments against this repository.

## Decisions

- [decisions/](./decisions) — why a constraint exists, and what was traded
  away. Each record is named for the decision it holds and dated the day it
  was made; a decision is replaced by a new record rather than by editing the
  old one.

For what this library is, how to install a skill, and how to operate this
repository day to day, see [`README.md`](../README.md).
