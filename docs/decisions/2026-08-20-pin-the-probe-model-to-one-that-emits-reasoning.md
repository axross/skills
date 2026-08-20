---
status: accepted
---

# Pin the probe model to one that emits reasoning

## Context

`docs/specs/skill-evaluation.md` defines the `transcript` phase as asking
whether the agent reasoned as expected, and `materialFor` in
`tools/evaluation/src/factor-judgment.mjs` hands a `transcript` factor the
stored transcript and nothing else. Issue #439 established by reading the
five probe artifacts of
[run 31981990871](https://github.com/axross/skills/actions/runs/31981990871)
that all 99 `thinking` blocks across them were stored as
`{"type":"thinking","thinking":"","signature":"…"}` — a signature with no
content — and that `redactTranscript` is not what empties them. What it left
open was whether the CLI could be made to emit the content at all.

That was measured in this session, against the `claude` CLI version 2.1.237,
by running one realistic edit task in a scratch workspace under each model
and counting the `thinking` blocks the `--output-format stream-json` stream
carried:

| Probe model                             | `thinking` blocks | non-empty | characters |
| --------------------------------------- | ----------------- | --------- | ---------- |
| `claude-sonnet-5` (the pin at the time) | 5                 | 0         | 0          |
| `claude-opus-5`                         | 2                 | 0         | 0          |
| `claude-sonnet-4-5-20250929`            | 2                 | 2         | 3,178      |
| `claude-opus-4-5-20251101`              | 2                 | 2         | 2,556      |
| `claude-haiku-4-5-20251001`             | 3                 | 3         | 3,018      |

Every empty block was stored as `{"type":"thinking","thinking":"","signature":"…"}`,
matching what issue #439 found across all 99 `thinking` blocks of the five
probe artifacts above.

`--include-partial-messages` was tried on the same task under
`claude-sonnet-5`. It emits 16 `thinking_delta` events whose `thinking` field
is `""` and whose only payload is an `estimated_tokens` count, alongside
`signature_delta` events carrying the signature. So no CLI flag recovers the
content: it is withheld upstream of the CLI, and the split is by model
generation — the Claude 5 family withholds, the 4.5 family does not.

The reproducing command, run against a scratch directory holding one small
`calc.mjs`:

```
claude --print "Read calc.mjs and decide whether total() handles an empty list and a missing qty correctly. Fix what is wrong, then say what you decided." \
  --output-format stream-json --verbose --model <model> \
  --allowed-tools Read,Edit --permission-mode acceptEdits < /dev/null > probe.jsonl
```

counted with:

```
node -e 'const fs=require("fs");let n=0,ne=0,ch=0;for(const l of fs.readFileSync("probe.jsonl","utf8").split("\n").filter(x=>x.trim())){let e;try{e=JSON.parse(l)}catch{continue}const c=e?.message?.content;if(Array.isArray(c))for(const b of c)if(b.type==="thinking"){n++;const k=(b.thinking??"").length;ch+=k;if(k)ne++;}}console.log(n,ne,ch);'
```

`tools/evaluation/src/spawn.mjs` pins the model deliberately, and its own
comment states the consequence: a change to it supersedes existing
measurements rather than extending them. `docs/specs/skill-evaluation.md`,
"What makes two measurements comparable", carries the same rule.
`tools/evaluation/measurements/` holds only a `.gitkeep`, so no stored
measurement is superseded in practice.

## The decision

**The probe model pins to `claude-sonnet-4-5` — the closest model to the
previous pin that emits reasoning — so a `transcript` factor's judge is
handed the material its phase's definition claims.** The phase keeps its
declared question; the material is made to match it, rather than the
question being cut down to what the previous pin's material could support.
`tools/evaluation/src/spawn.mjs`'s `MODEL` constant carries the pin, and
`docs/specs/skill-evaluation.md`, "Three phases", states that the
`transcript` question is answerable only while the pinned model emits
reasoning content.

## What was rejected

**Narrow the `transcript` phase to what a probe narrates.** The alternative
issue #439 itself raised, and one the measurement above equally supports —
nothing here rules it out on the evidence. Rejected by the maintainer's
decision on direction: the phase keeps its declared question, and the
material is made to match it, rather than the question being cut down to the
material.

**Keep `claude-sonnet-5` and recover reasoning through a CLI flag.** Ruled
out by the measurement, not by argument — `--include-partial-messages`
yields zero characters of reasoning under that model, both in the general
run above and in a check taken specifically against it.

**Pin `claude-opus-4-5`.** Emits reasoning, but costs more per probe across
every scenario, condition, and repetition of a run that is already the
instrument's dominant expense.

**Pin `claude-haiku-4-5`.** Emits reasoning and is the cheapest of the three,
but is the weakest probe agent, and is already the model most `reasoning`
factors name as their judge — pinning it as the probe as well would collapse
a distinction the instrument otherwise keeps.

## What it costs

**The probe agent moves back one model generation.** A measurement taken
under the new pin describes how a skill behaves under a 4.5-family agent,
while a project installing these skills is likely running a Claude 5 one —
external validity is what buys the reasoning material, and the trade is
recorded here rather than mitigated.

**A stored transcript grows.** It now carries reasoning text, which raises
the token cost of every `reasoning` judgment taken over it, since
`materialFor` hands a `transcript` factor the whole transcript.
