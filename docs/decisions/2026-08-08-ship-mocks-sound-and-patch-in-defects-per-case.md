---
status: accepted
---

# Ship mocks sound and patch in defects per case

## Context

Both evaluations situate their probes inside a mock project, and some of their
cases are **symptom-shaped**: the prompt describes a defect rather than a task.
"Our Amplitude device ID resets on every launch" only means anything if the
identity storage really is misconfigured. Pointed at a project where it is not,
the model reads the code, finds nothing wrong, and the probe measures confusion
rather than the thing it was built to measure.

The obvious answer is to ship the defect inside the mock. That answer forced the
decision, because it does not survive more than one case.

## The decision

**A mock is a genuine project. A case brings its own defect as a patch.**

Nothing inside a mock is bent to fit a case. A mock's stack and structure are
chosen with skill and case coverage in mind — that is what makes it useful — but
anything a case needs that the project would not naturally have arrives as that
case's patch, applied while the mock is expanded into a probe's workspace.

The test for any candidate flaw is whether a competent developer of that project
would have done it that way for their own reasons. A realistic project has gaps,
and a case may use a gap that is already there; what is forbidden is inventing
one.

The patch lands after the copy and **before** the recorded history is replayed
over it, and a patch that changes the file set maintains the mock's history
manifest itself.

## What was rejected

**Shipping the defects in the mock.** Rejected on four independent grounds. They
_accumulate and contradict_: one planned mock hosts five patch-driven cases, and
a project broken five ways at once is not a project anybody wrote. They _read as
a fixture_: one of everything the evaluation measures, each conveniently broken,
tells the model what it is looking at. They _collide with the confounder rule_ a
mock is already held to, since a mock shipping a half-migrated component would
demonstrate the very convention the case asks the model to apply. And _one
defect blocks another case_: a broken source-map upload is the subject of one
case and noise in every other case against that mock.

**Applying the patch after materialization.** Rejected: the workspace would then
stand dirty, which is a tell, and the effect evaluation captures the model's own
work as a diff against `HEAD`, so the patch would be reported as something the
model produced.

**Applying it to the mock's source before copying.** Rejected: it mutates the
repository, and a deletion would break the tree-versus-history invariant before
the check that guards it could account for the patch.

**Applying it after the replay and committing it.** Rejected: the history then
reads "remove the tests", which announces the defect louder than the defect
itself does.

**Relaxing the tree-versus-history invariant to ignore what a patch removed.**
Rejected in favour of the patch maintaining the manifest: one invariant is worth
more than an invariant plus an exception.

**Allowing a commit a patch empties to be committed empty.** Rejected: a commit
touching no file is unusual enough in a real project to read as a fixture. Such
a commit is skipped instead, and the skip is reported.

## What it costs

A case's defect is now expressed as a diff rather than as source, which is
harder to read and rots when the mock moves under it. That cost is paid
deliberately and is bounded by a check: every declared patch is applied against
its mock offline, before any dispatch, so a rotted patch fails in the test suite
rather than in a run that has already spent money reaching it.

A commit a patch empties loses the message it carried, since it is skipped
rather than committed empty.
