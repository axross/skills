# Dev Commands

Apply this reference when choosing which project command to run or when updating the command surface in the project's manifest. The project pins a minimum runtime/toolchain version in its manifest; respect that pin when running or upgrading.

## Application Commands

This command runs the application locally.

| Command         | Purpose                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| `npm run check` | Starts the development server (commonly at a local URL such as `http://localhost:3000`). |

**Guidelines:**

- MUST use `npm run check` for manual verification of UI, route, metadata, and data-driven output changes.

## Quality Commands

These commands enforce formatting and linting.

| Command          | Purpose                                                      |
| ---------------- | ------------------------------------------------------------ |
| `npm run format` | Formats the code and documentation with Prettier.            |
| `npm run lint`   | Runs markdownlint-cli2, including formatting and lint rules. |

**Guidelines:**

- MUST run `npm run format` and `npm run lint` after code or documentation edits.
- SHOULD report skipped quality commands, including the reason and residual risk, before completion.
