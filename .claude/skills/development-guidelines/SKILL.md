---
name: development-guidelines
description: The project's baseline working rules. Covers the format/lint loop, scoped change management, current-docs lookup triggers, run-script commands, source-comment and doc-comment conventions, verification requirements, Conventional Commits, and pull request descriptions.
when_to_use: Apply at the start of EVERY task in this project, even when the user does not mention formatting, linting, comments, doc-comments, dependencies, docs, commands, commit wording, or pull request bodies.
user-invocable: false
---

# Development Guidelines

Apply these rules at the start of every task, regardless of the nature of the work.

## Code Quality

See [code-quality.md](./references/code-quality.md) for:

- The formatter/linter format/lint workflow
- Language compliance requirements
- Doc-comment and line-comment conventions in source files
- Import hygiene

## Change Management

See [change-management.md](./references/change-management.md) for:

- Staying within the scope of the task
- Making incremental, verifiable changes
- Following existing patterns before introducing new ones
- Adding dependencies

## Verification

See [verification.md](./references/verification.md) for:

- Which output surfaces are put at risk by a given change
- Manual verification steps

## Current External Documentation

See [current-docs.md](./references/current-docs.md) for:

- When to consult current official docs for the fast-moving frameworks, services, and tools the project uses
- Which project surfaces are sensitive enough to require a docs refresh before changing them

## Dev Commands

See [dev-commands.md](./references/dev-commands.md) for:

- Development commands
- Format and lint commands

## Commit Messages

See [commit-messages.md](./references/commit-messages.md) for:

- Overall `<type>[scope][!]: <description>` header format
- Required types (`feat`, `fix`) and allowed additional types (`build`, `chore`, `ci`, `docs`, `style`, `refactor`, `perf`, `test`, `revert`)
- Scope, description, body, and footer conventions
- Breaking-change markers (`!` and `BREAKING CHANGE:` footer) and their SemVer correlation
- Pull request titles (the same header format applies to PR titles, not just commits)

## Pull Request Descriptions

See [pull-request-descriptions.md](./references/pull-request-descriptions.md) for:

- What a pull request body contains, and why the "why" leads
- Using the repository's pull request template (`.github/pull_request_template.md`), including bodies authored programmatically
- Issue linking, verification evidence, risk disclosure, and reviewer guidance
- Keeping the description current across review rounds

## Topic-Specific Guidelines

Project-specific topic skills — covering repository structure or any authoring-domain rules — can be added as the library grows. Consult those skills when a change touches the area they own, if they have been defined.

**Guidelines:**

- MUST consult the matching topic skill when implementation touches that area.
- SHOULD load only the references relevant to the changed files or requested behavior.
- MUST defer detailed project rules to the owning topic skill instead of restating them here.
