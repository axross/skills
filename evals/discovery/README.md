# Discovery evaluation

This directory holds the data the skill-discovery evaluation runs on. The runner
itself lives in [`scripts/discovery-eval/`](../../scripts/discovery-eval).

Every other mechanical check in this repository measures **form** — frontmatter
shape, bullet syntax, link integrity, section anatomy. This one measures an
**outcome**: given a prompt, does discovery surface the right skills? The unit
under test is the always-resident `description`/`when_to_use` pair, the input is
a prompt, and the assertion is set membership — so no model judges another
model's prose.

## Running it

```bash
node scripts/discovery-eval/run.mjs --help
node scripts/discovery-eval/run.mjs --dry-run          # validate, no model call
node scripts/discovery-eval/run.mjs --only wf-checkout-layout --repeats 3
node scripts/discovery-eval/run.mjs --repeats 5 --emit-baseline
```

It drives the real `claude` CLI, so it needs the CLI on `PATH` and working
authentication. **A full run costs real money** — the 20 cases × 5 repeats
measured **`$2.57`**, about `$0.026` a probe. Short runs cost more per probe:
the ~4,500-token discovery listing is identical every time, so prompt caching
only amortizes it once a run is long enough to reuse it. Use `--only` and
`--repeats` while iterating anyway; a handful of probes is still cents.

`--dry-run` needs neither a network nor a secret: it validates the fixture and
the baseline and prints what would run. That is the path `npm test` exercises.

## Running it in CI

Dispatch [`discovery-eval.yaml`](../../.github/workflows/discovery-eval.yaml)
from the Actions tab. Two inputs, both optional:

