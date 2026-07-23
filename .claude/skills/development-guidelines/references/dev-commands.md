# Dev Commands

Apply this reference when choosing which project command to run or when updating the command surface in the project's manifest. The project pins a minimum runtime/toolchain version in its manifest; respect that pin when running or upgrading.

## Quality Commands

These commands enforce formatting, linting, and relative-link integrity. This library has no development server; `npm run check` is the aggregate verification gate.

| Command          | Purpose                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `npm run format` | Formats the documentation and config files with Prettier.                                   |
| `npm run lint`   | Runs markdownlint-cli2, including formatting and lint rules.                                |
| `npm run links`  | Checks relative-link integrity across Markdown files (`check-links.sh`).                    |
| `npm run check`  | Runs the full verification gate: Prettier check, markdownlint, and the relative-link check. |

**Guidelines:**

- MUST run `npm run format` and `npm run lint` after code or documentation edits.
- MUST run the relative-link integrity check (`npm run links`, or `npm run check` for the full gate) after changing links, file paths, or skill locations.
- SHOULD report skipped quality commands, including the reason and residual risk, before completion.
