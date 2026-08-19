---
status: accepted
---

# Route the reasoning judge through the Claude Code CLI

## Context

`judge.mjs` asked a reasoning judgment by posting to the Anthropic Messages
API with an `x-api-key` header carrying `ANTHROPIC_API_KEY` — a secret this
repository does not set, and has declined to set four times. The `evaluate`
job's only working model credential was `CLAUDE_CODE_OAUTH_TOKEN`, the token
that already authenticates the `claude` CLI the `probe` job spawns. Every
`reasoning` factor across eleven scenarios had therefore never returned a
verdict; each one recorded the correct error and nothing more.

Whether that token could reach the Messages API at all was open until it was
checked: the API refuses a Claude Code OAuth token outright, under any
header, and the request to accept one was closed as not planned upstream
([anthropics/claude-code#37205](https://github.com/anthropics/claude-code/issues/37205)).
`judge.mjs`'s own header records that finding, because it is what makes a
plain header swap on the existing HTTP call unworkable — that alternative's
rationale lives in code and is not repeated here. What code does not carry is
why the two remaining shapes a route could take, and asking for a credential
again, were turned down; that is what this record holds.

## The decision

**A reasoning judgment is asked through the `claude` CLI rather than the
Messages API, under the same credential and the same spawn discipline
`probe.mjs` already uses for its own model call.**
`docs/operations/evaluation-dispatch.md` states that procedure in full;
this record states why it was chosen.

Because the CLI wraps the instrument's prompt in scaffolding of its
own — the verification run this decision rests on reported 16,633
cache-creation tokens against 10 input tokens for a prompt carrying
almost nothing of its own — a reasoning judge's route joins its model
and its prompt as part of what makes two measurements comparable.
`docs/specs/skill-evaluation.md`, "What makes two measurements
comparable", states that rule in full; this record states why the
route earns a place in it.

## What was rejected

**Add `@anthropic-ai/claude-agent-sdk` and call it in process.** Rejected: it
wraps the same CLI this decision spawns directly, while adding a runtime npm
dependency the instrument does not otherwise carry — a cost with no
capability behind it, since the CLI it wraps is already the route chosen.

**Keep both routes — HTTP when `ANTHROPIC_API_KEY` is set, the CLI
otherwise.** Rejected: it would let one scenario be judged under two
different prompt shapes depending on which credential a dispatch happened to
carry, which is exactly the hazard the comparability rule exists to prevent.
It would also preserve a route this repository has never once exercised for
real, for the sake of a credential it has declined to set.

**Ask for an `ANTHROPIC_API_KEY` secret.** Rejected a fifth time. The
credential this repository's dispatch already carries reaches a working
route; asking for a second one to reach the same destination has no
remaining justification.

## What it costs

**A judgment now spends money where it previously errored for free.** The
verification run this decision is based on reported `total_cost_usd`
0.034739 for a trivial prompt, most of it the CLI's own cached preamble; a
real transcript adds its own tokens on top, and a dispatch pays this per
reasoning factor per probe.

**The CLI version is not recorded beside the route.** The dispatch pins it
(`CLAUDE_CODE_VERSION`), a local run's is not the instrument's to control,
and recording it would need a second invocation. A stored verdict can be
re-read against its model, its prompt, and its route, but not against the
exact CLI build that produced it.

**The measurement fingerprint carries one more field.** No stored measurement
held a reasoning verdict before this decision, so nothing on disk became
unreadable or silently re-comparable the day it landed — but every fingerprint
computed from here on carries `route`, and a fingerprint that lacks it (a
factor record predating this decision) compares unequal to one that has it.
