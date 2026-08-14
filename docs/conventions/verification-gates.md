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

### The discovery evaluation, as a reporting tool

`tools/evaluation/readings/discovery/evaluate.mjs` answers "does a prompt actually surface the
right skills?" — the first check here that measured a skill outcome rather
than a textual property. It cannot gate for three independent reasons: it is
non-deterministic, it costs real money per probe, and it needs a secret that
fork pull requests do not receive.

**A probe reads the project before it chooses, which is the whole point.** A
prompt states the problem in the words of whoever has it — no path, no
library, no vendor — so the model has to open the codebase to route, exactly
as it would for a real request. A situated probe materializes a mock project
and asks that prompt with every installed skill competing, with `Read`,
`Glob`, and `Grep` permitted and `Bash` and the editing tools withheld — a
probe that starts doing the work would be measuring the other axis at this
one's prices. **One mode does not read a
project, and it is the one that handles untrusted text**: evaluating a pull
request's changed `SKILL.md` files runs in a bare workspace with only the
`Skill` tool, no filesystem, no shell, no credentials, because that mode reads
prose written by someone outside the repository. What bounds it is that tool
set rather than its turn cap — the cap is 2, enough for one `Skill` call to
finish and not a budget for a second, unrelated one, and raising it from 1
changed how much the model may say, never what it may reach. The two modes are
mutually exclusive per dispatch, and the instrument refuses the combination
rather than documenting it.

**Spending is bound by refusal rather than by exhaustion, and a refusal is a
finding rather than a prompt to raise the cap.** How admission projects that
cost before any probe runs, the workflow, its inputs, and what a run records
are in [Evaluation Dispatch](../operations/evaluation-dispatch.md).

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
