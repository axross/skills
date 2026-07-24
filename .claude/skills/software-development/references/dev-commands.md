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

## Commit-Message Self-Check

Nothing in the repository — no commit hook, no CI check — rejects a malformed commit message, so the format is self-enforced. This skill bundles `scripts/check-commit-message.mjs`, a dependency-light Node validator (standard library only) that checks a Conventional Commits header against the rules in [commit-messages.md](./commit-messages.md).

**Command:**

```bash
# From a message file, or piped on stdin:
node .claude/skills/software-development/scripts/check-commit-message.mjs .git/COMMIT_EDITMSG
printf 'feat(lang): add Polish language' | node .claude/skills/software-development/scripts/check-commit-message.mjs
```

**Guidelines:**

- SHOULD run `check-commit-message.mjs` on a commit message or pull request title before committing, since nothing else enforces the header format.
- MUST treat exit `1` as a malformed header to fix and exit `2` as a bad invocation (no message supplied); exit `0` means the header conforms.
