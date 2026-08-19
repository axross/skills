---
status: accepted
---

# Share judgment scripts across scenarios, without a re-proliferation gate

Every evaluation-scenario script more than one scenario named lived as one
file per scenario — 47 files split across only eight distinct scripts, with
`check-discovery.mjs` alone at 25 byte-identical copies. Nothing in
`docs/specs/skill-evaluation.md` or `scenario.schema.json` said a script had
to live beside the scenario naming it; the convention just grew that way, and
it had already let `check-transcript-mentions.mjs` drift into two behaviors
under one name — two copies scanned the whole transcript, the third, later
and correct, scanned only the agent's own assistant text — a divergence
[#462](https://github.com/axross/skills/issues/462) exists because of.

Chose a shared library: `tools/evaluation/judgments/` now holds one canonical
copy of each script more than one scenario names, and every affected factor's
`judgment.script` points at it as `../../judgments/<name>.mjs` — a path
`scenarioRelativePath`'s existing pattern already accepted, since it rejects
only an absolute one, not a schema change. No factor judges differently for
it: `tools/evaluation/src/factor-judgment.mjs` already resolves
`judgment.script` with a plain `join`, so a shared copy runs exactly as a
per-scenario one did. The one deliberate exception is
`check-transcript-mentions.mjs` itself, whose surviving copy is the
corrected, assistant-text-only reading; adopting it across all three factors
that named the script is the fix #462 asks for, and the two factors still
wired to the whole-stream copy's `mustContainAny` input key were switched to
the corrected script's own `anyOf` to match.

Rejected a byte-identity gate over the existing per-scenario copies, which
would have kept every file where it was and made drift loud without moving
anything. It was the cheaper option on the table, and it was rejected anyway:
it leaves the twenty-five-edit cost of fixing `check-discovery.mjs` in place,
and it forbids the deliberate per-scenario divergence the copies nominally
exist to allow — several of `check-file-contains.mjs`'s nine copies carried a
header naming that scenario's own factors, genuinely different prose beneath
an identical script — so it pays the cost of enforcement without the benefit
of sharing.

Rejected the status quo, unchanged. It is what let
`check-transcript-mentions.mjs` diverge into two behaviors, silently, for as
long as it did; nothing about leaving 47 files as 47 files stops the next fix
from reaching only the copy someone happened to edit.

Rejected symlinking each per-scenario path at one shared file. It would have
needed no `scenario.json` edit and no schema prose — the repository already
commits symlinks under `.claude/skills/` — but it hides the sharing from
exactly the place a scenario author looks: a directory listing or a diff of
`scenarios/<id>/scripts/` would show a script that looks owned rather than
shared, and the per-scenario header a shared file's rationale had to move out
of would still be lost.

Rejected placing the shared scripts under `tools/evaluation/src/`. That
directory is the instrument's own code — what `probe.mjs` and `evaluate.mjs`
import — while a judgment script is part of a scenario's declaration and is
spawned as its own process (`factor-judgment.mjs`'s `spawnSync`), never
imported. Filing it there would blur a boundary the rest of the tree already
keeps: `judgments/` sits as a sibling of `src/`, `mocks/`, `scenarios/`, and
`measurements/`, holding declarations rather than the code that reads them.

No re-proliferation gate accompanies the move. A validator forbidding a
future same-named script under `scenarios/` was on the table and was
declined at the plan gate, deliberately, over an option that included one.
The cost accepted is real: nothing here stops a twenty-seventh scenario from
writing its own `check-discovery.mjs` instead of reaching for the shared
one, the same way this repository arrived at twenty-five. The arrangement is
documented instead — in this record, in `scenario.schema.json`'s own prose,
and in [Directory
Structure](../conventions/directory-structure.md#where-a-judgment-script-lives)
— on the same reasoning that document already gives for a validator not
written: a check earns its place when the defect it would catch is not
visible in the text an author already has in front of them, and a
`judgments/` directory sitting beside `scenarios/` is visible to anyone who
goes looking for a script to reuse before writing a new one. Whether that
visibility is enough is exactly what a future drift would test.
