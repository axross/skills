# Skill Portability

Every skill in this repository is a distributable skill: it installs into
other projects, and [agent-skill-authoring](../../skills/agent-skill-authoring/SKILL.md)
and [agent-skill-management](../../skills/agent-skill-management/SKILL.md) own
what that means in general — a distributable skill names no file, command, or
layout belonging to the repository it was written in, and carries no
`count:` marker (see [Marked Counts](./marked-counts.md)). What follows is
this repository's own answer: which of its configuration surfaces a skill's
portability actually depends on, and which host reads less of a skill than
the other.

## What a Skill Deliberately Does Not Carry

A distributable skill is not only barred from naming this repository's files —
it is also barred from asserting things about a host it cannot inspect. The
case this repository has actually hit is precedence: no skill here states
whether an instruction the launching runtime injected outranks a project
mandate, because a skill loaded into an unknown host cannot see either side of
that comparison.

The consequence is real and worth stating rather than leaving implicit. An
installing project receives the gates — a human-approved plan before edits,
required verification, mandatory independent review, a ready state only after
convergence — and receives nothing saying that a runtime framing the task as
"just commit and push" does not lower them. That statement is the installing
project's to write, in the entry file of its own host;
[README.md](../../README.md#getting-started) tells a consumer so, and this
repository's [`CLAUDE.md`](../../CLAUDE.md) is the worked example. It lives
there rather than in a skill because the entry file of the host doing the
injecting is the only document positioned to see both sides of the comparison;
a skill stating the precedence would be asserting something about a host it
cannot see, in every project that installs it.

The general form: where a rule needs to compare something inside the skill
against something only the host knows, the skill states its own side and the
host's entry file or operations guidance states the comparison. A per-host
instrument — a question tool, a wait mechanism, a delegation actor — follows the
same split, which is why
[Claude Code Execution](../operations/claude-code-execution.md) and
[Amp Execution](../operations/amp-execution.md) exist beside the skills rather
than inside them.

## The Description Byte Cap and Codex's Truncation

Every skill here carries Claude Code's `user-invocable` extension, but none
carries `when_to_use`: a trigger placed only in that extension would be
invisible to other hosts. The shared discovery trigger lives in `description`.

Codex reads a skill's `name` and `description` and nothing else. Codex refuses to
load a skill whose `description`
exceeds 1,024 bytes, and
[`check-skill-frontmatter.mjs`](../../skills/agent-skill-authoring/scripts/check-skill-frontmatter.mjs)
enforces that cap in bytes rather than characters, matching what Codex actually
counts. Codex also truncates per-skill descriptions to fit its whole listing
into a context budget, so the front of a `description` is the part that
reliably arrives — every skill here front-loads its trigger for that reason.

Codex's default sandbox additionally runs commands with network disabled. Of
the scripts bundled across this repository's skills, that limitation affects
only `link-freshness/check.mjs`, and its `--dry-run` mode needs no network.

## Configuration Surfaces That Fail Globally

A small mismatch in one of these breaks skill discovery outright for every
skill at once, not just one rendered page — refresh the owning host's current
docs before editing one, per Fast-Moving Dependencies below:

- Any `SKILL.md` frontmatter — a malformed block, or a field Claude Code or
  Codex parses differently than expected, stops that skill from loading.
- `.claude/settings*.json` and the hooks under `.claude/hooks/` — these
  configure how every Claude Code session in this repository starts, not one
  skill's behavior.
- `.markdownlint-cli2.jsonc`, `.prettierrc.json`, and `.prettierignore` — a
  change here changes what every Markdown file in the repository is checked
  and formatted against, skills included.

## Adding a Dependency

A dependency added here is a supply-chain decision before it is a technical
one — which is why [AGENTS.md](../../AGENTS.md) singles this surface out for a
human reviewer in addition to the independent review. The validators a skill
bundles import nothing at all, so the dependency list holds tools a
contributor runs rather than code the library imports at runtime, and anything
joining it is weighed on what it drags in rather than on how well known it is.

The one runtime dependency this repository has taken is the worked example.
`@cfworker/json-schema`, pinned at 4.1.1, validates a scenario against
`tools/evaluation/scenario.schema.json`: no transitive dependencies, native
ESM, draft 2020-12 including the two keywords that schema actually leans on.
`ajv` — the ecosystem's standard, and the better-known answer — was rejected
because it brings four transitive packages and is CommonJS, both paid
permanently to buy compilation speed that matters to a service validating on
every request and not to a validator run once per process over fewer than
thirty documents. Writing an evaluator by hand was rejected too: it would
have meant maintaining a partial implementation of a published specification,
when the point of writing standard JSON Schema is that a tool outside this
repository reads the same file the same way. What that trades away is reach —
a defect in the smaller package is likelier to be found here first than
already fixed upstream — bounded by a validator that runs offline, over files
this repository authors, gating no deployment, and swappable at one import
and one `validate` call because the schema itself is standard.

## Fast-Moving Dependencies

Some dependencies move fast enough that memory of their configuration surface
is unreliable. Consult the current official docs before changing behavior
these govern, rather than recalling a prior version's rules:

| Dependency                   | Refresh docs before changing                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Claude Code                  | Skill format and frontmatter, hook and settings configuration, slash-command behavior, MCP configuration |
| markdownlint-cli2 / Prettier | Lint and format configuration, suppression syntax, rule names                                            |
| Vitest                       | Suite configuration, runner and matcher APIs, CLI flags                                                  |
