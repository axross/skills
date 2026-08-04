# Run State and Reporting

Apply this reference when recording the run's durable state, and when the run reaches convergence and reports back. It expands the [Run State and Reporting](../SKILL.md) section in the parent skill.

## GitHub as Lightweight State

State lives in this running session; GitHub carries a thin, **human-invisible** breadcrumb so a resumed or reclaimed session can recover. The run posts no status or attention comments. It authors exactly three kinds: the dedicated review request (Phase 3), the marked review-thread replies that tie each resolved finding to its commit (Phase 4), and — only where the issue body cannot spare the room — the marked archival comment holding the original description (Phase 1, see [plan-document.md](./plan-document.md)).

**Guidelines:**

- MUST keep the run's state in a single **status block**: an HTML comment (`<!-- ... -->`) embedded in the pull request description — invisible in the rendered UI, present in the raw markdown. Before the pull request exists, keep the same block in the issue body. Record the current phase, the review-round count, what the run is waiting on, and any open question; update it in place.
- MUST NOT post a separate status comment or @mention the maintainer for attention; convey ready-to-merge, dormancy, and non-convergence in the turn output instead. The archival comment above is not an exception to this — it carries the original description, never run state.
- MUST NOT write the literal review trigger phrase anywhere except the dedicated review request — a comment-triggered workflow fires on that phrase appearing anywhere in a body. Refer to it as "the independent review" everywhere else.
- MUST reconstruct state from GitHub before acting on a resume, and resume the one pending step the block names rather than restarting from Plan.
- MUST read the status block through a channel established as byte-faithful, and record which channel that was. The block is an HTML comment, and a sanitizing read removes it whole — so a read through such a channel returns a body that looks like one carrying no state at all.
- MUST NOT treat an absent block as an absent run. Where no byte-faithful channel is available, reconstruct what the surviving signals support — branch, commits, pull-request existence and draft state, comment authors and markers, CI status — and treat anything they cannot establish as unknown rather than as a default.

## Delegated Run State

When the run delegates implementation, the state that matters on a resume grows: which mode the run is in, who wrote last, and how far the current attempt got. Session state carries the detail; the status block carries only what a fresh session cannot re-derive.

Session state should hold the execution mode (delegated, single-agent, or recovering), the worker-resolution source (explicit, custom, built-in, or none), implementation status, the current plan revision and task phase, the attempt number, the writer owner, any opaque continuation handle, model and effort certainty, and the reason for a fallback or recovery.

The status block adds only durable recovery information: execution mode, implementation status, the approved plan revision, the latest coherent implementation HEAD where available, phase, review round, waiting state, and any open question.

**Guidelines:**

- MUST NOT duplicate the commit list into the status block; Git history and the completion receipt stay authoritative for individual commits.
- MUST keep opaque worker identifiers, transcript paths, and other ephemeral harness details in session state rather than writing them to GitHub.

## Reporting a Delegated Run

Execution detail belongs inside the existing report, not beside it. A separate agent-activity log competes with the summary the human actually reads.

**Guidelines:**

- MUST fold into the completion summary and the ready-to-merge handoff: whether the run was delegated, fell back to single-agent, or recovered; the worker-resolution source; model and effort as verified, declared, or unknown; the fallback or recovery reason; whether the intended implementation-model saving was actually achieved; any skipped or unavailable verification; and residual worker or routing risk.
- MUST NOT duplicate that information into a separate verbose activity log.

## Ready-to-Merge Handoff

When a run flips its pull request to ready, that same chat turn doubles as a **verification brief**: hand the human everything they need to exercise the change before merging. Deliver it in the session's chat turn output only — never as a GitHub comment.

**Guidelines:**

- MUST name, in the handoff and in any completion claim, the tracking issue, the pull request, and the independent review's outcome (round count and verdict), with links — a completion report that cannot cite its pull request and review is reporting work that is not ready.
- MUST judge whether the change is human-observable first. Write the brief only when the change alters something a human can see or operate — a route, a rendered surface, a command, an admin view. For a purely internal change (build, refactor, non-visible logic) with nothing to walk through, say so in one line and stop.
- MUST spell out what to exercise and how, derived from the plan's acceptance criteria and the changed surfaces: the specific routes, pages, or commands to open, and the states to exercise (loading, empty, error, responsive widths, theme, locale) where they apply.
- SHOULD hand over a per-PR preview URL when the project deploys one — sourced from the newest preview-deploy comment and verified against the branch-head SHA, never constructed from memory. When there is no usable preview, give the local verification steps instead; never fabricate a URL.
