---
name: quality-assurance-guidelines
description: The reviewer's QA lens on verification evidence, on top of the development verification rules. Covers format/lint proof, manual checks for non-default content and not-found states, skipped checks, and residual risk.
when_to_use: Use when reviewing whether a change has adequate verification evidence — "is this verified", "did this break anything", or "were the required checks run".
user-invocable: false
---

# Quality Assurance Guidelines

Apply these rules when reviewing whether a change has been adequately verified before merge. This is the reviewer's lens — flag missing evidence and link to the developer-facing rule.

## Verification Evidence

See [verification-evidence.md](./references/verification-evidence.md) for:

- Commands run, exit status, and relevant output
- Manual checks matched to changed output surfaces
- Skipped required checks and residual risk
- Second-pass verification after fixing Critical or Major findings

## Lint and Format Gate

See [lint-and-format-gate.md](./references/lint-and-format-gate.md) for:

- The author ran the format and lint commands per the project's software-development practices (code-quality rules)
- No new inline linter suppressions without an inline justification
- No new lint warnings introduced into modified files

## Manual Verification Evidence

See [manual-verification.md](./references/manual-verification.md) for:

- The author exercised non-default content states when the change touches a data-driven surface
- The not-found UI was verified for routing changes
- The dev-server output was checked for new warnings or errors
