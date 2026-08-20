---
status: accepted
---

# Declare `agentsMd` true to keep scenarios comparable

## Context

Every declared scenario carried `harness.agentsMd: false`, and nothing under
`tools/evaluation` read the field beyond validating it and copying it into a
stored `metadata.json` — the workspace materializer had no branch on it at
all. Every mock ships an `AGENTS.md` and a one-line `CLAUDE.md` pointing at
it, and the materializer's own copy step filtered only `node_modules`, so
both files reached every probe's workspace regardless, committed into its
replayed history. Every probe run so far therefore ran with a working
agreement its own stored `metadata.json` denied.

Issue #417 filed this as a problem statement rather than a plan, and left
open which of two readings the fix should take: either the flag means "no
`AGENTS.md` in the workspace" and is unimplemented, or it means "no
_additional_ working agreement beyond the mock's own" and is implemented
correctly but named and documented misleadingly. The maintainer settled on
the first reading at the clarify gate, together with what to do about the
existing declarations.

## The decision

The materializer now honours `harness.agentsMd`: `false` withholds the
mock's `AGENTS.md` and `CLAUDE.md` from a materialized workspace and from
its replayed history; `true` keeps them exactly as the materializer already
did before this option existed. Both callers that materialize a workspace —
the one a probe runs in, and the one a stored measurement is later judged
against — pass a scenario's own declared value through, so the two are
built alike.

Every existing scenario's declaration was changed from `false` to `true` in
the same change, rather than left as it was. `true` is the condition that
actually held for every probe already taken under these scenarios, and it
is also the value the materializer already produced before this option
existed — so declaring it leaves every materialized tree, every replayed
commit hash, and every stored `runtime.project.tree` digest byte-identical
to what they were. No measurement stored before this change loses
comparability with a future run of the same scenario.

## What was rejected

**Honouring the declared `false` and leaving the scenarios as they were.**
This is the shape the original problem statement assumed the fix would
take. Rejected because it strips the working agreement out of every
scenario's workspace, moving every materialized tree and every replayed
commit hash — every measurement stored before this change becomes
incomparable with anything run after it — and because it would silently
change the fixture conditions the `2026-08-17-measure-agent-conduct-skills-by-discovery-alone.md`
decision record reasons about.

**Reading the flag as "no additional working agreement beyond the mock's
own," and fixing only the name and the documentation.** Rejected because it
leaves a declared field that is `false` in every scenario, can never become
`true`, and switches nothing about the workspace either way.

**Deleting `harness.agentsMd` as unused.** Rejected because the instrument
has a genuine use for running a scenario with no working agreement at all,
and deleting the field would remove that capability along with the false
claim it currently makes.

## Consequences

A scenario can now genuinely ask to run without the mock's working
agreement, by declaring `false`, and every scenario declared today keeps
running with it present, unchanged from what every probe already
experienced.

The stored `metadata.json` files under a past measurement's fixtures still
record `agentsMd: false` for the probes taken before this change. That is
what was actually stored, and rewriting it would make a fixture disagree
with the measurement it stands in for; nothing reads the field back out of
a stored measurement, so nothing behaves differently for it staying as it
is.
