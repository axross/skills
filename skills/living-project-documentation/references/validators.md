# Validators

## Repository checks

For an OKF check in a standalone installation, set `skill_dir` to the
installed skill directory and run
`npm ci --prefix "$skill_dir/scripts" --ignore-scripts` to install the pinned
parsers. Legacy checks need only Node.

The bundled Node commands default to `./docs` and accept another documentation
directory as the positional argument. Without a root `index.md` they leave an
unadopted directory alone.

| Command                | Question                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-index.mjs`      | Can a reader reach every page from the root index? An OKF route may pass through nested indexes. The legacy layout lists pages directly.           |
| `check-references.mjs` | Do local Markdown links, fragments and OKF path fields resolve? The local checker also checks rendered HTML links and images for export usability. |
| `check-glossary.mjs`   | Does each legacy flat spec have a matching glossary heading? OKF type names do not imply a glossary pairing.                                       |

The checks recognize an OKF bundle from the root version declaration or typed
concept frontmatter. In OKF mode a missing type on a living page is an upkeep
finding. OKF itself permits untyped Markdown. Identify an intentional untyped
evidence source by its exact bundle-relative path when checking the index.

```bash
node "$skill_dir/scripts/check-index.mjs" --evidence evidence/accepted.md docs
node "$skill_dir/scripts/check-references.mjs" docs
node "$skill_dir/scripts/check-glossary.mjs" docs
```

A companion can cite its source in the body or in a local
`sources[].resource` field.

**Guidelines:**

- MUST run all three checks on a migrated tree.
- MUST identify each intentional untyped evidence file with a separate `--evidence` argument and verify its warning against the companion and original bytes. Other findings remain actionable.

## Check the export independently

A checkout can provide files or parser dependencies that a recipient of a
standalone bundle will never see. The project's navigation checks and the
upstream validator examine different properties. With Python and PyYAML
installed, run the [pinned v0.3 validator](https://github.com/open-knowledge-format/open-knowledge-format/blob/527e81aff55992be21507e97004286789126f88c/skills/okf-generate/scripts/validate.py)
from its checkout.

```bash
python /path/to/pinned/skills/okf-generate/scripts/validate.py --json docs
```

**Guidelines:**

- MUST run project gates in the checkout. Run the three navigation checks and the pinned upstream validator on the original bundle and again on a standalone copy in an empty directory outside the checkout.
- MUST include all distributed evidence and linked assets in the export and compare their hashes with the originals.
- MUST trace an index route and a moved fragment offline, and resolve each external source against its published location or pinned revision.
- MUST report checkout and export results separately, naming the validator revision, expected warning paths and reasons, and any unresolved sources or routes.
- SHOULD exercise the example or compare the claim with its implementation when checking runtime behavior.
