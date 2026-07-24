# Current External Documentation

Apply this reference when a change depends on framework, platform, service, or tool behavior that may have changed since the local skill was written. Official docs are part of the implementation context for these surfaces.

## When to Refresh Docs

Use current official docs before changing behavior governed by fast-moving frameworks, services, or tools that the project depends on. The table below lists the tools this library depends on; add rows for any other fast-moving dependency it takes on.

| Surface                      | Refresh docs before changing                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Claude Code                  | Skill format and frontmatter, hook and settings configuration, slash-command behavior, MCP configuration |
| markdownlint-cli2 / Prettier | Lint and format configuration, suppression syntax, rule names                                            |

**Guidelines:**

- MUST consult current official docs before changing any surface listed in the table.
- MUST use official docs as the primary source; use blog posts, examples, or issues only as secondary context.
- MUST mention the docs consulted in the final summary when the implementation depends on a current-docs decision.
- MUST NOT rely only on memory for APIs, defaults, or behavior that the relevant vendor may have changed.
- SHOULD limit the docs lookup to the smallest surface needed for the task.

## Project-Specific Sensitive Files

Some files are especially sensitive because a small mismatch breaks skill discovery or the toolchain rather than just a single document. Before changing one, refresh the docs for the tool named in the table above; this list names _which_ files trigger that refresh, so the table's rules do not have to be re-derived per file.

- **Claude Code** — any `SKILL.md` frontmatter, `.claude/settings*.json`, and the hooks under `.claude/hooks/`.
- **markdownlint-cli2 / Prettier** — `.markdownlint-cli2.jsonc`, `.prettierrc.json`, and `.prettierignore`.

**Guidelines:**

- MUST refresh the relevant tool's docs (per the table above) before changing any file listed here, since a mismatch here breaks discovery or the gate, not just one rendered page.
