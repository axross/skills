---
status: accepted
---

# Measure agent-conduct skills by discovery alone

## Context

[#427](https://github.com/axross/skills/issues/427) asked, as its slice **T4**,
whether `tsuzuri`'s two agent-conduct skills — `loop-engineering` and
`professional-behavior`, skills that govern how an agent works rather than
what it builds — can be measured by this instrument at all. Answering that
came before writing either scenario. The answer was read from the harness,
the mock, and the five stored probe artifacts of
[run 31981990871](https://github.com/axross/skills/actions/runs/31981990871),
downloaded on 2026-08-17 while still retained (they expire 2026-08-24), under
measurement directory `give-the-empty-post-list-a-real-empty-state-66b9a99c`.

**The harness countermands `loop-engineering`'s gate before the skill is
loaded.** `tools/evaluation/src/probe-process.mjs` sets `ALLOWED_TOOLS` to
`Bash, Edit, Glob, Grep, Read, Skill, TodoWrite, Write` and `DISALLOWED_TOOLS`
to `Agent, NotebookEdit, Task, WebFetch, WebSearch`, and appends
`NONINTERACTIVE_BRIEF` to every probe's system prompt in **both** conditions.
That brief says, verbatim, that a question is a dead end, that the probe
should decide for itself, and that it should "say in your final message what
you decided and why." `loop-engineering`'s plan-approval gate is instructed
against before the skill is even read.

**The mock already states the one convention an `outcome` or `transcript`
factor might have asserted.** `tools/evaluation/mocks/tsuzuri/AGENTS.md`
carries a section headed "How changes are made", in the project's own voice:

> Nothing lands on the main branch directly. A change starts as a pull
> request, and before the implementation exists, the plan for it does — write
> down what you intend to change and why, and get that plan agreed on before
> writing code against it.

It goes on to require review by someone other than the author and to require
a change be kept in scope. The mock's own `AGENTS.md` is in the workspace of
both conditions regardless of `harness.agentsMd` (#417), so a factor
asserting that the agent planned before coding on `tsuzuri` would be
asserting a **fixture confounder** — a convention the mock already
demonstrates to the control arm — independently of the harness brief above.

**The stored transcript carries no reasoning to read** ([#439](https://github.com/axross/skills/issues/439)).
All 99 `thinking` blocks across the five probes carry `"thinking": ""` and a
signature alone; a `transcript`-phase factor would be handed the surviving
assistant `text` blocks and tool calls instead — under 2.4 KB of terse
narration per probe — which is not reasoning to judge against.

**Three of five probes stored no final message at all.** Each ran to 100
assistant turns and was killed by the instrument's own turn cap
(`cliExitCode: 143`, `truncated: true`, result subtype
`error_during_execution`), against the other two finishing cleanly in 21 and
26 turns ([#441](https://github.com/axross/skills/issues/441)). A factor
reading what the probe said at the end has no material in the majority of
this run's probes.

| Probe             | assistant text | thinking blocks | first `Edit`/`Write` | ended                      |
| ----------------- | -------------- | --------------- | -------------------- | -------------------------- |
| `skill-absent-2`  | 2,379 chars    | 24, all empty   | tool call 5          | turn cap, no final message |
| `skill-absent-3`  | 1,495 chars    | 10, all empty   | tool call 9          | cleanly                    |
| `skill-present-1` | 1,272 chars    | 27, all empty   | tool call 11         | turn cap, no final message |
| `skill-present-2` | 936 chars      | 9, all empty    | tool call 14         | cleanly                    |
| `skill-present-3` | 1,132 chars    | 29, all empty   | tool call 12         | turn cap, no final message |

**A control-arm probe already performed `professional-behavior`'s reporting
discipline, unaided.** `skill-absent-3` — the skill **not** installed —
closed with: "No 'create post' CTA was added since that flow doesn't exist
anywhere in the app yet (confirmed via `App.tsx` routes) — adding one would
be a separate feature, not a visual fix. Verified with `npm run typecheck`,
`npm run lint`, `npm test` … and `vite build`." That is verified separated
from assumed, a decision stated with its reason, in the arm that is supposed
to lack the skill.

**No probe planned before editing, and none could have written a TODO list.**
Every probe went from `Read`/`Bash` reconnaissance straight to `Edit`, at the
tool-call positions in the table above, and none left a plan artifact behind.
`TodoWrite` was never called because the CLI does not expose it: the
`system init` event's own `tools` list carries no such tool, while it does
carry several `ALLOWED_TOOLS` never names — `skill-present-1` used
`ToolSearch` ([#440](https://github.com/axross/skills/issues/440)).

## The decision

**A skill that governs how an agent works, rather than what it builds, is
measurable by this instrument's `discovery` phase alone — and only where a
peer set genuinely competes for the same prompt.** This is a rule, not an
account of two instances: the same test applies to any future agent-conduct
skill this library adds, not only to the two on the table here.

`loop-engineering` clears the bar. Its own trigger is a free-form change
request, and three peer skills plausibly answer the exact same request —
`product-requirement-document-authoring` reading it as an under-specified
feature needing a spec, `software-development` reading it as an ordinary
change to make, `next-app-development` reading it as routing and rendering
work in a Next.js app. Whether an agent reaches for `loop-engineering` ahead
of those three, from the shape of an open-ended request alone, is a real
question, and it is the one question the evidence above leaves this
instrument able to ask of it: `tools/evaluation/scenarios/let-readers-choose-which-language-a-post-shows-in/`
declares `discovery` alone, against exactly that peer set, judged on the
`Skill` tool invocation — the one moment that precedes every conflict the
Context section documents.

`professional-behavior` does not clear it. Its own `description` claims every
session — a question answered, a review given, a change delivered, not only
a change — and no domain skill in this library contests that ground. A
`discovery` factor asking whether an agent reaches for `professional-behavior`
would have no peer plausibly competing for the same prompt, so it would pass
by construction rather than by finding anything: the formality
[#423](https://github.com/axross/skills/issues/423)'s peer-set constraint
exists to forbid. `professional-behavior` is therefore recorded as out of
this instrument's range, and #423's "What is deliberately excluded, and why"
section names it beside `agent-skill-authoring` and `agent-skill-management`,
linking here for the reason.

## What was rejected

**Giving both skills a discovery-only scenario.** Put to the maintainer at
the clarify gate and not chosen. It would satisfy #423's policy of one
scenario per in-range skill, but `professional-behavior`'s discovery phase
has no plausible competitor, and #423's own constraint is that `peerSkills`
is what makes discovery a real question — installing it against an empty or
irrelevant peer set would not.

**Excluding both skills, with the harness question left open.** Put to the
maintainer and not chosen. It gives up a question the instrument can still
answer — whether `loop-engineering`'s description reaches an agent holding an
open-ended change request — on the grounds that the rest of the skill is
unreachable.

**An `outcome` factor asserting an empty diff**, read as "planned rather than
coded." Rejected on the evidence: an empty diff is also what a confused probe
produces, and a probe that plans and then commits a plan file no longer
produces one either.

**A `transcript`-phase `script` factor grepping for plan-shaped reasoning.**
Rejected: the reasoning is not stored, the surviving assistant text is under
2.4 KB of narration, and a grep over the raw transcript would hit the
`system init` event's own boilerplate — the words "plan" and "review" appear
in every probe's stream from the CLI's slash-command list, at a constant
count, before the model has said anything.

**Changing `NONINTERACTIVE_BRIEF` so the gate becomes measurable.** Out of
scope for this slice: it changes what every probe is told and would make
every stored measurement incomparable. No issue carries that question today —
[#427](https://github.com/axross/skills/issues/427)'s archived original
description is where it was put — and this record does not settle it.

**Recording the exclusion in #423 alone**, matching how `agent-skill-authoring`
and `agent-skill-management` are recorded there. Put to the maintainer at the
clarify gate and not chosen: the conclusion constrains later slices, and
`docs/index.md` routes "why a past decision still constrains
current work" to `docs/decisions/` rather than to an issue.

## Consequences

**`professional-behavior` is now covered by no scenario, and that is a
recorded choice rather than an oversight.** A reader who notices the absence
should find this record, not conclude that measuring the skill was simply
never attempted.

**A discovery-only scenario spends both conditions to measure one.** Per
`docs/specs/skill-evaluation.md`, a discovery factor's differential is
bounded below by construction and is read as the skill-present pass rate; the
skill-absent condition still runs, because a scenario is one unit, but it
supplies no reading of its own for this factor. Of `let-readers-choose-which-language-a-post-shows-in`'s
six probes per dispatch, three carry the reading and three exist only
because the instrument has no single-arm mode.

**The rule is contingent on the harness, not on the skills.** If
`NONINTERACTIVE_BRIEF` ever stops pre-empting the plan-approval gate it
currently forbids, or if #439 is resolved and a stored transcript starts
carrying real reasoning, the range this record draws should be re-argued from
that new evidence rather than inherited from this one. Nothing here holds
past the harness conditions that produced it.
