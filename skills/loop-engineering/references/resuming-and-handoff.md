# Resuming and Handoff

Apply this reference when the loop is re-entered mid-run, or when taking over work another session suspended into a handoff package. It expands the [Intake](../SKILL.md) section with the resolution precedence, the in-session resume path, and the fresh-session take-over path.

## Resolving a Resume

A resume is signalled by the human telling you to continue, or by the loop re-entering after a machine event or a reclaimed session. Resolve it to exactly one outcome before any other action, in this precedence order:

1. **This session holds a run** (paused at the plan-approval gate, paused on a stuck machine event, or reclaimed with its context thinned) → resume it. Re-read the target's current state — the plan in the issue, the open pull request, its CI status, the independent review's comments, unresolved threads, and the status block — and resume the single pending step. When the pending step is plan approval, treat a bare "continue" as approval **only of a plan already recorded in the issue with the status block reading `awaiting plan approval`**, and advance to Code; a resume that instead requests changes revises the plan and re-presents it. A continuation that arrives immediately after an interrupt or a reclaimed session with no intervening human-authored decision is a resume signal, not that approval — re-present the plan through the question UI and require an explicit affirmation before Code; and when the gate was never properly reached (no tracking issue, no recorded plan, or a rejected plan-mode exit), reach it first rather than treating the "continue" as approval.
2. **No in-session run, but the human provided a handoff package** (a `handoff-<unix epoch>.md`, optionally with a matching zip) → take it over (see [Take Over a Handoff](#take-over-a-handoff)).
3. **Neither** → state that there is nothing to resume and ask what was meant. MUST NOT start new work from a bare "continue".

**Guidelines:**

- MUST reconstruct state from GitHub before acting, and resume the one pending step rather than restarting from Plan.
- MUST NOT re-ingest a handoff package this session already consumed; once anchored, it is part of the in-session run.
- MUST keep each resumed step idempotent — a second resume re-reads state and continues rather than duplicating a comment, branch, or pull request.

## Take Over a Handoff

A session-handoff skill (where the project ships one) suspends another session's in-progress work into a self-contained `handoff-<unix epoch>.md` document plus an optional same-epoch `.zip` of supporting files. Taking it over rebuilds that state in a fresh-context session and hands the work to the normal phase flow — the document replaces the session context an in-session resume would have had.

### Locate and ingest the package

- MUST use only the package the human attached or uploaded to this session. A package merely found on disk — especially one tracked by git — is not the human's; confirm it before ingesting, propose the newest epoch when several exist, and ask the human to provide one when none is found. Never reconstruct a handoff from thin air.
- MUST read the entire document before taking any action. Extract the companion zip (matching epoch) into a scratch location outside the repository checkout, verify its inventory there, and apply entries per the document's **Precondition** section (patches via `git apply` / `git am`, other files copied individually) only after the preconditions gate clears — never unzip directly into the working tree.
- MUST treat any mismatch between the zip's contents and the document's **Precondition** inventory — a missing entry, an unexpected extra — as a question for the human, never something to silently ignore.

### Verify preconditions

- MUST verify every item in the **Precondition** section against reality — right repository and branch, expected `HEAD`, patches apply cleanly, tools and credentials available — and resolve, or have the human waive, every divergence BEFORE the first repository mutation.
- MUST surface a diverged precondition (the branch moved, a patch conflicts, a credential is missing) and ask how to proceed rather than forcing a resolution.

### Resume the work

- MUST report a short take-over summary — what the handoff says, what was verified, and the plan — before editing anything, so the human can catch a misreading early.
- MUST adopt the document's **Goal** as the success criteria and its **Concerns and/or blockers** as live risks; trust `- [x]` items as done (spot-check cheaply, do not redo) and resume at the first `- [ ]` item, using the recorded history to avoid re-treading dead ends.
- MUST re-enter the normal flow at the phase matching the work's state: when the handoff names an issue or pull request, resume there; when it names none, search for an existing tracking issue first, then open one capturing the **Goal** and remaining to-dos before continuing. The plan-approval gate still applies if the take-over lands before or during Plan.
- MUST record the take-over in the status block once anchored — the package epoch, the verified `HEAD`, and the to-do resumed — and treat an existing take-over record for the same epoch as a stop-and-ask, never a second take-over.
