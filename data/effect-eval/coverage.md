# What the effect axis cannot observe

[`docs/specs/skill-evaluation.md`](../../docs/specs/skill-evaluation.md) states
the bound this file exists to enumerate against:

> A measurement of a skill in the first two groups would show the two
> conditions agreeing, which reads exactly like a skill that changed nothing —
> and the correct reading is that the question was never put.

This file is the enumeration that keeps that reading available. It lists the installed skills the skill effect evaluation cannot put a task to at all — <!-- count:effect-eval-out-of-range-skill-count -->nine<!-- /count --> of them — grouped by which of the spec's three reasons applies, so a null result about one of them is read as "never asked" rather than as "measured and found absent."

**This is the out-of-range half only.** The in-range half — the skills
[`fixture.json`](./fixture.json) declares a case for — is computed as every
installed skill minus this list, by the offline check that holds this file
honest. There is one list to keep true here rather than two that could drift
apart.

## Skills whose surface is not the working tree

Nothing here acts on issues, pull requests, other sessions, or Git history
beyond the working tree — a materialized mock has none of that to offer a
probe.

- `github-operation` — its subject is reading from and writing to GitHub as a
  shared identity: issues, pull requests, comments, labels, reviews. A
  materialized mock has no remote, no issue, and no pull request for any of
  that to act on.
- `loop-engineering` — its subject is issues, pull requests, approval gates,
  and other sessions carrying out the stages of a change loop, none of which
  exist inside a mock.
- `code-review` — its subject is judging a change that already exists.
  Materializing a mock leaves a clean tree with nothing in flight to review,
  and the spec names conducting a review as belonging to this group.
- `quality-assurance` — the reviewer's own pass over another change's
  verification evidence, the same surface `code-review` has none of inside a
  mock.
- `conventional-commits` — a commit message lives in Git history rather than
  in the working tree, and the instrument's own diff capture (`captureDiff`)
  reads the staged tree against `HEAD` — a probe that commits would still
  record an empty artifact. Reaching this skill would mean changing what the
  instrument captures, which this fixture does not do.

## Skills whose effect is a judgement rather than an artifact

- `professional-behavior` — its subject is conduct: how an uncertainty gets
  resolved, what gets reported, and when an agent stops rather than guesses.
  None of that leaves a mark in a diff or a tool-call list; a signal extractor
  that claimed to read it would be judging rather than measuring.

## Skills that need a stack the mock does not have

None of the three mocks this evaluation runs against is itself a skill
library or carries a documentation root of the kind these skills operate on —
so there is nothing for any of them to act on today. This group is
contingent, not structural: adding a mock that is a skill library, or one
that carries a real documentation corpus with its own index, glossary, and
decision records, would move all three skills below into range without any
change to the method that measures them.

- `agent-skill-authoring` — no mock is a skill library, so there is no
  `SKILL.md` to author, tighten, or audit.
- `agent-skill-management` — the same absence from the other side: no
  two-tier skill root, no lockfile, no installed copy to reconcile against a
  source.
- `living-product-specification` — each mock carries at most one loose
  operational document under `docs/`, not a documentation root with an index,
  a glossary, and decision records for this skill's checks to run over.
