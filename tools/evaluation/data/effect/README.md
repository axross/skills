# Skill effect evaluation — measurements

What the skill effect evaluation has measured, and the declared cases it
measures. The instrument that writes all of this lives in
[`tools/evaluation/effect/`](../../effect/README.md).

## Three kinds of file, three rules

The layout keeps measured, declared, and derived data in separate files,
because they answer different questions when something goes wrong.

| Kind         | Files                               | Rule                                                                     |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------ |
| **measured** | `transcript.jsonl`, `changes.patch` | Never regenerated. Re-acquiring them costs a paid probe.                 |
| **declared** | `metadata.json`                     | What was set. The CLI argv is derived from it, never recorded beside it. |
| **derived**  | every `summary.json`                | Regenerable. A drift check re-derives and fails on a mismatch.           |

A file in the wrong category is the failure this split exists to prevent: a
derived value stored as measured is a value nothing can check, and a measured
value treated as derived is one something will cheerfully regenerate as empty.

```text
tools/evaluation/data/effect/
  fixture.json                  the declared cases
  summary.json                  derived — a snapshot across every measurement
  measurements/
    <case>-<id>/
      summary.json              derived — a summary of every probe below
      skill-absent-<id>/
        metadata.json           declared
        transcript.jsonl        measured — verbatim, redacted
        changes.patch           measured
      skill-present-<id>/
        …
```

`<id>` is eight random hex digits. Repetitions of one condition have no
ordering and are not paired across conditions, so an index would imply two
things that are not true; a random id implies neither.

## The transcript is stored verbatim, and that is the whole point

The instrument this replaced stored extracted signals and threw the raw stream
away, on the reasoning that a later question would be a threshold over the
signal already extracted. It was not. Reading six recovered session logs
answered three questions the stored records could not: which tools each run
used, the per-message token usage, and the model each message reported.

So every question a reading does not answer used to cost a paid re-run. Now it
costs a new reading of a file already on disk. Add the reading to
[`summarize.mjs`](../../effect/summarize.mjs)'s derivation, regenerate,
and commit — no probe is spawned and nothing is billed.

The transcripts are committed raw rather than compressed. Git zlib-compresses
blobs in its object store, so the disk saving from a hand-gzipped file is near
zero, and the file would stop being greppable, diffable, and readable in the
GitHub UI.

## Regenerating, and the drift check

```sh
node tools/evaluation/effect/summarize.mjs           # derive and write every summary
node tools/evaluation/effect/summarize.mjs --check   # derive and compare; write nothing
```

`--check` is the drift check. It runs in this repository's test suite over
every committed measurement, and again inside the measurement workflow before
anything is committed — one derivation, two callers.

Both derived surfaces are in `.prettierignore`. The bytes come from exactly one
serializer, and a second formatter with an opinion about them would make the
drift check fail against a file the instrument never wrote.

## `patch`, when a case needs a broken starting state

Optional. A case whose prompt is symptom-shaped — it describes a defect rather
than naming a task — needs that defect to be real, or the model reads the
project, finds nothing wrong, and the probe measures confusion. The mock does
not carry it: a mock ships sound and the case brings its own defect as a
unified diff, applied while the workspace is materialized and before the
recorded history is replayed over it. `tools/evaluation/mocks/README.md`
states the principle and
[`docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md`](../../../../docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md)
records what it beat. Today <!-- count:effect-eval-patched-case-count -->three<!-- /count --> cases in the current fixture declare one — see [`patches/`](./patches) — and every other case uses a gap the mock genuinely has instead.

```json
{
  "id": "fix-a-thing",
  "mock": "tsuzuri",
  "patch": "patches/fix-a-thing.patch"
}
```

The path is resolved against **this directory**, so a patch lives beside the
fixture that declares it. Three rules govern one:

- **It is per case, not per condition.** Both conditions of one case start from
  one project tree, which is what the comparability check requires.
- **It maintains `history.jsonc` itself** whenever it changes the file set —
  dropping a name it deleted, adding a name it created. Modifying a file needs
  no such edit, because the name is already there.
