---
status: accepted
---

# Pin the investigator at Sonnet with medium effort, and step implementer and reviewer down to high

## Context

`context-ownership.md`
(added by [#480](https://github.com/axross/skills/issues/480)) defines an
investigator: a reader handed a large payload and asked to return a
conclusion and a locator rather than the payload itself. This repository
shipped agent definitions for the other two roles and none for that one.
Resolution still succeeds without one — a generic reader-capable agent
qualifies further down `subagent-delegation.md`'s resolution precedence — so
nothing was broken. What a project's own definition buys, and a generic
reader does not, is a pinned model and reasoning effort; without one, an
investigator runs at the main actor's cost with nothing reporting the
forfeit. That forfeit lands hardest on this role, because reading a large
payload is nearly the whole of its work: the primary benefit of delegating
an investigator — the payload never entering the main actor's context —
survives an inherited model, while the secondary benefit is exactly what an
investigator exists to maximise.

With a third role arriving, what tier each of this repository's three
subagent roles runs at became one decision rather than two: `implementer`
and `reviewer` already ran at `effort: xhigh`, and the new investigator
needed a model and effort chosen from the same comparison.

Vendor documentation was consulted 2026-08-20, across the Anthropic models
overview, the pricing page, the Effort page, and the Claude Code sub-agents
and model-configuration references:

|                                | `claude-sonnet-5`   | `claude-haiku-4-5`                   |
| ------------------------------ | ------------------- | ------------------------------------ |
| Context window                 | 1M tokens           | 200k tokens                          |
| Price, input / output per MTok | $2 / $10            | $1 / $5                              |
| `effort` support               | `low` through `max` | absent from the supported-model list |

On the Anthropic API, Claude Code's `sonnet` alias resolves to Sonnet 5 and
`haiku` to Haiku 4.5. Sonnet 5's $2/$10 price was announced at launch as
introductory through 2026-08-31; the pricing page now records it as the
standard price, with the scheduled rise to $3/$15 stated as not going to
occur. Subagent frontmatter accepts `effort` values `low`, `medium`, `high`,
`xhigh`, and `max`, and that value overrides the session's own effort level;
`high` is Claude Code's documented default on every effort-supporting model
except Opus 4.7, so writing `effort: high` is not a no-op — it pins a value
below whatever a session already runs at `xhigh` or `max`.

No evidence in this repository supports moving `implementer` or `reviewer`
off `xhigh`. The measured cost structure behind
[#477](https://github.com/axross/skills/issues/477) came from a main-actor
session, whose shape is not a worker's, and no worker has been measured.
[#478](https://github.com/axross/skills/issues/478) additionally established
that no effort value appears in any run record, so an effort change cannot
be confirmed after the fact — it can only ever be `declared`, never
`verified`, in the terms `subagent-delegation.md`'s own Model and Effort
Certainty classification uses.

## The decision

`.claude/agents/investigator.md` pins `model: sonnet` (the alias, matching
the other two definitions) with `effort: medium`.
`.claude/agents/implementer.md` and `.claude/agents/reviewer.md` move from
`effort: xhigh` to `effort: high`, on the maintainer's judgment call taken at
the clarify gate, against the evidence position above — carried out as
decided and reported throughout as `declared`, never as measured or
verified.

Sonnet 5 was chosen over Haiku 4.5 for the investigator because the
200k-token window a Haiku-based shape would impose is exactly the dimension
a role defined by being handed large payloads cannot trade away — the
ceiling bites hardest at the case the role exists for, while Sonnet 5's
window is five times larger for twice the per-token price. `medium` was
chosen over `low` because an investigator's output is a judgment the main
actor cannot check without re-reading the payload it delegated away
specifically to avoid — the saving `low` would buy is drawn from the one
quality this role has no cheap way to verify.

## What was rejected

- **`model: haiku` with no `effort` key.** Half the per-token price, and the
  cheapest shape available. Rejected: the 200k-token window bounds how large
  a payload the role can be handed, and being handed large payloads is the
  whole of the role — the ceiling bites hardest at exactly the case the role
  exists for.
- **`effort: low` for the investigator.** Vendor guidance names subagents as
  a use case for `low`. Rejected: an investigator's output is a judgment the
  main actor cannot check without re-reading the payload it delegated away,
  so the saving `low` buys is drawn from the one quality this role has no
  cheap way to verify.
- **No investigator definition, relying on a generic reader.** Resolution
  succeeds and nothing breaks. Rejected: it forfeits the model-and-effort pin
  silently, which for this role is the largest of the three forfeits a
  missing definition in this repository could produce.
- **Leaving `implementer` and `reviewer` at `xhigh`.** A legitimate outcome
  of this decision — no evidence in this repository supports moving either.
  Rejected by the maintainer's own judgment at the clarify gate, not by any
  measurement; carried out as decided and reported as `declared`.

## Consequences

Every one of this repository's three subagent roles now states a
deliberately chosen model and effort, rather than one role inheriting the
session's own settings by omission. `docs/operations/development-workflow.md`
and `docs/conventions/directory-structure.md` name and reason about all
three.

What this record does not license: it is not evidence that either move — the
investigator's shape, or the `implementer`/`reviewer` effort drop — saves
cost, or that quality holds at the lower effort on either file.
`subagent-delegation.md`'s Model and Effort Certainty section already
classifies a configured value as `declared` rather than `verified` absent
runtime confirmation, and #478 established that no effort value appears in
any run record at all, so this decision, like the ones it revises, stays
`declared` for as long as that remains true. A future change that wants a
measured answer needs a different instrument than this record or a
self-reported count — most plausibly the kind of dispatched evaluation
`docs/specs/skill-evaluation.md` already describes for a skill's own effect.
