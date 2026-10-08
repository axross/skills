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
it is also barred from assigning a priority order to instructions in a host it
cannot inspect. The active host's actual instruction hierarchy determines that
order. Host entry guidance MUST explain how to apply that hierarchy, not claim
authority to define or override it. A project's description of an instruction
as generic framing does not lower its priority; its actual source and priority
determine how a conflict is resolved.

An installing project receives the gates — a human-approved plan before edits,
required verification, mandatory independent review, a ready state only after
convergence — within that hierarchy and the tool's usage conditions. Compatible
gates remain applicable. A gate that cannot be satisfied without violating a
higher-priority instruction or tool condition MUST be reported as unmet, not
waived or resolved by declaring project policy superior. Placing a declaration
in an entry file changes neither its authority nor the active host's rules.

The skill states its own constraints; host entry or operations guidance explains
their application using the actual host instructions. This keeps host-specific
comparisons out of an installable skill without making the entry file an
authority over the runtime. A per-host instrument — a question tool, a wait
mechanism, a delegation actor — follows the same split, which is why
[Claude Code Execution](../operations/claude-code-execution.md) and
[Amp Execution](../operations/amp-execution.md) exist beside the skills rather
than inside them.

This repository's [`CLAUDE.md`](../../CLAUDE.md) and
[session-start reminder](../../.claude/hooks/session-start.sh) still contain
blanket project-over-runtime declarations. Their correction is separate and
unresolved; they are not worked examples of this boundary.

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
