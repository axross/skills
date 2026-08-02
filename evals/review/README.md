# Review evaluation

Does a review contract actually catch what it was written for?

[`REVIEW.md`](../../REVIEW.md) is this repository's review policy, and until now
nothing measured whether changing it changed anything. #170 rewrote it into a
disconfirmatory contract — a subtractive pass over five lenses, a neighbour-read
procedure, an anti-anchoring clause — and could only argue the improvement by
hand, because
[`claude-review.yaml`](../../.github/workflows/claude-review.yaml) reads
`REVIEW.md` from the **base ref**. A pull request that changes the contract is
therefore reviewed under the _previous_ contract, so the change cannot be scored
until after it merges.

This evaluation inverts that. `--review-ref` selects which `REVIEW.md` a probe
runs under, so the same recorded pull request can be reviewed under the contract
before a change and the contract after it, and the two results compared. The
inversion is safe here for reasons that do not transfer to the CI reviewer:
manual dispatch only, a recorded fixture, and the default branch — never an
attacker-controllable pull request head.

## What is measured

**An anchored finding, never a mention.** This distinction is the whole validity
of the instrument. A review names files it approves of as readily as files it
faults: the review that missed #166's duplication wrote _"no duplicated rule —
module mocking's 'mock only what is slow…' explicitly defers to `unit-testing`"_,
naming the one file it got right. Scoring on paths a review cites would have
counted that as a hit on the defect it missed.

`REVIEW.md` already requires every finding to carry `file:line` evidence, so
anchors are the artifact the contract itself produces. A probe posts findings
through a `create_inline_comment` tool, and the anchors are read back from the
tool calls in the CLI's JSONL stream.

**Nothing is posted anywhere.** The real inline-comment tool writes to GitHub;
[`anchor-server.mjs`](../../scripts/review-eval/anchor-server.mjs) is a local MCP
server exposing a tool of the same name that appends each call to a file and
returns success. It is loaded with both `--mcp-config` and `--strict-mcp-config`
— the second flag matters, because without it the session's real GitHub server
stays reachable and a probe can comment on a live pull request.

## Fixture format

[`fixture.json`](./fixture.json) is a list of cases:

| Field                   | Meaning                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                    | Stable case identifier                                                                             |
| `pr`                    | Pull request number, **for provenance only** — never passed to a probe                             |
| `baseSha` / `headSha`   | Pinned commits; the probe's only view of the change                                                |
| `mustAnchor`            | `path` or `path:line` an anchored finding must land on. A bare path matches an anchor on any line. |
| `mustNotAnchor`         | Paths indicating a false positive                                                                  |
| `expectLensEnumeration` | Whether the summary must walk the five subtractive lenses                                          |
| `repeats`               | Probe count for this case                                                                          |
| `rationale`             | Why this case is labelled the way it is                                                            |

Every case carries a written `rationale` because a fixture is a judgment
product. A wrong label produces a "finding" that is really a labelling error, and
the rationale is what lets a human disagree without reading code.

### The probe never sees the pull request

A case is reconstructed from commits: the worktree at `headSha`, and the diff
against `baseSha`. It is never handed a pull request URL, unlike the CI reviewer
whose invocation is `/code-review:code-review <PR URL> --comment`.

This is not caution — the fixture is already contaminated. #166 now carries four
unresolved inline threads containing the nine-row duplication table with exact
locations, the citation finding with its `Verified against` diff and five
upstream URLs, and the routing-concreteness finding with line numbers and fixes.
Diagnosing the miss is what motivated this instrument, and doing so wrote the
answer key onto the case meant to measure it. Pinning SHAs preserves the code
but not the thread. `fixture.mjs` rejects any fixture field containing a
pull-request URL, so the rule is enforced rather than remembered.

## Verdicts

| Verdict         | When                                                              |
| --------------- | ----------------------------------------------------------------- |
| **reached**     | Any probe anchored a finding on the target                        |
| **not reached** | No probe did                                                      |
| **spurious**    | A `mustNotAnchor` target was anchored by a **majority** of probes |

The asymmetry is inherited from
[the discovery evaluation](../discovery/README.md) and matters more here: review
probes are expensive enough that repeat counts stay small, and a symmetric rule
would report ordinary run-to-run variation as failure.

### This is an existence proof, not a rate

**Reached means "at least once", never "how often".** At the repeat counts this
instrument can afford the two are not interchangeable. A 95% Wilson interval on
2/2 is `[0.342, 1.000]` and on 0/2 is `[0.000, 0.658]` — overlapping across a
third of the range, so any honest before/after rate comparison would have to
refuse to render. Reporting a percentage anyway would dress an existence proof
as a measurement, which is the failure #170 explicitly avoided when it recorded
that its own improvement was _"argued, not measured"_.

The upgrade path is real and cheap when repeat counts can support it:
`scripts/discovery-eval/determinism.mjs` already exports
`wilsonInterval(hits, repeats, z)`, which should be extracted to a shared module
rather than reimplemented.

**Severity is unmeasured.** Presence of an anchored finding says a review reached
a defect, not that it graded it correctly — and "capped at Nit" was three of the
four findings on #166. A result from this harness cannot speak to that, and
should not be reported as though it can.

**Lens enumeration is the weakest signal here.** It checks that the summary names
each of the five lenses, not that anything useful was said under them. It
separates a review that enumerated from one that did not, which is what
`REVIEW.md` made mandatory, and nothing more.

## Running it

```bash
# Validate the fixture and price the run. No model call, no secret, no network.
node scripts/review-eval/run.mjs --dry-run
node scripts/review-eval/run.mjs --help

# Compare one case under two contracts.
node scripts/review-eval/run.mjs \
  --case vitest-skill-duplication \
  --review-ref 49a11b2 --review-ref c4d3157
```

In CI, dispatch
[`review-eval.yaml`](../../.github/workflows/review-eval.yaml) — **manual
dispatch is its only trigger**, so nothing a pull request does can start it or
spend money. The report is the job log; this workflow posts nowhere and holds no
write scope.

## What it cannot tell you

- **One case.** The fixture currently holds #166 alone. A contract that reaches
  its defects has been shown to work on the one change it was written in
  response to, which is weaker than working in general.
- **No baseline is committed.** Committing one nobody has run would be
  fabricating a measurement. The first real runs produce one.
- **The estimate is not a quote.** `--dry-run` prices a probe at an
  order-of-magnitude figure; a real run reports its actual cost.
- **It never gates**, for three independent reasons: it is non-deterministic, it
  costs money per run, and it needs a secret fork pull requests do not receive.
  `tests/repository/reporting-tools.test.mjs` holds it out of the gate registry,
  every npm script, and every hook.