| Input          | Effect                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repeats`      | Runs per case. Higher is steadier and costs more. Defaults to 5.                                                                                                                               |
| `pull_request` | A pull request number. Its changed `SKILL.md` files are evaluated, and the report is posted there as a comment. Leave blank to evaluate the default branch and read the report in the job log. |

**Manual dispatch is the only trigger.** There is no event a pull request can
raise that starts this — no `pull_request`, and deliberately no
`pull_request_target`. Dispatching requires write access, so a contributor
cannot start a run, cannot start one by editing the workflow in a pull request
(dispatch always runs the file from the default branch), and cannot start one
by getting a label applied. That is the primary bound on both the money this
spends and the untrusted text it reads.

The only operator prerequisite is the `CLAUDE_CODE_OAUTH_TOKEN` secret that
`claude-review.yaml` already uses. No new secret, and no label.

## It never gates

Not in `npm run check`, not in `merge-checks.yaml`, not a required check, not in
any hook. It is non-deterministic, it costs money per run, and it needs a secret
that fork pull requests do not receive — and a flaky merge gate gets bypassed or
deleted. It exits 0 whatever it finds; its output is a finding for a human.

`tests/repository/reporting-tools.test.mjs` asserts it appears in exactly one
workflow — its own — so wiring it into a gate breaks a test first. What `npm
test` _does_ check is this directory's two JSON files, which is a deterministic
data check with no model call: see [Why `npm test` reads these
files](#why-npm-test-reads-these-files).

## `fixture.json`

```jsonc
{
  "version": 1,
  "expectAlways": ["professional-behavior"],
  "cases": [
    {
      "id": "wf-checkout-layout",
      "prompt": "Sketch the layout and flow for a two-step checkout screen.",
      "mustInclude": ["wireframe-design"],
      "mustExclude": ["high-fidelity-ui-design"],
      "rationale": "Why those labels are the right ones.",
    },
  ],
}
```

| Field          | Meaning                                                               |
| -------------- | --------------------------------------------------------------------- |
| `mustInclude`  | Absent from every run ⇒ a **miss**. Remedy: widen the discovery text. |
| `mustExclude`  | Selected by most runs ⇒ **spurious**. Remedy: narrow it.              |
| `mayInclude`   | Legitimate either way. Never a finding.                               |
| `rationale`    | Required. A human must be able to disagree without reading code.      |
| `expectAlways` | Fixture-level. Skills claiming to apply universally.                  |

A skill named in no tier is reported as an _unlabelled selection_ —
informational, never a failure. A spurious trigger is only ever claimed where a
human explicitly labelled it wrong.

## How a verdict is reached

With `N` repeats and `hits` = the runs in which a skill was selected:

| Tier          | `hits == 0` | `0 < hits/N ≤ 0.5` | `hits/N > 0.5` |
| ------------- | ----------- | ------------------ | -------------- |
| `mustInclude` | **miss**    | weak               | clear          |
| `mustExclude` | clear       | occasional         | **spurious**   |

**The asymmetry is the design, not an oversight.** The pilot deliberately
targets skills that compete — `wireframe-design`, `high-fidelity-ui-design` and
`react-component-styling` each disclaim the others in their own discovery text.
A prompt both legitimately answer _splits_ the distribution, so a symmetric
majority rule would report correct behaviour as two misses, and would do so
worst exactly where the fixture is most informative. Requiring only that a
`mustInclude` skill appear **at least once** removes that failure; a minority
rate reports as `weak` instead.

For a case naming two or more `mustInclude` skills the report also prints
**coverage** — how many runs selected at least one of them. That is what tells
healthy contention from a real gap:

```text
coverage: 5/5 runs selected at least one of wireframe-design, high-fidelity-ui-design
coverage: 3/5 runs selected at least one of … — 2 selected none of them
```

## `baseline.json`

Recorded output the report is expressed as a delta against, so a reader sees
what **moved** rather than a bare score:

```jsonc
{
  "recordedAt": "2026-07-29",
  "model": "claude-sonnet-5",
  "repeats": 5,
  "cases": { "wf-checkout-layout": { "wireframe-design": 5 } },
}
```

The `model` field is the one this whole comparison hangs on. **A result is not
durable across models** — it moves when a new model ships, with no change to
this repository at all. When the observed model differs from the baseline's, the
report suppresses the delta entirely and says so, rather than printing a
comparison that looks meaningful and is not. Re-record with:

```bash
node scripts/discovery-eval/run.mjs --repeats 5 --emit-baseline
```

That prints a proposed baseline to **stdout**; a human commits it deliberately.
The runner never writes the working tree. Deltas compare **rates**, so a
baseline recorded at 5 repeats stays comparable against a 10-repeat run.

## Why `npm test` reads these files

It validates both files' referential integrity — every skill name resolves to a
real skill — and never invokes the runner or makes a model call. That is the
same class of deterministic check as the installed-copy gate.

The rot it prevents has already happened twice here: `react-component-development`
was added, and `loop-engineering`'s references were split and then removed. A
**fixture** label naming a skill that no longer exists silently stops asserting
anything — the case still runs and still reports. A **baseline** entry naming
one is worse: every later delta is computed against a skill that can never
appear, so the report keeps claiming a regression that is really a rename.

## Known limits

- **One turn per run.** The measurement captures what discovery selects
  immediately, so `N` repeats give a distribution rather than a co-selection
  set. The coverage line exists because of this.
- **The fixture is a judgment product.** A wrong label produces a "finding" that
  is really a labelling error. That is what `rationale` is for.
- **The corpus is always installed whole.** Even though only the design trio is
  labelled, every installed skill goes into the workspace — otherwise a spurious
  trigger from any other skill would be structurally invisible.
- **The workspace carries no `CLAUDE.md`.** This repository's own working
  agreement mandates three skills in every session; evaluating inside this
  checkout would measure that agreement instead of discovery, and would do so
  silently.
- **`expectAlways` is informational for now.** `professional-behavior` claims in
  its own `when_to_use` that it applies to every session. Whether that holds
  under a one-turn measurement is an open question, so a shortfall is reported
  but not counted as a finding.
