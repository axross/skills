---
status: accepted
---

# State the transcript phase as a process check

## Context

Issue #439 read `docs/specs/skill-evaluation.md`'s claim that the
`transcript` phase "asks whether the agent reasoned as expected" as a
literal one, and found that every stored `thinking` block across the five
probe artifacts of
[run 31981990871](https://github.com/axross/skills/actions/runs/31981990871)
was `{"type":"thinking","thinking":"","signature":"…"}` — a signature with
no content. Two revisions of this issue's plan (implemented on this branch
by `ca59efd`, `f5f339d`, and `f6ba078`) tried to fix that by repinning the
probe model, `tools/evaluation/src/spawn.mjs`'s `MODEL`, to one whose
requests still carry reasoning content, settling on `claude-sonnet-4-6`.

That repin was measured against the `claude` CLI, version 2.1.237, by
running one realistic edit task in a scratch workspace under each candidate
model and counting the `thinking` blocks the `--output-format stream-json`
stream carried:

| Probe model                  | `thinking` blocks | non-empty | characters |
| ---------------------------- | ----------------- | --------- | ---------- |
| `claude-sonnet-5` (the pin)  | 5                 | 0         | 0          |
| `claude-opus-5`              | 2                 | 0         | 0          |
| `claude-opus-4-7`            | 2                 | 0         | 0          |
| `claude-opus-4-6`            | 2                 | 2         | 2,356      |
| `claude-sonnet-4-6`          | 2                 | 2         | 1,291      |
| `claude-sonnet-4-5-20250929` | 2                 | 2         | 3,178      |
| `claude-haiku-4-5-20251001`  | 3                 | 3         | 3,018      |

`--include-partial-messages` under `claude-sonnet-5` was also tried on the
same task: it emits 16 `thinking_delta` events, all carrying zero characters
of `thinking` text. The reproducing command, run against a scratch directory
holding one small `calc.mjs`:

```
claude --print "Read calc.mjs and decide whether total() handles an empty list and a missing qty correctly. Fix what is wrong, then say what you decided." \
  --output-format stream-json --verbose --model <model> \
  --allowed-tools Read,Edit --permission-mode acceptEdits < /dev/null > probe.jsonl
```

counted with:

```
node -e 'const fs=require("fs");let n=0,ne=0,ch=0;for(const l of fs.readFileSync("probe.jsonl","utf8").split("\n").filter(x=>x.trim())){let e;try{e=JSON.parse(l)}catch{continue}const c=e?.message?.content;if(Array.isArray(c))for(const b of c)if(b.type==="thinking"){n++;const k=(b.thinking??"").length;ch+=k;if(k)ne++;}}console.log(n,ne,ch);'
```

That table only says which models leave the block non-empty; it does not say
what the non-empty block actually is. Anthropic's own documentation on
extended thinking and its pricing page, both read 2026-08-20, settle that
separately: what a `thinking` block carries is governed by the request's
`thinking.display` setting — `omitted` is the default from Claude Opus 4.7
onward, `summarized` is the default before it — and `claude --help` on CLI
2.1.237 exposes no flag that sets that field, so the model pin was this
instrument's only lever over it. Decisively, `summarized` returns **a
summary of the reasoning written for display**, not the reasoning itself,
and no model exposes the raw chain of thought at any setting. So the three
measured rows above with zero non-empty blocks are every candidate that
defaults to `omitted`; the four with non-empty blocks are every candidate
still defaulting to `summarized` — and even those four were never going to
hand a judge the agent's actual reasoning, only a display summary of it.

The maintainer then read issue #439 for what the `transcript` phase was
always meant to check: whether the transcript of a scenario's run shows the
agent carrying the task out by the expected process — what it consulted,
what it did, and what it said along the way — not the model's private
chain of thought. On that reading, the empty `thinking` blocks were never a
defect in the instrument; the specification's "whether the agent reasoned
as expected" and the eight factor instructions that followed its wording
into asking for "the agent's own reasoning" are what stated the phase
wrong. The maintainer also settled that a `transcript`-phase `reasoning`
judgment is asked of `claude-haiku-4-5` — already the model every such
factor declared, but until now a coincidence repeated across eight files
rather than a stated choice.

