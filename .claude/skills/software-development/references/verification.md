# Verification

Apply these guidelines to confirm that a change produces the correct output before considering the task done. This library is Markdown-first — the skills _are_ the deliverable — with a little JavaScript tooling; there is no application server to exercise, so verification is reviewing the rendered documents and running the quality gate.

## Identifying Affected Output Surfaces

Use this table to determine which surfaces a change puts at risk, then verify each one. The rows describe this repository's actual surfaces; keep them current with the library's file layout as it grows.

| Changed area                                                                  | Output surface at risk                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| Prose or examples in a `SKILL.md` or reference file                           | Rendered Markdown; the guidance an agent reads            |
| Skill frontmatter (`name`, `description`, `when_to_use`, invocation controls) | Skill discovery and loading                               |
| Relative links, or cross-skill references named in prose                      | Link integrity; correct routing to the right skill        |
| Adding, renaming, moving, or removing a skill or reference file               | The `AGENTS.md` routing index and parent `SKILL.md` links |
| A runnable script under a skill's `scripts/`                                  | The script's behavior and exit codes                      |
| Root config (`package.json`, lint/format config, hooks, CI workflows)         | The verification gate itself                              |

- A change that touches none of the above — for example an edit isolated to a single reference file's prose with no link or frontmatter impact — still puts the rendered-Markdown surface at risk and is re-read as rendered output.

**Guidelines:**

- MUST map changed files to their at-risk surfaces before choosing the verification path.
- MUST run the aggregate quality gate (`npm run check`) whenever a change touches any surface above, since format, lint, and link integrity are the surfaces this library actually ships.

## Manual Verification

Manual verification is the first line of confirmation; the automated gate is the second. Neither replaces the other — the gate cannot tell whether prose is correct, and reading cannot catch a broken relative link as reliably as the link checker.

**Guidelines:**

- MUST review the rendered Markdown of every changed file — headings, tables, code fences, diagrams, and lists render as intended — since the rendered document is what an agent consumes.
- MUST confirm that a renamed, moved, added, or removed skill or reference file is reflected in the `AGENTS.md` routing index and in every parent `SKILL.md` link, and that no cross-skill reference now names a skill the index no longer lists.
- MUST run any runnable script a change touches and confirm its documented exit codes, rather than assuming the edit preserved its behavior.
- MUST NOT call a documentation change done on the strength of a passing format/lint gate alone; the gate does not read the prose for correctness.
