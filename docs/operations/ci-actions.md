# CI Actions

This repository normally uses version tags for actions from trusted publishers.
[Application Security's supply-chain guidance](../../skills/application-security/references/supply-chain.md#ci-action-identity-and-exposure)
owns the identity and exposure judgment; this procedure records how maintainers
select and update this repository's references. [Development Workflow](./development-workflow.md)
and [GitHub Delivery](./github-delivery.md) retain the approval and publication gates.

## Select a reference

The following official distributions are trusted here. Their major tags allow
compatible updates without requiring maintainers to resolve and record a new SHA
for each release. This repository does not require full SHAs for these actions:

| Original repository                                                               | Selected ref |
| --------------------------------------------------------------------------------- | ------------ |
| [actions/checkout](https://github.com/actions/checkout)                           | `v4`         |
| [actions/setup-node](https://github.com/actions/setup-node)                       | `v4`         |
| [actions/upload-artifact](https://github.com/actions/upload-artifact)             | `v4`         |
| [actions/download-artifact](https://github.com/actions/download-artifact)         | `v4`         |
| [actions/github-script](https://github.com/actions/github-script)                 | `v7`         |
| [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) | `v1`         |

Trust is attached to these action repositories, not every repository under a
similarly named account. Maintainers MUST assess a newly introduced action
before adding it to the trusted set in the reference-policy test and this
inventory. Other remote actions MUST use a full SHA with a release label unless
that trust decision has been made. Local actions are outside this requirement.

Tags remain mutable, even when the publisher is trusted. Use a full SHA when
immutable selection is needed; a trusted tag does not claim the same guarantee.

## Update a reference

Maintainers MUST preserve the selected major unless the approved change calls
for an upgrade, review release changes against this repository's inputs and job
exposure, and update this inventory and every use together. Trusted version tags
need no tag-to-SHA evidence or trailing release-label comment.

For an action selected by SHA, resolve the release from its original repository,
not a fork, release title or copied example. For instance:

```bash
git ls-remote https://github.com/anthropics/claude-code-action.git \
  refs/tags/v1.0.244 'refs/tags/v1.0.244^{}'
```

An annotated tag reports a tag object and a peeled `^{}` commit. Maintainers
MUST use the peeled commit when present, and the direct commit for a lightweight
tag; stop if the ref is absent or cannot be established as a commit. Inspect the
selected action source and record the repository, release, resolved commit, date
and inspection evidence with the change. Keep the exact release label as a
trailing YAML comment on each SHA reference.

Run the documented format, lint and aggregate checks in
[README](../../README.md#commands). The reference-policy check is offline: it
accepts major and exact version tags within each trusted action's selected
major, or full SHAs with release labels. An approved major upgrade MUST update
the test's accepted major alongside this inventory and the workflows.
It checks actual job/step entries, including
quoted keys and values, not unrelated environment keys. For SHA references it
requires a block-style `uses` entry so each release comment stays at its own
mapping location. It rejects minor-only tags such as `v4.4`, other tags, branches,
short SHAs and unlabeled SHAs. It cannot establish ref existence, publisher trust
or label-to-commit mapping; version references are literal refs, not ranges.

Publish through the approved draft-PR and external-review route, inspect actual
PR checks, and leave merge to the human. Scheduled and issue-comment workflows
do not exercise proposed references merely because that PR's checks pass; their
default-branch versions remain in effect until merge. A manual dispatch or
reviewer trigger requires its own matching authorization.

## Bound the evidence

Action reference selection does not freeze executable dependencies fetched by
the action. The Claude wrapper can fetch the CLI installer and marketplace
plugins, and setup-node can fetch a Node distribution. Neither version tags nor
SHA pins authenticate those downstream downloads.

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