- **It is checked offline.** `npm test` applies every declared patch against its
  mock, so a patch that stopped fitting fails there rather than in a dispatch
  that has already spent money reaching it.

## `endedAwaitingDecision`

A derived boolean on every probe's summary, alongside `changedPaths` and the
rest of what `summarize.mjs` derives from a probe's own transcript and diff.
It is `true` only when both hold: `changedPaths` is empty, and the
transcript's last assistant message reads as putting a decision to a person
rather than finishing the task — ending on a question like "want me to apply
the fix?" rather than reporting that the fix was applied.

The signal exists because those two outcomes used to be recorded identically.
The first paid measurement of `fix-a-minified-production-stack-trace` (#330)
found the planted defect in all six of its probes, but two of the six ended by
asking permission to apply the fix rather than applying it — and
`changedPaths: []` alone could not tell that outcome apart from a probe that
found nothing at all. `endedAwaitingDecision` splits the bucket: `true` means
the probe found something and stopped to ask about it; `false` alongside an
empty `changedPaths` means the probe produced nothing and its final message
did not solicit a decision either. That measurement is committed under
`measurements/fix-a-minified-production-stack-trace-201f1200/`, and its two
soliciting probes — `skill-absent-679a67c3` and `skill-present-a94cd726` —
are the ones the field was added to make readable.

It is derived, not declared. `tools/evaluation/lib/transcript/parse.mjs` reads the
transcript's last assistant message into `finalAssistantText` (`null` when the
stream carried none, the same convention every other field in that module
follows). `tools/evaluation/effect/src/summary.mjs` exports the judgement itself,
`solicitsDecision`, kept out of the shared transcript library because it is an
effect-eval reading rather than a fact about the stream. Both are pure
functions of the stored files, so `endedAwaitingDecision` regenerates and
drift-checks the same as every other derived value.

## `finalMessageHeadings`

A derived field on every probe summary, alongside `endedAwaitingDecision` and
the rest of what `summarize.mjs` derives from a probe's own transcript and
diff. It reports the Markdown headings of `transcript.finalAssistantText`, as
an array of heading text strings in document order — the leading `#`
markers, any closing `#` sequence, and surrounding whitespace all stripped.
`null` when `finalAssistantText` is `null`, the same "the stream did not say"
convention every other field in this module follows; `[]` when the final
message carries text but no heading.

Heading level is deliberately not recorded. The field exists to answer
"which sections did this document carry", not how they nest — a level-3
"Alternatives considered" and a level-2 one read the same to that question,
and a caller who does want the nesting still has `finalAssistantText` itself
to re-derive it from.

Two known gaps, stated here rather than left for a reader to discover:

- **ATX headings only** (`# Heading`). Setext headings — a line of prose
  followed by a line of `===` or `---` — are not recognized. This is the same
  kind of known gap `artifact.mjs`'s header states for its own regular
  expressions, and it costs nothing against the transcripts this field was
  built to read: every one of them writes ATX-style.
- **A line inside a fenced code block is never read as a heading**, even when
  it starts with `#`. A shell comment in a sample command, or a Python
  comment in a snippet, is not a section of the document, and the PRD-shaped
  final messages this field exists to read do contain fenced blocks — an
  ASCII sketch of a request flow, a Mermaid diagram. Fence state is tracked
  line by line, the same way a Markdown renderer reads it.

