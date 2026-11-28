---
type: Procedure
title: Scenario Patches
description: Generate or repair a scenario diff from its declared mock and verify the patched project offline.
---

# Scenario Patches

Generate a scenario's diff from a clean copy of its declared mock. Do this
when adding a patch or when a change to the mock invalidates an existing
one. The [scenario convention](../conventions/scenario-layout.md)
defines patch ownership and the required agreement between the file tree and
the recorded history.

## Prepare the starting tree

From the repository root, read the scenario's `mock` and `patch` fields.
The following example uses the
[uncollected toast test](../../tools/evaluation/scenarios/run-the-toast-tests-the-suite-never-collects/scenario.json).
It assumes the desired mock baseline is committed at `HEAD`. If the same
change updates the mock, use its intended baseline, including those edits,
in both temporary copies. Exclude installed dependencies.

```sh
scenario=run-the-toast-tests-the-suite-never-collects
mock=inkwell
patch_path="tools/evaluation/scenarios/$scenario/patch.diff"
scratch=$(mktemp -d)
mkdir "$scratch/clean" "$scratch/edit"
git archive "HEAD:tools/evaluation/mocks/$mock" > "$scratch/mock.tar"
tar -xf "$scratch/mock.tar" -C "$scratch/clean"
tar -xf "$scratch/mock.tar" -C "$scratch/edit"
git -C "$scratch/clean" init -q
git -C "$scratch/edit" init -q
git -C "$scratch/edit" add --force -- .
base_tree=$(git -C "$scratch/edit" write-tree)
```

## Introduce the defect and regenerate the diff

Edit only the files under `$scratch/edit` until the mock represents the
scenario's intended starting state. When regenerating a stale patch, use
the old diff to identify the intended defect and reproduce it against the
new baseline. A hunk can apply successfully at a different location, so
inspect the result even when Git reports success.

For a file addition, add its path to the appropriate commit in
`$scratch/edit/history.jsonc`. For a removal, remove all references to that
path. For a rename, update both sides. Leave the clean copy untouched. Stage
the result so the diff includes new files as well as edits and deletions.

```sh
git -C "$scratch/edit" add --force -- .
git -C "$scratch/edit" diff --cached --binary "$base_tree" -- > "$scratch/candidate.diff"
git -C "$scratch/clean" apply --check -- "$scratch/candidate.diff"
```

If `git apply --check` fails, inspect the paths and hunks against the clean
copy. After it succeeds, review the candidate and copy it to the path named
in `scenario.json`. If the scenario previously used `"patch": null`, set
`patch` to the new filename in the same change.

```sh
cp "$scratch/candidate.diff" "$patch_path"
npm test -- tests/repository/patch-materialization.test.mjs
```

## Verify the materialized project

The offline test exercises each declared patch both with and without
the diff. It checks that the patch applies, the patched tree and history
agree, replay leaves a clean working copy and the two projects actually
differ. A missing history entry, a stale filename or an empty change can
therefore fail even after the Git applicability check succeeds. Correct the
draft or declaration and repeat the checks before dispatching any paid
probe. [Patch materialization test](../../tests/repository/patch-materialization.test.mjs)
