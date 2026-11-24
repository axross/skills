# Validators

## Repository checks

For an OKF check in a standalone installation, set `skill_dir` to the
installed skill directory and run
`npm ci --prefix "$skill_dir/scripts" --ignore-scripts` to install the pinned
parsers. Legacy checks need only Node.

The bundled Node commands default to `./docs` and accept another documentation
directory as the positional argument. Without a root `index.md` they leave an
unadopted directory alone. Run all three when migrating a tree.

| Command                | Question                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `check-index.mjs`      | Can a reader reach every page from the root index? An OKF route may pass through nested indexes. The legacy layout lists pages directly. |
| `check-references.mjs` | Does each checked local link resolve? Check a moved heading and its callers after extraction.                                            |
| `check-glossary.mjs`   | Does each legacy flat spec have a matching glossary heading? OKF type names do not imply a glossary pairing.                             |

The checks recognize an OKF bundle from the root version declaration or typed
concept frontmatter. In OKF mode a missing type on a living page is an upkeep
finding. OKF itself permits untyped Markdown. Identify an intentional untyped
evidence source by its exact bundle-relative path when checking the index:

```bash
node "$skill_dir/scripts/check-index.mjs" --evidence evidence/accepted.md docs
node "$skill_dir/scripts/check-references.mjs" docs
node "$skill_dir/scripts/check-glossary.mjs" docs
```

Repeat `--evidence` for each such file. Review the warning against the original
bytes and its companion concept. A named exception must leave all unrelated
findings visible.

## Check the export independently

1. In the checkout, run project gates, the three checks above and the pinned
   upstream validator. For the v0.3 revision linked below, with Python and
   PyYAML installed, run
   `python /path/to/pinned/skills/okf-generate/scripts/validate.py --json docs`.
   Read errors and warnings, including the path attached to each untyped-file
   warning. Report expected exceptions by path and reason. Unknown valid
   concept kinds are part of the format.
2. Export just the distributed bundle to an empty directory outside the
   checkout, including all linked assets and immutable evidence. Repeat the
   same checks against that directory. Compare evidence and asset hashes with
   the originals. Trace at least one index route and a moved fragment offline.
3. Resolve each source that leaves the bundle against its published location
   or pinned revision. A relative path that escapes the bundle cannot serve
   an OKF consumer, even if project tools can open it in the checkout.
4. Record the two outcomes separately, including the revision of the validator,
   named warnings and any source or route that could not be checked. A clean
   structural check does not establish that a page agrees with runtime behavior;
   exercise the example or compare it with the governing implementation.

Use the [pinned upstream validator](https://github.com/open-knowledge-format/open-knowledge-format/blob/527e81aff55992be21507e97004286789126f88c/skills/okf-generate/scripts/validate.py)
for format validation alongside the project's navigation rules.
