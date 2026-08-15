---
status: accepted
---

# Record the discovery vocabulary cost before its artifact expires

## Context

Round one of the skill discovery evaluation found 42 of its 77 readable
probes selecting no skill at all, and 22 of its cases reported a `MISS`.
That count was not homogeneous: of 21 situated cases carrying a `MISS`, 14
selected nothing at all, 4 routed to a skill the case did not require —
`say-what-you-do-not-know-before-answering` reached for
`next-app-development` over `professional-behavior`, and
`decide-where-a-rollback-procedure-is-written-down` for the very skill its
case excluded — and 3 found one of two required skills and missed the
other.

The obvious reading of a 42-of-77 no-selection rate is that the descriptions
need better keywords. `high-fidelity-ui-design`'s own `description` already
contained the phrase "real colors, type, spacing, and states"; the prompt
that scored 0/6 against it was "make it look like the rest of the app."
Nothing was missing from the description. The prompt was asking in a
different vocabulary, and that gap sat there on purpose:
`2026-08-09-ask-discovery-prompts-as-problems-inside-a-real-project.md`
rewrote the fixture's prompts to stop them carrying their own answer, naming
as its own example a prompt that "used the low-fidelity design capability's
own vocabulary to ask for low-fidelity design" and calling that circular —
"the model never has to read the project, so the measurement records
routing on vocabulary rather than routing on a situation."

A controlled experiment (#377) reconstructed that same circularity on
purpose, on two cases, and measured its size. It ran four override
dispatches — one per wording per case — six repeats each, 24 probes in
total, for $6.60, with mock, patch, tiers, repeat count, and corpus held
fixed by the prompt-override mechanism so the prompt was the only variable.
Being an override run, it recorded none of it as a case measurement; what it
produced landed only in an uploaded artifact retained 30 days from
2026-08-13, which is why this record exists — that window is the only place
the two results below survive once
`tools/evaluation/data/discovery/README.md` is gone.

`turn-a-settled-layout-into-a-real-screen`, which tracked
`high-fidelity-ui-design`: the declared wording — "We've settled what goes
on the screen for changing a card that already exists, and in what order.
Now I need it to actually look like the rest of the app." — scored 0/6. The
vocabulary-matched wording — "Now I need the real colours, type and spacing
on it, and the states it can be in." in place of the same setup — scored
6/6. Two-sided Fisher exact: p = 0.0022. Round one never selected
`high-fidelity-ui-design` at all in either of the two cases that tracked it,
so those six were the first selections of that skill any measurement had
recorded, and a wording change was the whole of what produced them.

`stop-two-sites-sharing-one-cached-list`, which tracked
`tanstack-query-development`: the declared wording — "Switching from one
customer's site to another shows the wrong site's posts for a moment before
it corrects itself." — scored 0/6. The vocabulary-matched wording —
adding "the two sites look like they are sharing one cached list until it
refetches" — scored 2/6. Two-sided Fisher exact: p = 0.455 — off zero, but
indistinguishable from chance at this sample size. This pair did not
replicate the first; it was the pair that failed to reproduce the effect,
not weak evidence for it. The two pairs disagreeing is exactly why no
corpus-wide conclusion was drawn from either.

**Three mechanisms, one of them measured.** A transcript investigation
separated three distinct reasons a probe fails to select a tracked skill.
This experiment tested only the first.

1. **Prompt shape** — measured, above.
2. **The situated condition itself.** 41 of 68 situated readable probes
   selected nothing, against 3 of 21 across both bare rounds; not one of
   those 41 mentioned "skill" anywhere in its own prose, so the skill layer
   appeared never to enter the model's reasoning rather than being weighed
   and declined. Selection, when it happened, happened early — a median of
   3 paths read before selecting, against a median of 7 read in total by a
   probe that never selected. Unmeasured: no experiment isolated this from
   the other two.
3. **The mock already answers the prompt.**
   `choose-the-level-a-retry-is-logged-at` missed `software-instrumentation`
   because the probe read `server/deploy-hook.ts` and reported the log
   levels already there; `agree-a-plan-before-writing-code` missed
   `loop-engineering` because the probe read the mock's own README and
   correctly stated the project's plan-first rule. Unmeasured.

**What the experiment did not license.** Both declared arms scored 0/6,
which was enough repeats to say the n=2 `MISS` was not a sampling artefact
— but only for those two cases. It licensed nothing about the other 20
`MISS` verdicts in round one, which nobody re-read this way.

## The decision

**Keep this finding as a decision record rather than let it disappear with
the artifact and the file that reported it.** The evidence expires whether
or not the instrument that produced it is rebuilt, and rebuilding the
effect side of the evaluation carries no obligation to also carry this
prose forward — nothing about it argues for or against that rebuild. It is
recorded here because it constrains a proposal nobody has written yet, and
because its own rationale — two Fisher-tested pairs, on two cases, out of a
fixture of forty — is not recoverable from any code once the pairs
themselves are gone.

**What it rules out.** Adding problem vocabulary to a `description` would
raise the discovery number, but only by re-creating the circularity
`2026-08-09-ask-discovery-prompts-as-problems-inside-a-real-project.md`
removed, one level down: the fixture's prompt would stop carrying the
answer, and the corpus's description would carry it instead — for every
prompt near that vocabulary, not only the one this measurement happened to
sample. A proposal that closes this gap has to be argued on whether it
helps a real project's reader act on the description, never on whether it
moves this measurement — the same move that decision already forecloses for
the fixture side.

## What was rejected

**Folding this into
`2026-08-15-rebuild-skill-evaluation-around-scenarios-and-factors.md`.**
Rejected: that record states why the effect side of the evaluation was
rebuilt, and every failure it cites is a failure of that side. This finding
is about the discovery side's own cost of asking a prompt as a situation
rather than as a vocabulary match, and bundling it in would make one record
carry two rationales that do not support each other.

**Letting the finding lapse with the artifact.** Rejected by the same
reasoning `2026-08-10-cover-every-in-range-skill-with-one-effect-case.md`
already applied to a different question: the argument costs something to
write once and nothing to keep, against losing the only durable record of a
measurement that cost $6.60 to take.

## Consequences

**A future proposal to add problem vocabulary to a `description`** has to
answer to what it rules out, above, not to whether the discovery
measurement would score higher under it.

**The other 20 `MISS` verdicts from round one stay unexplained by this
finding.** Nothing here licenses reading them the way these two cases read;
a future measurement of any of them under the scenario model this rebuild
adopts starts from no conclusion this record draws.
