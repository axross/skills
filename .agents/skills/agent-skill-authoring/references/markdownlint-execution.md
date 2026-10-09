# Protected Markdownlint Execution

Use the bundled `scripts/markdownlint/` package for actual YAML frontmatter
and AS001–AS010 format checks, alongside standard Markdown rules. The body
rules cover titles, RFC declarations, labels, Guidelines, section anatomy,
reference routing and Good/Bad example containers. They do **not** replace the three
structure validators in [audit-checklist.md](./audit-checklist.md), their
shared/report responsibilities, or the separate network link-freshness audit.
A mechanical pass does not certify semantic quality or complete skill conformance.

## Install the bundled package

The private native-ESM package requires Node.js >=22 and these exact runtime
versions: [markdownlint-cli2 0.23.3](https://github.com/DavidAnson/markdownlint-cli2/tree/v0.23.3)
with its pinned markdownlint 0.41.1, [markdown-it 15.0.1](https://github.com/markdown-it/markdown-it/tree/15.0.1),
and [yaml 2.8.2](https://www.npmjs.com/package/yaml/v/2.8.2).
Later dependency versions are not qualified by this contract. The consumer's
own Node or dependency policy may be stricter.

This setup intentionally carries CLI2's complete runtime graph, including
markdownlint's micromark parser and CLI2 configuration loaders. It is not a
dependency-light replacement for the standard-library validators. The dependency
choices preserve these boundaries:

- CLI2 supplies the public custom-rule runner and warning-capable standard
  configuration. The older CLI2/markdownlint pair lacks this warning contract;
  markdownlint alone avoids runner dependencies but abandons this CLI2 foundation.
- yaml supplies decoded scalars and a source-aware AST with no runtime
  dependencies. Node built-ins or a hand-written scanner do not parse YAML 1.2;
  [js-yaml's object loader](https://github.com/nodeca/js-yaml/blob/4.1.0/README.md#api)
  does not supply the required scalar-style/source-range tree.
- markdown-it reuses CLI2's exact parser version without a second installation.
  [Micromark events](https://github.com/micromark/micromark/tree/4.0.2) are a viable,
  already-transitive alternative, but need a different shared-context adapter and
  closure qualification. Another parser adds a graph; hand-written scanning
  recreates list/blockquote semantics. A fence token alone is not proof of closure.

After installing or copying this skill, pack its bundled package and install
the resulting archive from your consumer project. Substitute the absolute path
to your copied skill; the archive is local, not a registry publication:

```bash
npm pack /absolute/path/to/copied-skill/scripts/markdownlint --ignore-scripts --pack-destination .
npm install --ignore-scripts ./agent-skill-markdownlint-0.0.0.tgz
node node_modules/agent-skill-markdownlint/cli.mjs --skill ./skills/example-skill
```

Installation can require network access; validation does not. Keep the consumer
lockfile and install dependencies before entering a network-disabled session.
A plain copied `.mjs` without its dependencies is not a supported setup. Do not
resolve runtime imports through the author's repository or an agent's global
skill directory. No `node_modules` belongs in the distributed skill.

## Declare inputs and scope

The CLI accepts repeatable `--skill DIR` for individual skills and
`--collection DIR` for collections. Every immediate directory in a collection,
including directory symlinks, requires a readable `SKILL.md`. It recursively
includes `references/**/*.md`; nested references stay visible for later rules.
Empty collections, zero selected documents, missing parents, invalid UTF-8,
read failures and reference-directory cycles fail preflight.

Reference directories, including `references` itself, must resolve inside the
canonical owning skill root. An external directory target fails preflight with
exit 2 before its contents are read; a prefix-sharing sibling is still external.
Internal directory links remain traversable, with cycle detection. Explicit
skill/collection-root links and existing reference-file/focused-file aliases
remain supported. This directory boundary is not a filesystem sandbox: file
aliases may still target external files.

`--file FILE` selects focused documents. Declared roots still undergo parent
preflight before that selection. A file within their inventory retains its
skill/reference kind; an unrelated file receives standard checks only.
`--rule AS001` selects a focused custom-rule set. Both options label the run
`partial`, never complete skill validation. `W1-full` means all selected root
documents and mandatory AS001–AS010 plus the configured standard checks, not all
epic or structural requirements. This historical scope name remains compatible
with W1 consumers; inspect the actual rule IDs and audit scope instead of inferring
coverage from its name. Output lists roots, document identities, rule scope,
missing-Guidelines audit status
and the aggregate exit for completed runs. Infrastructure failures emit
diagnostics without a completion summary or `Checked` claims.

The supported exit contract is:

| Exit | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| 0    | Successful declared-scope validation, including genuine warning advisories |
| 1    | Rule violations                                                            |
| 2    | Invocation, input, configuration, loading, runtime or coverage failure     |

**Guidelines:**

- MUST use declared skill or collection roots for mandatory checks, not a glob whose passing subset hides a missing `SKILL.md`.
- MUST retain the existing structure checks until the receiving project explicitly migrates their remaining responsibilities; `W1-full` alone does not satisfy them.
- MUST treat only exit 0 as success, and retain a focused run's partial scope in reports.

## Separate standard configuration from mandatory checks

`--config FILE` accepts an explicit JSON standard-rule object. Without it,
standard rules default to enabled. Their options, warning severity and inline
exceptions work through the public `markdownlint-cli2/markdownlint/promise`
API. For example, `{"default": false, "MD009": {"br_spaces": 0}}` selects only
the standard trailing-space check.

The public runner and CLI reject null, arrays, booleans, numbers and strings
with exit 2 before either rule pass. Omitted/undefined configuration retains
the enabled default; explicit configuration must be a non-null, non-array
object. This checks the existing object shape, not a separate deep schema.

The helper deliberately does not inherit parent/local CLI2 configuration,
globs, ignores, fixes or plugins. The mandatory custom pass hides configuration
discovery, supplies its rules directly, disables inline configuration and
frontmatter removal, and forces AS001–AS010 on at error severity. A standard
config setting `AS001: false`, an inline disable, or an inherited ignore cannot
suppress those mandatory checks. No document is auto-fixed.

Built-in `ruleConfig` false/warning settings cannot disable or downgrade these
rules. AS006 accepts its `auditMissingGuidelines` option while remaining an error.
Genuine extension rules retain their configured warning severity.

CLI2 alone is not this guarantee: it converts rule exceptions to diagnostics,
so a crashed warning rule can exit successfully, even with its diagnostic
hidden by an inline exception. Standard execution uses
`handleRuleFailures: false`; custom execution records synchronous throws and
rejected promises independently of severity. Results must cover every selected
standard document, and successful custom callbacks witness every
document/rule pair. A coverage gap or exception overrides green sub-pass
results with exit 2. Completely disabled standard rules do not execute and
are not a runtime-failure control.

**Guidelines:**

- MUST use `runValidation` or the bundled CLI for the protected execution contract; directly loading `createRules` into an arbitrary CLI2 config supplies no preflight, coverage or failure-ledger guarantee.
- MUST pass standard configuration explicitly instead of relying on ambient CLI2 configuration discovery.
- MUST keep genuine advisories separate from infrastructure failures, even when both originate in warning rules.

## Consume the shared source context

The package's public ESM entries are:

```javascript
import { createRules, createConfiguration } from "agent-skill-markdownlint";
import { createContext } from "agent-skill-markdownlint/context";
import { runValidation } from "agent-skill-markdownlint/run";

const context = await createContext({ collections: ["./skills"] });
const result = await runValidation(context, {
  standardConfig: { default: true },
});
process.exitCode = result.code;
```

`createContext` accepts `skills`, `collections` and optional focused `files`.
It returns declared `roots`, `skillDirs`, a `documents` Map keyed by absolute
path, and `partial`. Each document carries `path`, `kind` (`skill`, `reference`
or `markdown`), owning `skillDir`, exact `bytes` and decoded `raw`, the leading
`frontmatter` block/boundary, `bodyOffset` in lines, and shared Markdown tokens.
Both passes use the captured strings, even if disk content changes afterward.
`params.lines` is preprocessed Markdown, not raw bytes. This contract does not
cover unsaved editor buffers.

`runValidation` accepts `additionalRules`, their explicit `ruleConfig`, and
optional focused `rules`. It returns `code`, `scope`, `roots`, `documents`,
`rules`, `findings`, `failures` and `auditMissingGuidelines`. The audit boolean
is true only when AS006 is selected with its audit enabled. Standard and custom findings use the same
absolute paths listed in `documents`. Native separators are translated only at
the CLI2 input boundary; callbacks, coverage witnesses and POSIX-relative
formatter names map back to the original document keys. A POSIX filename's
literal backslashes are not separators. Windows path-dialect fixtures are
simulations, not native Windows execution evidence. Duplicate/unavailable identities, malformed
rules, runtime failures and disabled required execution fail rather than
silently disappearing. Consumers supply extensions directly; the helper does
not import configuration-discovered plugins.

## Interpret AS001 and AS010

AS001 parses only a leading, explicitly closed `---` YAML block using YAML 1.2
core, strict parsing and unique keys. One initial UTF-8 BOM immediately before
the opener is accepted without altering captured bytes/raw; misplaced or
repeated markers are not. BOMs inside scalars retain their decoded byte weight,
and LF/CRLF offsets remain original. The top level is a mapping. Required
`name` and `description` are nonempty decoded strings represented on one source
line. Names are
kebab-case, at most 64 characters, and match the owning directory. Descriptions
are at most 1,024 decoded UTF-8 bytes, not source spelling length.

Legal plain/single-quoted/double-quoted forms and YAML escapes are accepted.
Required fields reject plain inline-comment truncation, block/multiline forms,
aliases, anchors, explicit tags and non-string values. Optional metadata and
host extensions remain accepted as valid YAML; the check does not establish
that a receiving host supports them. Alias graphs are never expanded.
Parser errors and diagnostics retain original LF/CRLF source lines. See
[frontmatter-and-naming.md](./frontmatter-and-naming.md) for authoring choices.

AS010 uses body fence tokens from markdown-it. Only parser input gets normalized
line endings and a terminal newline: the raw snapshot stays untouched. That
newline retains an empty final list/blockquote content line. Fence maps and
content-line counts then distinguish an explicit matching closer from EOF or
container auto-closing, including empty fences without final newlines. Longer
matching markers close; shorter/wrong markers and over-indented closers do not.
Findings point to the original opener, including the frontmatter line offset.
Fenced YAML examples are not document frontmatter, and unrelated Markdown does
not receive skill rules.

## Interpret AS002–AS009

These profiles turn bounded source shapes into diagnostics at original LF/CRLF
lines. Their provenance is the authoring guidance below; the profiles specify
what the tool recognizes, not a replacement definition of good writing:

| Rule  | Input                     | Format contract and owner                                                                                                                                                  |
| ----- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AS002 | Parent SKILL              | First real root H1 matches the valid metadata name rendered as a title; [capability-framing.md](./capability-framing.md).                                                  |
| AS003 | Normative parent SKILL    | Exactly one recognized RFC interpretation declaration as the final introductory paragraph; [body-content-style.md](./body-content-style.md).                               |
| AS004 | Skills and references     | Recognized colon-bearing labels are bold paragraphs, not headings or plain text; Body Content Style.                                                                       |
| AS005 | Explicit Guidelines lists | Main items begin with uppercase RFC keywords; Body Content Style.                                                                                                          |
| AS006 | Skills and references     | Actual Guidelines have a rendered demonstration in their own section; Body Content Style and [audit-checklist.md](./audit-checklist.md). Missing-label auditing is opt-in. |
| AS007 | Parent routes             | Topic heading below H1, See filename-labelled ./references/ link, for:/when lead-in and nonempty unordered list; [progressive-disclosure.md](./progressive-disclosure.md). |
| AS008 | Parent routes             | No normative routing or attached Guidelines; the parent routing contract and Progressive Disclosure.                                                                       |
| AS009 | Good/Bad groups           | Multiple independent examples use a plural label and one blockquote per example, including snippets; Body Content Style.                                                   |

### Title and RFC recognition

AS002 uses hyphen-delimited words, not an arbitrary title alias. Unknown words
capitalize their first character; internal a/an/and/as/at/but/by/for/from/in/of/on/or/the/to/with
remain lowercase, except at the start or end. Digits remain intact and `v2`
becomes `V2`. The token map is api → API, cli → CLI, json → JSON, rfc → RFC,
ui → UI, yaml → YAML, next → Next.js and tanstack → TanStack. The compounds
end-to-end and high-fidelity become End-to-End and High-Fidelity. Thus
`working-with-api-v2` becomes `Working with API V2`, and `review-of` becomes
`Review Of`. Extra words or decorations fail; rendered inline emphasis is allowed.
Invalid YAML or required scalars do not supply an invented title. MD025 owns
additional H1s; AS002 checks the missing/mismatched first root title only.

AS003 recognizes two interpretation templates:

```markdown
The key words <quoted keyword list> in this document are to be interpreted as described in <RFC link>.
The RFC 2119 keywords in this document are to be interpreted as described in <RFC link>.
```

The full list contains MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD,
SHOULD NOT, RECOMMENDED, MAY and OPTIONAL, once each in any order; adding
NOT RECOMMENDED is allowed. Terms use straight or paired curly quotes and comma
separators, with an optional final and/Oxford comma. Wrapping, whitespace and
emphasis may differ. The RFC link label is `RFC 2119`; supported targets are
the RFC Editor `/rfc/rfc2119` or `/rfc/rfc2119.html` and IETF Datatracker
`/doc/html/rfc2119` pages over HTTP/HTTPS. No network lookup occurs.

A normative parent has actual Guidelines items or explicit authored uppercase
RFC-keyword main items outside routing and examples. References and non-normative
parents have no universal declaration requirement. Recognized authored root
paragraphs establish declaration count; comments and definitions do not affect
position. The declaration is the final introductory paragraph before the first
root H2, or before the first rule/label block when no H2 exists. Quoted/code
declarations do not count. Missing, duplicate, misplaced or unrecognized text
gets a format diagnostic, not a judgment that its meaning is false.

### Labels, Guidelines and section anatomy

The colon-bearing label vocabulary is Guidelines, Example(s), Good/Bad
Example(s), Good Example(s), Bad Example(s), Single Prose Example(s), Snippet
Example(s), Decision-language Example(s), Implementation-language Example(s),
Failure Example(s) and Anti-Pattern Example(s), case-insensitively. Arbitrary
colon-bearing prose is not a label. `**Guidelines:** Explanation.` and
`__Guidelines:__ Explanation.` are both valid custom-rule forms. MD050 owns
delimiter style. MD036 owns colonless emphasis-as-heading; AS004 does not
duplicate that diagnosis. Formatting alone does not cascade into AS006/AS009.

AS005 accepts MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT,
RECOMMENDED, NOT RECOMMENDED, MAY and OPTIONAL. Uppercase openers may be followed
by punctuation, as in `MUST, when applicable, ...`. Main unordered -, * and +
items and ordered items are checked; nested explanatory lists are not. An
authored heading or independent prose ends association with Guidelines, while
invisible definitions/comments and interleaved illustrative fences do not hide
later associated items.

AS006 checks each actual Guidelines block at H1 through H6 in its authored
container. It does not borrow a parent's demonstration for a deeper subsection.
Prose, tables, lists, quotes, code, diagrams and inline label explanations can
demonstrate; comments or definitions alone cannot. A malformed label remains
AS004's formatting concern, not a second missing-label/anatomy error. An attached
routing label belongs to AS008 even when empty or read-obligation-only.

Missing-Guidelines auditing is **off by default**. Enable the bounded audit with
`--audit-missing-guidelines`, or through the public runner:

```javascript
const result = await runValidation(context, {
  ruleConfig: { AS006: { auditMissingGuidelines: true } },
});
```

It checks root-level explicit lists with an unquoted/non-code uppercase RFC
opener and body text outside a recognized Guidelines block. Nested explanation,
recognized example groups, quotes/code and AS008-owned routing are excluded.
Keyword literals and explicit keyword-name mentions are not directives. Audit-off
is not full missing-label coverage, and neither profile infers every substantive
rule section or whether a demonstration teaches a rationale.

### Routing and example containers

AS007 recognizes authored parent paragraphs beginning See with a local references
link, or a local-reference lead-in ending for:/when: followed by a list. Ordinary
supplementary links and prose cross-references do not acquire a route requirement.
It checks the filename label and leading-dot ./references/ shape, not target
existence, anchors, inventory or reference H1-to-filename agreement.

AS008 follows real parsed list/container relationships for -, * and +. Same-marker
routing continues through valid multiline reference definitions and contained
fences, lazy/indented continuation or contained headings. A contained Guidelines
label stays attached regardless of its contents. Root-level independent prose,
headings, genuinely independent marker-changing lists and independent quote/code
blocks remain boundaries; keyword illustrations do not manufacture normative
items or separating prose. Invalid definition-like visible text retains its real
block semantics. A parser's adoption alone proves none of these boundaries.

AS009 counts independent direct blocks from a Good/Bad label to the next
recognized label or authored heading. Paragraphs or fences nested within one
blockquote remain one example. Multiple direct paragraphs or standalone fences
need a plural label and separate quotes; one snippet may remain a standalone
fence. AS004 owns bold formatting. This bounded count can flag explanatory prose
left inside a recognized group; it cannot distinguish that prose's meaning or
certify example quality. Single-prose formatting remains a SHOULD/review matter.

These rules do not implement advisory AS201–AS203, retire legacy CLIs or migrate
consumer gates. Existing corpus differences are migration evidence, not automatic
permission to rewrite sibling skills or claim semantic conformance.
