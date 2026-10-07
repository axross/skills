# CI Actions

This repository selects remote actions by full commit SHA, including `actions/*`.
[Application Security's supply-chain guidance](../../skills/application-security/references/supply-chain.md#ci-action-identity-and-exposure)
owns the identity and exposure judgment; this procedure records how maintainers
resolve and update this repository's pins. [Development Workflow](./development-workflow.md)
and [GitHub Delivery](./github-delivery.md) retain the approval and publication gates.

## Resolve the selected release

These refs were verified against each action's original repository on 2026-10-07.
Each exact release resolves to the same commit as the previously selected major
tag; this conversion changes identity selection, not the action version:

| Original repository                                                               | Previous ref | Release label | Commit                                     |
| --------------------------------------------------------------------------------- | ------------ | ------------- | ------------------------------------------ |
| [actions/checkout](https://github.com/actions/checkout)                           | v4           | v4.4.0        | `11d5960a326750d5838078e36cf38b85af677262` |
| [actions/setup-node](https://github.com/actions/setup-node)                       | v4           | v4.4.0        | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| [actions/upload-artifact](https://github.com/actions/upload-artifact)             | v4           | v4.6.2        | `ea165f8d65b6e75b540449e92b4886f43607fa02` |
| [actions/download-artifact](https://github.com/actions/download-artifact)         | v4           | v4.3.0        | `d3f86a106a0bac45b974a628896c90dbdf5c8093` |
| [actions/github-script](https://github.com/actions/github-script)                 | v7           | v7.1.0        | `f28e40c7f34bde8b3046d885e986cb6290c5673b` |
| [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) | v1           | v1.0.244      | `58985842b834ed26087302ba27d07bc24ca8697a` |

Resolve both refs from the original repository, not a fork, release title or
copied example. For instance:

```bash
git ls-remote https://github.com/anthropics/claude-code-action.git \
  refs/tags/v1 'refs/tags/v1^{}' \
  refs/tags/v1.0.244 'refs/tags/v1.0.244^{}'
```

An annotated tag reports a tag object and a peeled `^{}` commit. The `v1` tag
object at that inspection was `4e6a1978d79d61548994ed4e426541b3a0af08fb`,
not the executable commit in the table. Maintainers MUST use the peeled commit
when present, and the direct commit for a lightweight tag. If the ref is absent
or its object cannot be established as a commit, stop rather than guess a pin.

## Update a pin deliberately

Maintainers MUST follow this sequence for an action update:

1. Choose the intended release in the tracking plan. Do not replace the selected
   major with a newer major merely to obtain a SHA.
2. Resolve the exact tag as above and inspect the selected commit's `action.yml`,
   entrypoints, nested actions and fetched executable dependencies. Review release
   changes against this repository's inputs, runtime and job exposure; a matching
   ref alone is not a code audit.
3. Record the repository, tag, resolved commit, date and source-inspection evidence
   with the change. Update the inventory here and every use of that selected
   action together, retaining the exact release tag as a trailing YAML comment.
4. Run the documented format, lint and aggregate checks in
   [README](../../README.md#commands). The existing suite's action-pin check is
   offline: it parses workflow mappings using the existing Markdown toolchain's
   YAML parser and compares remote job/step references with labeled block-style
   `uses` entries. Quoted keys and scalar values are accepted; other forms that
   cannot be matched to their release comment fail closed rather than disappear
   from inspection. It rejects mutable refs, short SHAs and missing labels, but
   cannot authenticate the label-to-commit mapping.
5. Publish through the approved draft-PR and external-review route, inspect actual
   PR checks, and leave merge to the human. Scheduled and issue-comment workflows
   do not exercise a proposed pin merely because that PR's checks pass; their
   default-branch versions remain in effect until merge. A manual dispatch or
   reviewer trigger requires its own matching authorization.

## Bound the evidence

At the selected Claude commit, `action.yml` invokes a SHA-pinned setup-bun action
and checked-in base-action code, not a mutable remote base-action. The wrapper
still fetches the Claude CLI installer and installs configured marketplace
plugins. The workflow's marketplace URL is unchanged. Setup-node can likewise
fetch a Node distribution; its npm cache contains package-manager content, not
`node_modules`. These pins do not freeze every executable download.

Source inspection also identifies credentials beyond explicitly assigned
environment tokens: checkout defaults to `github.token` and persisted Git
credentials; the Claude wrapper exchanges OIDC for an external App token;
artifact upload/download use runner runtime credentials. Evaluation's
`permissions: {}` jobs can produce artifacts consumed by write-enabled `land`.
Pinning the transport action does not admit the payload. The concrete evaluation
content boundary is a separate concern from this procedure.

Maintainers MUST label ref/source inspection as static evidence, not live CI
success, verified secret provisioning, complete token-scope proof or exploit
demonstration. A green repository suite establishes its checked contracts, not
artifact provenance or complete supply-chain isolation.
