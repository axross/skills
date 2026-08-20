# Verification Gates

A check on this repository is exactly one of three things: a **merge gate**
that blocks a pull request, a **reporting tool** that never blocks anything, or
a **scheduled audit** that can fail but runs only against already-merged text.
`docs/glossary.md` defines all three; this document states which is which here,
why the boundary sits where it does, and the traps a change to any of them can
fall into.

## The Enforced-Gate Set Lives in Four Places

`package.json`'s `check` chain, `.github/workflows/merge-checks.yaml`,
`README.md`'s commands table, and `REVIEW.md`'s do-not-report list all state
the same enforced-gate set, and all four MUST agree — this document does not
restate that set itself; `README.md`'s commands table is the one place it is
enumerated. Two of the four are tied together mechanically:
`tests/repository/gate-consistency.test.mjs` compares the scripts
`merge-checks.yaml` runs against `package.json`'s `check` chain and fails on a
mismatch. The other two copies are tied to nothing. Changing the gate set
therefore means editing all four by hand, and a reviewer's job is to check
that a change did.

`vitest.config.mjs` is part of the same fragility one level down: every gate
folded inside `npm test` runs through it, so a small mismatch there breaks the
verification gate outright rather than one test file.

## The Measurement Pull Request's Exclusion

`merge-checks.yaml`'s `pull_request` trigger excludes
`tools/evaluation/measurements/**` by `paths-ignore`. That exclusion MUST NOT
key on branch name instead: GitHub does not even offer that lever — on a
`pull_request` trigger, `branches` and `branches-ignore` filter the _base_
branch, never the head — and a path is the better signal regardless, since a
branch name is a public string any contributor could adopt to skip every gate,
where a path is a fact about what the pull request actually changes. The two
platform behaviours this section leans on are GitHub's, not this project's, so
read them at the source rather than here: [events that trigger
workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
for the filters, and [GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token)
for what a token-authored pull request does to a trigger.

The pull request this excludes is opened under `GITHUB_TOKEN`, by
`evaluation-dispatch.yaml`'s `land` job (see [Evaluation
Dispatch](../operations/evaluation-dispatch.md)). A `pull_request` opened under
`GITHUB_TOKEN` does create workflow runs, but GitHub holds them in an
approval-required state that nobody here approves, so this exclusion held true
by accident of platform behaviour before `paths-ignore` made it declared — a
future change to that platform behaviour can no longer silently move which gate
is responsible for measurement data.

Measurement data is rerouted, not left unchecked: `land` runs `npm run check`
before it commits, and `merge-checks.yaml`'s `push` trigger — which carries no
`paths-ignore` of its own — runs the same three gates again once the pull
request merges. Ordinary code is checked by the `pull_request` trigger, as
usual; nothing is checked by neither. The exclusion adds no `run:` line of its
own, so it carries none of the gate-consistency coupling the previous section
states.

A skipped _workflow_ reports no status at all. If these three checks ever
become required status checks on the default branch, this exclusion MUST move
from the trigger to a job-level `if:` — keyed on both the branch prefix and the
`github-actions[bot]` author — because a skipped _job_ still reports and
satisfies a required check, where a skipped workflow does not.
`tests/repository/reporting-tools.test.mjs` asserts the exclusion's current
shape.

## Gate, Report, or Scheduled Audit

A **merge gate** blocks a pull request and can say a change is wrong — a yes
or no. A **reporting tool** produces a number, a ranking, or a routing outcome
and never fails; it belongs to no gate, no npm script, and no hook, so running
one is a deliberate act rather than a side effect of proposing a change. A
**scheduled audit** can fail, but it runs from a schedule against
already-merged text rather than against a proposed change.

A check earns reporting-tool or scheduled-audit status for a stated reason,
never by default — each of the four below states its own.

## The Three Reporting Tools

