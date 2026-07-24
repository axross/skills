---
name: software-development
description: The ability to make a well-formed, verified change in this project — the baseline discipline every task runs on. Covers the format/lint loop, scoped and incremental change management, verifying the surfaces a change puts at risk, refreshing current docs for fast-moving dependencies, the run-script commands, source-comment and doc-comment conventions, Conventional Commits (with a runnable header validator), and pull request descriptions.
when_to_use: Apply at the start of EVERY task in this project — implementing, refactoring, running commands, preparing commits, or writing a pull request body — even when the request never mentions formatting, linting, comments, doc-comments, dependencies, docs, commands, commit wording, or pull request descriptions.
user-invocable: false
---

# Software Development

This skill equips you to make a change in this project the way the project expects: formatted and linted, kept to the smallest scope that satisfies the task, verified against the surfaces it puts at risk, grounded in current docs where a dependency moves fast, and landed as a conforming commit and pull request. Reach for it on every task — it is the baseline the other, more specific skills build on.

Load only the reference sections a given task touches; each one below routes to the detail.

## Code Quality

See [code-quality.md](./references/code-quality.md) for:

- running the format → lint → fix → re-lint loop after any change
- language compliance and import hygiene
- doc-comment and line-comment conventions in source files

## Change Management

See [change-management.md](./references/change-management.md) for:

- staying within the scope of the task
- making incremental, independently verifiable changes
- following existing patterns before introducing new ones
- weighing whether to add a dependency

## Verification

See [verification.md](./references/verification.md) for:

- mapping changed files to the output surfaces they put at risk in this library
- the manual verification steps that confirm a change before it is called done

## Current External Documentation

See [current-docs.md](./references/current-docs.md) for:

- when to consult current official docs for the fast-moving tools this project uses
- which project surfaces are sensitive enough to require a docs refresh before changing them

## Dev Commands

See [dev-commands.md](./references/dev-commands.md) for:

- the format, lint, link, and aggregate-check commands
- the runnable commit-message validator to self-check a header before committing

## Commit Messages

See [commit-messages.md](./references/commit-messages.md) for:

- the `<type>[scope][!]: <description>` header format and the allowed types
- scope, description, body, and footer conventions
- breaking-change markers and their SemVer correlation
- running the bundled Conventional Commits header validator
- pull request titles (the same header format applies to them)

## Pull Request Descriptions

See [pull-request-descriptions.md](./references/pull-request-descriptions.md) for:

- what a pull request body contains, and why the "why" leads
- reproducing the repository's pull request template in an API-authored body
- issue linking, verification evidence, risk disclosure, and reviewer guidance
- keeping the description current across review rounds

## Topic-Specific Skills

Project-specific topic skills — covering repository structure or any authoring-domain rules — can be added as the library grows. Consult those skills when a change touches the area they own, if they have been defined.

**Guidelines:**

- MUST consult the matching topic skill when a change touches the area that skill owns.
- SHOULD load only the references relevant to the changed files or requested behavior.
- MUST defer detailed project rules to the owning topic skill instead of restating them here.
