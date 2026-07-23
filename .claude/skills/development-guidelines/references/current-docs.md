# Current External Documentation

Apply this reference when a change depends on framework, platform, service, or tool behavior that may have changed since the local skill was written. Official docs are part of the implementation context for these surfaces.

## When to Refresh Docs

Use current official docs before changing behavior governed by fast-moving frameworks, services, or tools that the project depends on. The table below lists the tools this library depends on; add rows for any other fast-moving dependency it takes on.

| Surface           | Refresh docs before changing                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Claude Code       | Skill format and frontmatter, hook and settings configuration, slash-command behavior, MCP configuration |
| markdownlint-cli2 | Formatter/linter configuration, suppression syntax, rule names                                           |

**Guidelines:**

- MUST consult current official docs before changing any surface listed in the table.
- MUST use official docs as the primary source; use blog posts, examples, or issues only as secondary context.
- MUST mention the docs consulted in the final summary when the implementation depends on a current-docs decision.
- MUST NOT rely only on memory for APIs, defaults, or behavior that the relevant vendor may have changed.
- SHOULD limit the docs lookup to the smallest surface needed for the task.

## Project-Specific Current-Docs Triggers

Some project areas are especially sensitive because a small mismatch can break skill discovery or the harness binding. List the library's own high-sensitivity config files and entry points here.

**Guidelines:**

- MUST refresh Claude Code docs before changing skill frontmatter or format, hook or settings configuration, slash-command behavior, or MCP configuration.
- SHOULD refresh markdownlint-cli2 docs before changing its configuration files or suppression syntax.
