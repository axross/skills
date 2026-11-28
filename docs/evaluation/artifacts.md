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
that a probe succeeded or every factor returned a verdict. Find these deficits and factor errors under **Artifact admission** in the
measurement pull request. The separate derived-tier note below it lists
scenarios lacking a summary. To distinguish incomplete inputs from a failed
derivation, inspect the warning for that scenario in the run's **Derive each
measurement's summary** step. If admission itself fails, the run stops before
opening a pull request. Read the diagnostic in **Admit this dispatch's
measurement data** in the `land` job. Copy or report-write failure
fails the job; filesystem publication is not atomic and may need a fresh
checkout before retrying locally.

## Recover a landing attempt

Open the failed run's `land` job and identify the last successful step. Before
retrying any publication, look up the remote `evaluation-dispatch/<run-id>`
branch and any pull request from that head, including a closed or merged one.
An existing PR records the publication outcome even if its branch was later deleted.
The [workflow definition](../../.github/workflows/evaluation-dispatch.yaml)
pushes the branch before it creates the pull request.

- **No remote branch or matching pull request.** Correct the failure identified
  in the job log. If the required artifacts survive and the cause is resolved
  for that run, retry only `land` against the same run and source. If records
  have expired, record the deficit. A partial landing can retain surviving
  records. A run with no material cannot land.
- **Remote branch exists.** Check its head, the commit's dispatch run URL,
  parent source revision and measurement changes against the intended run.
  Check that the PR base is the ref originally selected for dispatch. If a
  matching PR exists, use its actual state. If only creation of the PR failed,
  an operator with permission can open the missing PR from the verified
  existing head against that base, preserving the admission and derivation
  evidence from the run.
- **Branch, run or PR disagree.** Stop publication and reconcile the identities
  with the maintainer. Replaying the commit-and-push step can collide with the
  existing branch. Do not force-push or rerun paid probes to repair a
  publication failure.

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
