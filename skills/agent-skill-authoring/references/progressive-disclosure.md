# Progressive Disclosure

Apply this reference when deciding whether to split a `SKILL.md` into reference files, how to wire those files, and when a small skill should remain a single file.

## The Load-Bearing Test

`SKILL.md` states the test itself, as a rule — which is where a load-bearing rule belongs, so this section elaborates it rather than repeating it. The table sorts a topic's content into the two sides that rule names, and every section below applies that sorting, including which side wins when both could otherwise state the same thing.

| Load-bearing — belongs in `SKILL.md`                             | Elaboration — belongs in `references/`                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| the rule statement itself, and its RFC-2119 bullets              | worked examples, and the code that shows the rule applied                |
| a fixed order, list, or closed set the output must match         | rationale, and what was rejected                                         |
| a constraint whose violation is not self-evident from the output | edge cases, platform adapters, and per-option tables consulted on demand |

## References Directory Pattern

Progressive disclosure keeps discovery cheap and detail available. The standard split layout is a parent `SKILL.md` plus Markdown topic files directly under a `references/` subdirectory. The parent routes agents to the right reference, and carries a load-bearing rule's own statement; each reference carries what elaborates a topic — worked examples, edge cases, rationale — per the test above.

```
skill-name/
├── SKILL.md
└── references/
    ├── topic-one.md
    └── topic-two.md
```

**Guidelines:**

- MUST use either a single `SKILL.md` or a short `SKILL.md` plus one-level-deep topic references under `references/`.
- MUST use `references/` as the subdirectory name for split Markdown topic files unless the host project explicitly establishes a different convention.
- MUST keep reference files directly under `references/`; do not create deeper reference nesting such as `references/security/input-validation.md`.
- SHOULD keep parent `SKILL.md` focused on scope, routing, when to load each reference, and any load-bearing rule the test above assigns to it.
- MUST move a topic's elaboration — the right-hand column of the load-bearing test above — into reference files once progressive disclosure is introduced; a load-bearing rule's own statement and its RFC-2119 bullets stay in `SKILL.md` regardless of the split.
- SHOULD keep examples, edge cases, lengthy checklists, and topic-specific procedures in reference files rather than in the parent `SKILL.md`.

## Size Thresholds

Size thresholds are review signals, not mechanical quotas. When a skill crosses them, the reader is likely paying too much context to find the relevant rule.

**Guidelines:**

- SHOULD keep `SKILL.md` under about 500 lines and 5,000 tokens.
- SHOULD split or subdivide a skill when a section exceeds the section-length ceiling defined in [scoping-and-mece.md](./scoping-and-mece.md).
- SHOULD split when distinct subtopics emerge that an agent can load independently.
- SHOULD keep each reference file under about 500 lines.
- SHOULD split an oversized reference into sibling references instead of nesting deeper.

## When Not to Split

Splitting adds indirection. A small skill that is easy to scan should stay single-file even if neighboring skills use references.

**Guidelines:**

- MUST NOT split a compact skill purely for symmetry with other skills.
- SHOULD inline a skill that has only one tiny reference file.
- SHOULD avoid reference files shorter than about 30 lines unless the topic is unusually fragile.
- MUST treat progressive disclosure as a remedy for bloat or topic separation, not as a mandatory layout.

## Wiring Reference Files from the Index

The index should let the agent decide what to load without opening every reference. In a split skill, each reference-routing section in `SKILL.md` should use a predictable shape: a topic heading, one `See [file.md](./references/file.md) for:` line, and plain descriptive bullets that name situations, practical use cases, or specific conditions.

**Example:**

```markdown
## Input Validation

See [input-validation.md](./references/input-validation.md) for:

- changing input schemas or URL decoding
- tracing untrusted input fields into metadata, UI, and links
- checking source URL protocol filtering and length limits
```

**Guidelines:**

- MUST use the `## Section/Topic Name` + `See [file.md](./references/file.md) for:` + descriptive bullet-list format for reference-routing sections in `SKILL.md`.
- MUST use a stable leading-dot relative link that resolves from the parent file, such as `./references/input-validation.md`.
- MUST use the reference file name as the link label in parent routing sections, such as `[input-validation.md](./references/input-validation.md)`.
- MUST keep parent routing bullets descriptive; do not use RFC-2119-style requirement keywords such as MUST, SHOULD, MAY, REQUIRED, RECOMMENDED, or OPTIONAL in these routing bullets.
- MUST put a non-load-bearing rule's normative bullets in the detailed reference file, never in the parent's routing bullet list — the `See […] for:` line and the bullets under it. A load-bearing rule's RFC-2119 bullets belong in a `**Guidelines:**` block placed in `SKILL.md` after that routing list; such a block is not part of the routing section this rule governs, so it may state what the list itself may not.
- SHOULD name reference files in kebab-case.
- SHOULD order parent sections by likely consultation order.

## Triggering Conditions on Reference Links

A reference link should say when the reader needs it. Without a trigger, the agent must either load everything or guess.

A bullet that gestures at a fact — announcing that one exists without saying what it is — forces the load it was meant to make optional. The reader cannot tell whether the reference answers the question in front of them, so they open it to find out, and the routing layer has bought nothing. Naming the flag, the limit, or the rule costs the same handful of words and lets the reference stay shut.

**Bad Example:**

> what makes a route static or dynamic, and the flag that changes the model

**Good Example:**

> what makes a route static or dynamic, and how `cacheComponents` redraws that boundary

**Guidelines:**

- MUST state the condition that makes each reference relevant.
- MUST state the fact a routing bullet points at, not that a fact exists — name the flag, limit, file, or rule, rather than writing "the flag", "the limit", or "the rules that apply".
- MUST NOT use empty labels such as "details" or "more information" as the only routing clue.
- SHOULD make triggers narrow enough that the agent can skip irrelevant references.

## Anti-Patterns

Anti-patterns are useful when they name the failure mode and the cost. They should still end in concrete guidelines rather than only warnings.

**Anti-Pattern Examples:**

> Symmetry split: five tiny files created only because another skill has five files.

> Detail leakage: the same MUST rule appears in both SKILL.md and a reference file.

> Deep nesting: references/security/input-validation.md under a skill that expects one level.

**Guidelines:**

- MUST NOT split a skill for visual symmetry alone.
- MUST NOT state the same normative rule in both the index and a reference file — name which side wins rather than allowing both. A load-bearing rule is stated once, in `SKILL.md`'s `**Guidelines:**` block; the reference that elaborates it does not restate the rule. A non-load-bearing rule is stated once, in the reference; the index's routing bullets name what it covers without restating it.
- MUST NOT create nested reference directories unless the host project has explicitly adopted that structure.
- SHOULD remove or merge over-fragmented references before adding more.