**What it settles, and what it does not.** A heading list makes "a document
was produced, with these sections" visible where `changedPaths: []` said only
"nothing happened" — exactly the gap
`write-a-requirement-document-for-reader-corrections`'s measurement exposed
(#374): the case's own `prediction` says a deterministic reading can enumerate
a PRD's sections "off its headings alone", but until this field existed
nothing in `summary.json` did that enumerating. It says nothing about whether
the document is any good: whether a "Goals and Non-goals" heading sits over
goals that are actually well-chosen, or an "Acceptance criteria" heading sits
over criteria someone could actually check, is exactly the residue that
case's `prediction` already disclaims to a person reading the transcript
rather than claiming a heading list could settle.

Regenerating is what grounds the field, not just what tests it. All three
skill-present probes of
[`write-a-requirement-document-for-reader-corrections-53601779`](./measurements/write-a-requirement-document-for-reader-corrections-53601779)
invoked `product-requirement-document-authoring`, and each carries the same
thirteen-heading structure the skill's own PRD template teaches — `Summary`,
`Todo`, `Background`, `Assumptions`, `Goals and Non-goals`,
`Functional requirements`, `UI design`, `System design`,
`Alternatives considered`, `Non-functional requirements`,
`Acceptance criteria`, `Verification strategy`, `Open questions` — two of the
three under one additional title heading naming the plan itself. The three
skill-absent probes each read differently, and none follows that template,
because none had it loaded: one carries nine headings of its own devising,
one a single top-level heading over an otherwise unheaded proposal, one
eight. The case's paid measurement is readable this way with no probe
spawned to get it.

## `loadedSkills`, and the ambiguous skill-present null

`loadedSkills` (on every probe's summary) is not a setting anyone requested —
it comes from the transcript's own `init` event, the `skills` array the CLI
reports before the first turn. What it carries is deliberately narrow: which
skills the CLI **announced as loaded**, not which ones existed on disk
(`configuration.skills` is the declared record for that) and not which ones
the model actually reached for (`skillsInvoked` is). `null` means the init
event carried no `skills` field at all — an older CLI, not a probe that loaded
nothing.

That makes `loadedSkills` runtime-dependent in a way none of this module's
other fields are: whether the CLI announces workspace skills at all is a
property of the CLI version, not of the probe. On the runtime pinned for every
measurement here, claude-code `2.1.220`, **it does not.** Across the
measurements committed as of this pass, no probe's `loadedSkills` ever
contains the one skill its case declares — not even the three skill-present
probes of
[`remove-config-options-the-test-runner-ignores-b2e5e389`](./measurements/remove-config-options-the-test-runner-ignores-b2e5e389),
which invoked `vitest-testing` by exact name as their second tool call. #364
established this is the pinned runtime's behavior rather than evidence the
skill never reached the workspace: a scratch diagnostic run under a newer CLI,
`2.1.228`, reported a marker skill in `loadedSkills` under the same
`--setting-sources project`.

`tools/evaluation/effect/src/summary.mjs` reads that consequence in two places.
`deriveProbeSummary` derives `declaredSkillsLoaded`: the sorted subset of a
probe's own declared skills (the keys of its own `configuration.skills`) that
its own `loadedSkills` actually contains — `null` when `loadedSkills` is
`null`, `[]` otherwise, and a pure function of that probe's own files alone.
`runComparabilityChecks` reads `declaredSkillsLoaded` across every probe in a
measurement to resolve a check, `the treatment reached the skill-present
condition`, with three outcomes: **confirmed** when every skill-present
probe's loaded set covers its declared skills and no skill-absent probe's
does; **contradicted**, and failing, when some probe does report a declared
skill but the distribution is wrong; and **unavailable** — passing,
deliberately — when no probe reports any declared skill at all, because
failing there would mark every measurement this runtime produces incomparable
for information the runtime never offered. Every measurement committed as of
this pass resolves unavailable, which is a record of this runtime's behavior,
not a defect in any of them.

**A skill-present probe with an empty `skillsInvoked` is therefore an
ambiguous outcome, not a measured null.** "The skill was there and went
unused" and "the skill never reached the model" read identically in every
field this instrument can check, because the one outcome-based signal that
would tell them apart — the treatment showing up in `loadedSkills` — is
unavailable on this runtime for every probe. Four of the 22 measurements
committed as of this pass are in that state:

- `write-a-custom-not-found-page` — the fixture's negative control. Its clean
  null result is the main evidence offered that the instrument discriminates
  at all, and it is ambiguous on exactly the same terms as the other three: a
  clean null from a skill that never reached the model looks identical to a
  clean null from a skill that was offered and correctly judged out of scope.
- `write-a-page-title-for-each-post`
- `fix-a-deep-link-that-loses-its-destination-at-sign-in` — the one case in
  the set whose two conditions produced structurally different diffs
  (skill-present extracted a named helper in 3 of 3 probes, skill-absent in 1
  of 3), with no invocation to attribute the difference to.
- `extract-shared-loading-and-error-handling-across-screens`

The comparability check this replaced, `one loaded skill set`, used to compare
each probe's raw `loadedSkills` for identity. That check kept the same name
but no longer compares the raw set: each probe's own declared skills are
subtracted before comparing, so the treatment itself is never read as
contamination. On every record above, where the runtime reports no workspace
skill at all, that subtraction is a no-op and the check's result is unchanged
— see the check's own detail text (`every probe's contamination is …`) for
what it compares now.

## Whether a probe produced a diff does not discriminate between the conditions

`changedPaths` is the most prominent field on a probe's summary and the first
thing a reader reaches for when comparing the two conditions. Across the
measurements committed as of this pass, whether it is empty or not agrees
between skill-present and skill-absent in 20 of 22 measurements. The two
exceptions run in opposite directions:
[`remove-config-options-the-test-runner-ignores`](./measurements/remove-config-options-the-test-runner-ignores-b2e5e389)
produced a diff in 3 of 3 skill-present probes against 2 of 3 skill-absent,
and
[`fix-a-minified-production-stack-trace`](./measurements/fix-a-minified-production-stack-trace-156f5602)
the reverse — 2 of 3 skill-present against 3 of 3 skill-absent.

**Equal counts are not evidence that the skill has no effect.** They are
evidence that this one reading — did a probe touch the filesystem at all —
cannot see whichever effect the skill has. Every case's own `prediction`
already disclaims exactly this: it states up front what a deterministic
reading is expected to tell apart and what it leaves for a person to read by
hand. The saturation confirms the shallow half of that disclaimer over the
whole committed set; it is not a new finding, only the suspicion the fixture
was already written under, now measured rather than assumed.

The counterpart is
[`write-a-requirement-document-for-reader-corrections`](./measurements/write-a-requirement-document-for-reader-corrections-53601779)
(above): `changedPaths` is empty in all six of its probes, the emptiest
possible reading, and yet `finalMessageHeadings` — a different reading over
those same stored bytes — separated the two conditions cleanly, with no
probe spent to get there.

One more measurement carries a lead, not a result.
[`fix-a-deep-link-that-loses-its-destination-at-sign-in`](./measurements/fix-a-deep-link-that-loses-its-destination-at-sign-in-71b61b73)
produced a diff in 3 of 3 probes on both sides — invisible to the count above
— but skill-present extracted a named helper module in all three
(`redirect-path.ts` twice, `redirect-target.ts` once), where skill-absent did
in only one (`post-sign-in-redirect.ts`). That cannot be attributed to the
skill: `skillsInvoked` is empty in all three skill-present probes of this
measurement (see `loadedSkills`, above), so nothing in the record says the
treatment ever reached the model. Read it as a structural difference this
reading happened to notice, not as a measured effect.

## `skill-present-632e2800`'s empty patch is an instrument artefact

`measurements/fix-a-minified-production-stack-trace-156f5602/skill-present-632e2800/changes.patch`
is empty. That is not a report of an idle probe: its `transcript.jsonl` shows
23 turns of correct work — the probe located the planted
`build.sourcemap: false` defect, fixed it, verified with a local build that
`.map` files were now produced, and ran typecheck and lint — before
committing the result. It committed on a new branch, `fix/enable-sourcemaps`,
rather than to `main` directly, because it had read the mock's own
`AGENTS.md` and deferred to it, exactly as several skills in this library
instruct.

That commit is why the stored patch is empty. `captureDiff`
(`tools/evaluation/effect/src/capture.mjs`) read a probe's work as `git diff
--cached` against whatever HEAD happened to be when the probe finished, and
committing moves HEAD onto the commit — so the diff came back empty and the
probe was recorded as having changed nothing, even though the transcript
shows the work landed. #335 fixed the capture to compare against the
workspace's HEAD as read before the probe ran instead, which no longer loses
a probe for following the project's own contributor documentation.

`changes.patch` is a measured file, and this one record cannot be repaired:
`skill-present-632e2800`'s workspace no longer exists, and reproducing it
would mean paying for another probe, not rewriting a stored one. It stays
empty, wrong, and committed exactly as measured — this note is the
correction, not a rewrite.

## The non-interactive brief, and what it supersedes

Every dispatch now carries a pinned brief, `NONINTERACTIVE_BRIEF` in
`tools/evaluation/effect/src/spawn.mjs`, into both conditions' argv via
`--append-system-prompt`. It states that the session is non-interactive — no
one will read a question the model asks, and no answer will come back — and
that where it would otherwise put a decision to a person, it should choose
the option it judges best, act on it, and say so in its final message. It
states the situation and relocates the open question; it does not instruct
the model to skip consulting anyone. Several skills in this repository
instruct exactly that, so a prohibition here would fight the treatment in the
skill-present condition and bias the arm this instrument exists to read.

Changing the brief supersedes the measurements taken under the old wording
rather than extending them, for the same reason changing `MODEL` does: the
instrument attributes a difference between the two conditions to the skill,
which holds only while everything else — this brief included — is constant
across the measurements being compared.

Two committed measurements predate the brief and are superseded by it:
`measurements/add-unit-tests-for-an-untested-module-4204a1ed/` and
`measurements/fix-a-minified-production-stack-trace-201f1200/`. Both store a
`metadata.json` with no `appendSystemPrompt`, and neither is comparable
against a measurement taken under the brief.

`measurements/fix-a-minified-production-stack-trace-156f5602/` is the first
taken under it, and it re-measures the case `201f1200` already covers. Those
two are the only before-and-after this repository holds: same runtime, same
model, the brief their one declared difference — and `endedAwaitingDecision`
falls from two of six probes to none. One measurement either side is not a
rate, so read that as evidence the brief did something, not as a measure of
how much.

## The two prompt edits, and what they supersede

[#374](https://github.com/axross/skills/issues/374) edited two cases'
prompts, each keeping its existing sentence and adding a short imperative:
`extract-shared-loading-and-error-handling-across-screens` now ends "Pull
that into one place." in place of "Where should that live?", and
`refactor-the-language-matching-helpers-into-one-place` gains "Tidy it up."
appended to its existing sentence. Both respond to the same finding: reading
each case's transcripts, none of the probes had failed — each did something
responsive to the sentence actually in front of it — but the sentence, as
originally written, was not asking for what the case's own `prediction` reads
for (a new hook/component and changed imports; the exported-function count
changing). The prompt and the prediction had drifted apart.

`task.prompt` is part of the comparability key: it is one of the values
`runComparabilityChecks` requires every probe in a measurement to agree on
(`one task`, above), and it is what a re-measurement would have to match to
be compared against a measurement already committed. Editing it means a
measurement taken under the old wording measured a different task from the
one the fixture now declares — the same reasoning that supersedes the two
measurements taken before the non-interactive brief. So:

- [`extract-shared-loading-and-error-handling-across-screens-b89d904a`](./measurements/extract-shared-loading-and-error-handling-across-screens-b89d904a)
  is **superseded** by this prompt edit.
- [`refactor-the-language-matching-helpers-into-one-place-18e7634f`](./measurements/refactor-the-language-matching-helpers-into-one-place-18e7634f)
  is **superseded** by this prompt edit.

Both stay committed, recorded rather than deleted, the same as the two
measurements the non-interactive brief superseded. Nothing about either
stored measurement is wrong — `summary.json` still regenerates and
drift-checks clean against it — but a reader comparing either against a
future measurement of the same case id is comparing across a prompt change,
not two runs of the same task. Their combined cost was $2.08.

`write-a-requirement-document-for-reader-corrections` is **not** superseded.
Its prompt did not change in #374, so the bytes already on disk still measure
the task the fixture declares; `finalMessageHeadings` (above) is a new
reading over those same stored transcripts, not a new task.

Whether to spend the roughly $2 combined cost of re-measuring the two
superseded cases is an open spending decision, deliberately not taken here —
see #374's own open questions.

## `prediction`, `negativeControl`, and `reading`

Three more fields a case declares, none of them read by `evaluate.mjs` or
`summarize.mjs` — they are what a reviewer and a future reader hold the
measurement to, not what the instrument runs on.

**`prediction`** is required on every case: a prose statement of what a
deterministic reading of the two conditions is expected to tell apart, and
what it is expected to leave over for a person — or eventually a judge — to
read by hand. It carries no machine-readable band, so nothing here checks
that the fixture's predictions actually span from "reaches nearly all of the
effect" to "reaches almost none of it" — see
[`docs/decisions/2026-08-10-cover-every-in-range-skill-with-one-effect-case.md`](../../../../docs/decisions/2026-08-10-cover-every-in-range-skill-with-one-effect-case.md)
for what that costs and why it was accepted anyway.

**`negativeControl: true`** marks exactly one case as this axis's own
noise-floor measurement: a task drawn from a skill
[`coverage.md`](./coverage.md) places outside the effect axis's range, so the
two conditions are predicted to agree. A field rather than a naming
convention, so a reader — or a check — can find it without knowing which case
id to look for.

**`reading`** is optional, and its absence is itself a declaration. A case
that omits it is stating that the deterministic layer sees only what every
case already shares — `changedPaths`, `ranTests`, `ranLint`, `ranFormat`,
`commandsRun`, and the rest `summarize.mjs` derives from every probe's
transcript and diff alike. A case that declares one names a `kind` the
extractor in `tools/evaluation/effect/src/artifact.mjs` knows (today, only
`unit-test-artifact`) plus that reading's own inputs — for the existing case,
`targetModule` and `helpers`. Declaring a `reading` does not connect it to
anything: `extractArtifact` stays unwired from `summarize.mjs`'s derivation on
purpose, so declaring one costs nothing against `summary.json`.

## `capUsd` and `unmeasuredProbeCostCeilingUsd`

Both bound spending, and they bound different things. `capUsd` is the case's
real budget: a dispatch may lower it and may not raise it, because the fixture
is reviewed and committed where a dispatch input is typed into a form.
`unmeasuredProbeCostCeilingUsd` is not a budget at all — it is the per-probe
figure admission projects from **for a case nothing has measured yet**, and it
is read on no other occasion.

**Declare it above what the case is expected to cost, not at it.** Admission
admits when the projection fits the cap, so the direction of a wrong figure
decides which way it fails:

| Declared            | Projection | If it is wrong                                         |
| ------------------- | ---------- | ------------------------------------------------------ |
| Above the true cost | inflated   | a cheap case is refused before spending. Costs nothing |
| At the true cost    | accurate   | no spurious refusals, no margin either                 |
| Below the true cost | deflated   | an expensive case is admitted. Money leaves            |

Only the last row spends money on a mistake, which is why the field is named
for a ceiling rather than an estimate. It was called
`estimatedCostUsdPerProbe` until the pilot measured $0.25 per probe against a
declared 6 and made the mismatch plain; the value did not change, because 6 is
wrong as an estimate and correct as a guard.

Its provenance is worth keeping: 6 is the previous instrument's $40 cap divided
across six planned probes, never a cost observation. The recovered 2026-08-06
figures that might have informed it were lost with the container that held
them.

**The first comparable measurement supersedes it permanently.** Admission
projects from measured costs wherever they exist, so once a case has landed one
this field is never read for that case again — it governs only the first run.

## What is committed here

`measurements/` holds every case measurement taken so far, one directory per
measurement, and `summary.json` is the snapshot derived across all of them —
that file, not this paragraph, is the live record; read it, or derive from its
`measurements` array, for the current measurement count, distinct-case count,
and total cost.
`fix-a-minified-production-stack-trace` is measured twice — `201f1200`,
superseded, and `156f5602`, its replacement under the non-interactive brief
(see above) — and every other measured case once. `fixture.json` declares
every case this axis measures — one per skill [`coverage.md`](./coverage.md)
does not place out of range, plus a negative control — and declaring a case
is not the same as measuring it; see
[`docs/decisions/2026-08-10-cover-every-in-range-skill-with-one-effect-case.md`](../../../../docs/decisions/2026-08-10-cover-every-in-range-skill-with-one-effect-case.md)
for the policy the rest of the fixture was declared under, and
`node tools/evaluation/effect/evaluate.mjs --dry-run` for the current projected cost
of measuring what is not yet landed.