This repository ships the <!-- count:first-reporting-tool-ordinal -->fifteenth<!-- /count -->, the <!-- count:second-reporting-tool-ordinal -->sixteenth<!-- /count -->, and the <!-- count:third-reporting-tool-ordinal -->seventeenth<!-- /count --> scripts that report instead of judging. None belongs to a gate, an npm script, or a
hook, and `tests/repository/reporting-tools.test.mjs` keeps all three out of
the enforced set on purpose, so wiring any of them into a gate has to be a
deliberate act that breaks a test first.

### `report-obligation-burden.mjs`

Answers "how many rules is an agent holding right now?" — the concurrent
RFC-2119 obligation count across a set of skills, as a **range**: the floor
those skills cost with only their `SKILL.md` bodies read, and the ceiling once
every `references/*.md` is read too.

```bash
node scripts/report-obligation-burden.mjs --mandated
node scripts/report-obligation-burden.mjs --help
```

Pass skills by path, by name, or via `--mandated` for the set `CLAUDE.md`
requires — reported in the **three cumulative tiers** its Response Approach
actually scopes that set to, because only one of the three skills applies to
every session: `professional-behavior` always, `software-development` once a
task touches the project, and `loop-engineering` once it changes something.
The first tier is what a question-answering session carries and the last is
what a change-delivering one does; reading the last as the always-on cost
overstates it several times over. It reads the obligation definition from the
same module `check-skill-body.mjs` does, so the reporting tools never disagree
about what a rule is.

It defines **no threshold** and never fails: it exits 0 on every valid
invocation however large the numbers. There is no evidence for a defensible
limit in this skill corpus yet, and a threshold nobody can defend becomes
either a rule people route around or a warning people stop reading.

### Skill evaluation, as a reporting tool

`tools/evaluation`'s one instrument — `probe.mjs`, `evaluate.mjs`, and
`derive.mjs` — answers "does holding a skill change what the agent does,
and does the agent reach for it unprompted?" — the checks here that measure
a skill outcome rather than a textual property. It cannot gate for three
independent reasons: it is non-deterministic, it costs real money per
probe, and a reasoning factor's judge needs a credential this repository
does not hand to a fork's pull request.

**A probe works inside a real project, which is the whole point.** Each
scenario declares a mock project and a task stated in the words of whoever
has the problem — no path, no library, no vendor — so the model has to open
the workspace to route and to work, exactly as it would for a real request.
`probe.mjs` materializes that project as a real Git repository, installs
the condition's skills into it, and runs the model with `Bash`, `Edit`,
`Glob`, `Grep`, `Read`, `Skill`, `TodoWrite`, and `Write` all permitted —
full working access, because one probe's transcript, workspace diff, and
skill invocations are what all three evaluation phases are judged from
afterward. What bounds a probe is its declared turn cap — <!-- count:probe-turn-cap -->100<!-- /count -->
assistant events by default, which is not the turn count a probe's own
record stores — rather than a restricted tool set. It was put there as a
runaway guard rather than as a budget control, and the one measurement
that has tested that premise did not bear it out — see
[`2026-08-20-read-a-truncated-probe-as-an-unfinished-measurement.md`](../decisions/2026-08-20-read-a-truncated-probe-as-an-unfinished-measurement.md).
There is one probe shape, not the two the deleted instrument used, and
nothing here evaluates a pull request's own changed text.

**Spending is bound by refusal rather than by exhaustion, and a refusal is
a finding rather than a prompt to raise the limit.** A run refuses before
any probe starts when its exact probe count exceeds the limit it was given
— never a projected dollar figure. How that bound works, and how to run
the instrument, are in [Evaluation Dispatch](../operations/evaluation-dispatch.md).

### `report-skill-duplication.mjs`

Answers "which rule is stated in more than one skill?" — a question the
skill-structure checks structurally cannot ask, because they validate one
skill directory at a time and are host-agnostic.

```bash
node scripts/report-skill-duplication.mjs
node scripts/report-skill-duplication.mjs --help
```