## The decision

**The `transcript` phase is stated as the process check it has always been:
whether the run's transcript shows the agent carrying the task out by the
expected process, read from what the transcript observably contains —
never from the agent's private reasoning, which no reachable configuration
supplies.** `docs/specs/skill-evaluation.md`, "Three phases," carries the
restated bullet and the paragraph explaining what the stored transcript
does and does not carry; `docs/glossary.md`'s "Evaluation phase" entry
takes the same restatement in its own register. The eight factors whose
`description` or `instructions` asked a judge to find "the agent's own
reasoning" are reworded to ask what the transcript shows instead, without
changing the expectation any of them holds. `tools/evaluation/src/spawn.mjs`
returns `MODEL` to `claude-sonnet-5`, the pin at this branch's merge base,
since this reading needs nothing else from it. A `transcript`-phase
`reasoning` judgment is recorded as asked of `claude-haiku-4-5`, in
`docs/specs/skill-evaluation.md`, "The factor."

## What was rejected

**Repin the probe model to one that emits reasoning.** What this issue's
first two revisions did. Rejected on the measurement above: the best
reachable material under any candidate is a display summary of the
reasoning, never the reasoning itself, so the repin buys a summary at the
cost of a model generation of external validity and roughly 15% more per
probe — `claude-sonnet-4-6` is priced at $3/$15 per million input/output
tokens against `claude-sonnet-5`'s $2/$10, an increase partly offset by
`claude-sonnet-4-6`'s older tokenizer producing roughly 30% fewer tokens for
the same text.

**Narrow the phase to what a probe narrates.** The issue's own alternative,
and the one its second revision assumed as the fallback if the repin failed.
Not taken as framed: the phase is not being cut down to fit its material —
the material a probe's transcript carries has always supported a process
check; it was the specification's wording that overstated what that check
could see, not the phase's material that fell short of what it asked.

**Leave the eight factor instructions alone.** Rejected: seven of them,
judged by the `reasoning` method, and one by `script`, directed a judge to
find the agent's private reasoning — material no configuration will ever
supply. A `false` from one of them meant something other than what it
appeared to mean: not "the agent did not carry out this diagnosis" but "no
model exposes what this factor asked for," indistinguishable in the
recorded result from an honest failure.

## What it costs

**No probe cost changes.** The pin returns to `claude-sonnet-5`, where it
stood before this issue's first revision; no measurement is superseded, and
`tools/evaluation/measurements/` holds only a `.gitkeep`.

**The reworded factors must keep asking the same expectation.** A factor
that asked whether the agent identified a stated cause still asks exactly
that; what moved is the account of where a judge is to find it, so a later
measurement of one of these factors stays comparable in substance to what
it was written to check before this change.

## What this closes elsewhere

`2026-08-17-measure-agent-conduct-skills-by-discovery-alone.md` reads the
empty `thinking` blocks the way this issue first did, and names its own
reconsideration trigger as this issue being resolved and a stored
transcript starting to carry real reasoning. That trigger is closed rather
than pending: this issue is resolved, and the second half of the condition
can never be met — no reachable configuration adds a chain of thought to a
stored transcript. What that record decided is untouched, because it rests
on the non-interactive brief the instrument appends rather than on what a
`transcript` factor could read; the record itself stays exactly as written,
since a decision is replaced by a new record and never by editing an old
one's substance.

## What was measured versus what was read

The seven-row table above, the `--include-partial-messages` result, and the
reproducing command are this session's own measurement, taken against
`claude` CLI 2.1.237. That `thinking.display` governs the field, that its
default moved from `summarized` to `omitted` at Claude Opus 4.7, and that
`summarized` returns a display summary rather than the reasoning itself are
findings read off Anthropic's extended-thinking documentation and pricing
page, both consulted 2026-08-20 — not something this session's probes
established on their own; the probes only located which models leave the
block non-empty, not what the non-empty block actually contains.
