# Skill effect evaluation — the instrument

Measures whether an installed skill changes what a model does during real work,
by running the same task twice under two conditions — **skill-absent** and
**skill-present** — and storing everything each run produced. It measures; it
never judges. The measurements it writes live in
[`data/effect-eval/`](../../data/effect-eval/README.md).

## It never gates

Not in `npm run check`, not in `merge-checks.yaml`, not a required check, not in
any hook. It is non-deterministic, it costs real money per run, and it needs a
secret that fork pull requests do not receive — and a flaky merge gate gets
bypassed or deleted. Its output is a finding for a human.

`tests/repository/reporting-tools.test.mjs` asserts the probe appears in exactly
one workflow — its own — and that `effect-eval.yaml` declares `workflow_dispatch`
as its only trigger and gives its probe job no write permission. Wiring any of
that differently breaks a test first.

What `npm test` _does_ run is the drift check over
[`data/effect-eval/`](../../data/effect-eval/README.md) — a deterministic
re-derivation from committed files, offline, with no model call. That is a check
on the instrument's own bookkeeping, not on the measurement's verdict, and it is
the one thing here that can legitimately fail a merge.

One exception, and it is not an exception to the rule above: `merge-checks.yaml`
does not run on the measurement pull request this workflow opens. That is a
declared division, not a bypass — see [The measurement pull
request](#the-measurement-pull-request-is-checked-by-the-dispatch) below.

## Three entry points, one verb each

```sh
node tools/effect-eval/setup.mjs     --mock content-site --skill unit-testing --install
node tools/effect-eval/evaluate.mjs  --workspace <dir> --case <id> --condition skill-present --out <dir>
node tools/effect-eval/summarize.mjs --check
```

| Command         | Does                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `setup.mjs`     | Materializes a mock into a throwaway Git workspace, installs the condition's skills, installs dependencies. |
| `evaluate.mjs`  | Fingerprints that workspace, runs **one** probe against it, writes the probe record.                        |
| `summarize.mjs` | Derives the summary layer over a finished case measurement and enforces the comparability checks.           |

The split follows the work, not taste: the probes of one case run as a matrix
across separate runners, so preparing, probing, and summarising happen in
different processes on different machines.

`summarize.mjs` is separate for a reason of its own — the derivation has two
callers that do not depend on each other. The landing job derives the summary
after the matrix finishes and before it commits; the drift check re-derives a
_committed_ summary and compares bytes. One implementation, two callers.

## What makes two measurements comparable

A record used to be keyed on the _names_ of the mock and the skills, so a skill
edited by one line between two measurements produced two records nothing could
tell apart. Now `metadata.json` carries content digests:

- `project.tree` — `sha256` over sorted `path\0mode\0sha256(content)` lines,
  with `.git/`, `.claude/skills/`, and `node_modules/` **explicitly** excluded
  rather than excluded by whatever the mock's `.gitignore` happens to say.
- `skills` — one digest per installed skill, so editing one skill by one byte
  moves that entry and no other. `{}` in the skill-absent condition.

`.claude/skills/` is outside the project digest deliberately and
load-bearingly: a project fingerprint that included the installed skills would
differ between the two conditions _by construction_, and the check that proves
two probes are comparable would always fail.

`summarize.mjs` then checks that every probe shares one project tree, one
runtime version, one model and one task; that the skill-present probes share
one skill set and the skill-absent ones installed nothing; that the **loaded**
skill set is identical across every probe; and that the number of probe
directories matches the case's declared repetition count. A measurement that
fails any of these reports a difference that cannot be attributed to the skill,
so it fails with the disagreement named.

The loaded-skill check requires _identical_, not _empty_. No available flag can
guarantee the CLI loads nothing — `--setting-sources project` strips the
user-level skills, but the ones a managed environment injects cannot be
stripped without also stripping the workspace's own, which are the treatment.
So the achievable invariant is that whatever contamination exists is the same
on both sides, where it cancels.

## The budget binds by refusal, before the spend

Admission runs once, before the fan-out, and decides whether the whole case may
proceed — projecting from committed measurements where they exist and from the
fixture's declared ceiling where they do not. A refusal is a finding, not a
prompt to raise the cap.

This replaced a cumulative ledger that charged after each probe and projected
the remainder. That shape only works if the probes are serial, and serial is
worse for the measurement than a matrix: probes strung out over an hour let
service drift land unevenly across the conditions, where probes in one window
let it land on both alike. The ledger existed only to support the thing that
was hurting the measurement.

The turn cap of 100 is a runaway guard, not a budget control. A cap that binds
is a confounder rather than a limit — the skill-present condition may
legitimately do more work, so a binding cap truncates it first and pushes the
measured effect toward zero. Do not lower it to save money.

## The measurement pull request is checked by the dispatch

`effect-eval.yaml` opens its pull request with `GITHUB_TOKEN`, and GitHub does
not fire workflows on those — so `merge-checks.yaml` does not run on it.

Rather than leave the measurement unchecked, the landing job runs those checks
itself, before it commits: the drift check, the comparability checks, and
`npm run check`. A failure there fails the dispatch and opens no pull request.

That division is declared rather than inherited. `merge-checks.yaml` excludes
this pull request at its trigger, by **path**: one whose changed files are all
under `data/*/measurements/**` or `data/*/summary.json` carries measurement data
and no code, so the gate workflow does not start.

By path rather than by branch name for two reasons. GitHub cannot do it by
branch name at all — `branches` on a `pull_request` trigger filters the _base_
branch, not the head. And a path key is better regardless: a branch-name key is
a public string any contributor could adopt to skip every gate, where a path key
is a fact about what the pull request contains. One line of code in it and every
gate runs, whatever the branch is called.

The gates still run on the **push to the default branch** once the measurement
merges — the drift check included. So measurement data is exempt from _blocking_
a pull request, not from being checked. The residual is narrow: between the
dispatch's own checks and the post-merge run, the only window is the pull
request itself, and what sits in it has already been checked once.

## Credentials

[`tools/lib/credentials.mjs`](../lib/credentials.mjs) strips the environment
going in and redacts the transcript coming out — one requirement's two faces,
and previously two separate implementations of the first half alone.

Redaction is **by value**: the literal bytes of the credentials this process
holds are replaced before anything is written, which is exact where a shape
heuristic is not. A shape scan then runs as a backstop and _refuses_ rather than
redacting — a transcript matching a credential shape the by-value pass could
not account for is one this tool cannot vouch for, and writing it anyway would
be the one outcome worse than losing the probe.

## Running it without spending anything

`evaluate.mjs --dry-run` fingerprints the workspace, builds the real argv,
writes a complete probe record with a synthetic transcript, and spawns nothing.
The record is stamped `trigger.kind: "dry-run"` so it cannot be mistaken for a
measurement. Every bundled test stays on that path: nothing in the test suite
spawns the CLI or reaches the network.

### Rehearsing the whole dispatch

Dispatching `effect-eval.yaml` with **`dry-run`** runs every step of it — the
matrix fan-out, the artifacts, the derivation, this repository's own checks, the
commit, and the pull request — passing `--dry-run` to each probe. Nothing is
billed; it costs CI minutes.

It exists because everything between the matrix and the landed pull request has
no local analogue. The offline tests cover `setup` → `evaluate` → `summarize`;
they cannot cover `download-artifact`'s merge, the land job's `git` and `gh`, or
whether the merge gate really skips the result. The last defect found in that
seam was one line, and it was caught by reading rather than by running.

**A rehearsal's pull request is closed, never merged.** Three things keep it
from landing, and they are worth telling apart:

- it opens as a **draft**, which GitHub will not merge;
- its branch is `effect-eval/dry-run/<run_id>` and its title says so;
- before committing, either mode refuses when the records' stamps and the
  dispatch's mode disagree — a rehearsal whose records are not stamped means
  `--dry-run` never reached the probe and models were billed, and a measurement
  with a stamped record means a probe wrote a synthetic transcript.

A test asserts no **committed** measurement carries the dry-run stamp, so
merging one anyway breaks the default branch's checks. That test reads Git's
tracked files rather than the working tree, which is both what "committed" means
and what keeps it from firing during a rehearsal's own `npm run check`.

The one thing a rehearsal cannot answer is how six concurrent CLI sessions on
one credential behave, because it starts none.

## Why the tool posture is the opposite of the discovery evaluation's

`scripts/discovery-eval/run.mjs` denies `Bash` and every editing tool because
its workspace may hold attacker-authored skill text from a pull request head.
This one permits them: its workspace is built only from this repository's own
mock fixture and its own installed skills, and whether the model _invokes_ a
skill during real work is exactly what is being measured.

That difference is also where the shared layer stops. `tools/lib` holds only
what is shaped outside either evaluation's question — the CLI's `stream-json`
format, and the requirement to keep a credential out of a subprocess and out of
a stored file. Everything an evaluation decides for itself — its tool posture,
its turn cap, what its fingerprint covers, what a measurement directory holds —
stays with it.
