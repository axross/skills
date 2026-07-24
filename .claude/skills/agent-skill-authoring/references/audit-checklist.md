# Audit Checklist

Apply this reference when auditing a skill tree for structure, discoverability, links, and source-of-truth boundaries.

## Audit Order

A useful audit moves from inventory to mechanics to judgment. Mechanical checks catch broken structure; content review catches overlap, stale assumptions, and missing project-specific guidance.

1. Inventory skills and reference files.
2. Verify skill discovery metadata (`description`/`when_to_use`) and parent `SKILL.md` links.
3. Check frontmatter against the [frontmatter-and-naming](./frontmatter-and-naming.md) policy.
4. Check parent routing-section format, section anatomy, and RFC-2119 guideline bullets.
5. Check relative links outside code fences resolve, and that cross-skill references are topic-based rather than path links into another skill.
6. Review content ownership and project fit.
7. Report prioritized improvement items.

**Guidelines:**

- MUST inventory every `SKILL.md` and reference file under the skill root.
- MUST verify each skill directory has exactly one parent `SKILL.md`.
- MUST verify every reference file is linked from its parent `SKILL.md`.
- SHOULD run the bundled `scripts/check-skill.mjs` validator before manual review, so mechanical frontmatter, naming, linkage, and routing failures surface first.
- SHOULD audit mechanical structure before judging writing quality.
- SHOULD report improvement items in priority order instead of listing every small observation.

## Runnable Structure Validator

Mechanical structure checks should be automated so an audit spends its judgment on content, not on eyeballing frontmatter. This skill bundles `scripts/check-skill.mjs`, a dependency-light Node validator (standard library only) that checks each skill's frontmatter and structure in one command instead of by hand, and reports every failure.

**Example:**

```sh
# One skill, several skills, or a whole skill root (globs expand to skill dirs).
node .claude/skills/agent-skill-authoring/scripts/check-skill.mjs .claude/skills
```

It verifies, per skill: the frontmatter block parses; `name` is kebab-case, within 64 characters, and matches the directory; `description` is present and within 1,024 characters; `description` + `when_to_use` stays within 1,536 characters when `when_to_use` is present; every `references/*.md` file is linked from `SKILL.md` (no orphan references); and no routing-section bullet begins with an RFC-2119 keyword. It exits 0 when every skill passes, 1 when any check fails, and 2 on bad invocation or an unreadable skill.

**Guidelines:**

- SHOULD run `scripts/check-skill.mjs` over the changed skills before manual review, so mechanical failures surface first and the audit can focus on content.
- MUST treat exit 1 as a blocker — a structural failure a discovery runtime depends on — and exit 2 as a bad invocation or unreadable skill to fix before trusting the result.
- MUST fix every reported failure, or record why the skill is a deliberate, documented exception.
- MAY extend the validator when the project adopts a new mechanical rule, keeping it dependency-light so it runs anywhere the skill is installed.

## Structural Checks

Structural checks should be repeatable. The bundled validator above automates the frontmatter, naming, reference-linkage, and routing-format checks; run it first, then use the list below for the checks it does not cover — invocation-control policy, `**Guidelines:**`-block presence, RFC-2119 guideline bullets, and cross-skill reference style — and when auditing by hand. All checks should ignore fenced code blocks so embedded examples do not create false positives.

**Example:**

```sh
find .claude/skills -name '*.md' -print | sort
```

**Guidelines:**

- MUST check that every skill's frontmatter parses as YAML, its `name` matches its directory, and it carries both a `description` and a `when_to_use` within the length caps (1,024 for `description`; 1,536 combined), per [frontmatter-and-naming.md](./frontmatter-and-naming.md).
- MUST check the invocation-control policy: guideline skills carry `user-invocable: false`; workflow entry-point skills carry `user-invocable: true` plus an `argument-hint`, and declare `arguments` only for discrete single-token parameters.
- MUST check that every parent `SKILL.md` reference-routing section uses `## Section/Topic Name`, `See [file.md](./references/file.md) for:`, and descriptive bullets without RFC-2119-style requirement keywords.
- MUST check that every substantive rule section has a `**Guidelines:**` block after its explanation or demonstration.
- MUST check that every guideline bullet begins with an RFC-2119 keyword.
- MUST check that relative Markdown links outside fenced code blocks resolve; this skill's `scripts/check-links.sh` automates the check (see [cross-referencing.md](./cross-referencing.md)).
- MUST check that cross-skill references are topic-based and discovery-resolvable, not path links into another skill's `SKILL.md` or `references/` files.
- SHOULD check for stale plain labels such as `Guidelines:` or `Example:` when the project standard is bold subheading-like labels.
- SHOULD check for stale fenced `text` examples when a blockquote or table would be clearer.

## Content Review

Content review asks whether each skill owns one coherent responsibility and gives the agent project-specific information it would not reliably infer.

**Review Questions:**

> Does this rule belong here, or should this skill link to a source-of-truth skill?

> Does the guidance describe this repository, not the project it was imported from?

> Does the skill explain a local command, fragile behavior, or convention that affects real work?

**Guidelines:**

- MUST identify duplicated source-of-truth rules across sibling skills.
- SHOULD treat a self-contained `skills/`-sourced skill's restatement of a rule a repo-native skill owns as the sanctioned Portable Source Exception (see [scoping-and-mece.md](./scoping-and-mece.md)) rather than a defect, provided it defers to the owner where present.
- MUST identify stale project assumptions, old framework guidance, missing commands, or paths that do not exist.
- SHOULD flag generic advice that does not add project-specific value.
- SHOULD prefer a topic-based cross-reference over copied doctrine when another skill owns the detailed rule.
- SHOULD note where examples, tables, diagrams, or command snippets would make abstract guidance easier to apply.

## Report Shape

The audit report should separate pass/fail mechanics from improvement planning. This keeps the user from confusing structural breakage with optional polish.

**Guidelines:**

- MUST state which structural checks passed, failed, or were not run.
- MUST list broken links, missing guideline blocks, or non-RFC guideline bullets as blockers.
- SHOULD group improvement items by skill or source-of-truth theme.
- SHOULD identify a recommended implementation order when multiple skills need coordinated edits.
- MUST state whether files were changed or the audit was analysis-only.