Two rules are compared as sets of content words, cross-skill only, and every
pair above the similarity floor is listed with both `file:line` sites and both
rules in full. It reads the obligation definition from the same module
`check-skill-body.mjs` does, so the three reporting tools never disagree about
what a rule is.

Its reason for never gating is the strongest of the three, and it is not a
missing threshold: **the defect is not decidable from the text.** The Portable
Source Exception lets a self-contained distributable skill restate a rule
another skill owns, and every skill here is distributable — so two identical
bullets may be one rule with two sources of truth (Major, per
`REVIEW.md`'s severity floors) or a portable skill correctly standing on its
own. Only intent separates them, and intent is not in the skill corpus. The
ranking is a place to look; a human decides.

## The Scheduled Audit

`link-freshness/check.mjs` answers "do the URLs this repository cites still
resolve?" — a question nothing else here asks, because `check-links.mjs`
resolves relative `.md` targets on disk and ignores `http(s)://` entirely. It
exists because the vendor skills are moving off reproduced option tables and
onto a link plus the non-obvious caveat, which trades a table that goes stale
**visibly** for a link that rots **silently**.

```bash
node skills/agent-skill-authoring/scripts/link-freshness/check.mjs --dry-run
node skills/agent-skill-authoring/scripts/link-freshness/check.mjs --help
```

**Only a link confirmed dead fails it** — a 404 or 410 that survives a retry.
A host that rate-limits, blocks datacentre egress, or times out is reported as
`unverifiable` and never affects the outcome, and a permanent redirect is
reported as `moved` without failing. This repository cites roughly 80 hosts,
several of which refuse CI traffic by policy, and an audit that went red
whenever a publisher throttled a runner would be red most weeks.

It ships inside `agent-skill-authoring` rather than at this repository's root:
the rot it catches is a rot in cited skill prose, which is that skill's
subject. What cannot travel with the skill is this repository's wiring, so the
skill states the schedule-only, never-`pull_request` rule as a `MUST NOT` of
its own — a consuming project inherits the argument, not just the code.

### The Scheduled Audit's Never-`pull_request` Rule

`link-freshness.yaml` MUST NOT gain a `pull_request` trigger, and MUST NOT have
its token broadened beyond read-only. It dereferences every URL in the tree —
triggered by a pull request, it would dereference URLs an outside contributor
just wrote, which is the mirror of `@claude review`'s
`--disallowedTools "WebFetch,WebSearch,Task"` denial (see
[Code Review](../operations/code-review.md)). Scheduled, it only ever probes
text already merged. `tests/repository/scheduled-audit-tools.test.mjs` holds
all of that mechanically — the trigger shape, the read-only token, and its
absence from every gate, npm script, and hook.

Being merged makes a URL reviewed; it does not make the **host** honest, so
the audit follows redirects by hand and re-validates every hop — the first
included — against `address-guard.mjs`, which refuses loopback, RFC 1918,
carrier-grade NAT, link-local (`169.254.169.254`), and their IPv6 and
IPv4-mapped equivalents. A refused hop is reported as `unverifiable` and does
not fail the run; `address-guard.mjs` also states the DNS-rebinding window the
check does not close, and why the residual risk is bounded to blind
reachability probing.

Because scheduled workflows run only from the default branch, the audit does
not run on the pull request that changes it. `--dry-run` is the offline
preview, and it is what `npm test` exercises — no test in this repository
probes a live URL.

## The Naive-Directory-Walk Trap

`.claude/skills/` is a directory of symlinks, and `Dirent.isDirectory()` is
**false** for a symlink pointing at a directory — so code that filters
directory entries on it sees an empty root. An empty root is exactly what a
passing, checked-nothing run looks like: `All 0 skill(s) passed` or `no drift`
reads identically to a real pass. Every enumeration in this repository stats
through the link instead of filtering on `isDirectory()`, and anything new
that walks a skill root MUST do the same — otherwise it silently checks
nothing rather than failing loudly.
