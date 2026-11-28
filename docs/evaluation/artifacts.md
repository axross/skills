---
type: Procedure
title: Evaluation Artifacts
description: Package dispatch records, diagnose missing material and retry admission.
---

# Evaluation Artifacts

Download the artifacts for the failing [dispatch](../operations/evaluation-dispatch.md#the-dispatch-workflow). Keep each artifact in its own directory. Each upload contains only `record.json`, a JSON data bundle whose
envelope carries repository, run, source commit, producer attempt, artifact
name and version. Its `files` array carries relative paths and verbatim UTF-8
content. A probe owns only its planned cell's four measured files; a judged
bundle owns only its scenario's planned `factors.json` files. Judged bundles
MUST NOT overlay measured bytes or other scenarios. Whole-tree uploads are
rejected because they erase ownership and collision evidence.

## Validate downloaded records

Downloads retain artifact-name directories in scratch (`merge-multiple: false`),
not in the repository. Admission MUST perform these steps in order:

1. Compare downloaded bundles with the independently supplied workflow context
   and plan-job matrices.
2. Validate all supplied bundles.
3. Copy selected content into fresh measurement directories.

Admission rejects unexpected entries (including empty nested directories), links, special
files, duplicate ownership, reused destinations, identity mismatches, malformed
consumed JSON and invalid declared-factor outcomes. Admission never executes
transcript text or applies patches. Empty patches, truncated transcripts,
failed probe exit codes, optional runtime fields and factor error objects remain
legitimate observations.

The landing report distinguishes missing artifacts from missing files in valid
bundles and lists factor errors separately. Valid nonempty subsets are `partial`,
retained without a summary for incomplete scenarios; entirely empty input fails
with nothing to land. `complete` means all planned material is available, not
that a probe succeeded or every factor returned a verdict. The generated
measurement PR includes those deficits and errors. Copy or report-write failure
fails the job; filesystem publication is not atomic and may need a fresh
checkout before retrying locally.

## Recover a landing attempt

The transport selects the current workflow run, not arbitrary runs, but neither
that selection nor a matching envelope authenticates the producer. Source/run
consistency and content admission are not cryptographic provenance. The selected
action and artifact service remain trusted transport dependencies: validating
after download is not containment for arbitrary hostile ZIP extraction or a
compromised action. Fixed-basename uploads reduce the normal producer's archive
surface; payload paths stay inside inert JSON. Repository checks likewise do
not prove provenance. npm's content cache is not an executable `node_modules`
or evaluation-artifact trust boundary.

Earlier producer attempts from the same run/source remain admissible when only
`land` is retried; attempt metadata is descriptive, not forced to match the
landing attempt. Expired or unavailable artifacts are reported as missing,
never regenerated silently. Dispatches predating this bundle format require the
old matching workflow source; whole-tree artifacts are not accepted by the new
consumer.

## Pack and admit records locally

The workflow supplies `GITHUB_REPOSITORY`, `GITHUB_RUN_ID`, `GITHUB_SHA`,
`GITHUB_RUN_ATTEMPT`, `PROBE_MATRIX` and `JUDGMENT_MATRIX`. Offline callers MUST
supply the expected identity and matrices independently, not read them out of a
bundle to bless that bundle. The selector is one exact matrix entry as JSON.

Keep `--report` outside planned measurement directories; the CLI rejects
overlaps before copying data. It also refuses report-path symlinks and special
files, including unsafe ancestors. Existing regular reports outside those
directories can be replaced, including a report alongside measurements under
the output root.

```bash
node tools/evaluation/artifacts.mjs pack-probe --input <probe-root> --out <bundle-dir>/record.json --selector '<cell-json>'
node tools/evaluation/artifacts.mjs pack-judged --input <scenario-root> --out <bundle-dir>/record.json --selector '<scenario-json>'
node tools/evaluation/artifacts.mjs admit --input <probe-downloads> --judged <judged-downloads> --out <measurement-root> --report <report.json>
node tools/evaluation/artifacts.mjs admit --input <probe-downloads> --out <scratch-root> --report <report.json> --scenario <id>
node tools/evaluation/artifacts.mjs --help
```

Packing refuses unexpected producer output rather than stripping it. Admission
exits 0 for valid complete or partial material, 1 for refusal or failed effects,
and 2 for bad invocation. Only complete report entries are eligible for the
workflow's summary step; standalone `derive.mjs` does not know the plan matrix.

Use the [workflow admission report](../../.github/workflows/evaluation-dispatch.yaml) to find the affected scenario and cell. If a producer artifact expired, record the deficit. If the artifacts survive and only landing failed, retry landing against the same run, preserving completed probes.
