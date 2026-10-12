# Verification

Apply these guidelines to confirm that a change produces the correct output before considering the task done.

This reference owns the **method** — how to decide what a change put at risk, and in what order to confirm it. It does not enumerate the concrete targets: each one belongs to the skill closest to the surface it protects, so whichever skill governs a surface is also the skill that says how to verify it. For the commands that run the project's gate, consult the project's own documentation per [project-docs.md](./project-docs.md).

## Identifying Affected Output Surfaces

A change is verified against what it can break, not against whatever was convenient to check. Deciding that mapping first is what keeps verification from defaulting to the command that happens to be easiest to run.

**Guidelines:**

- MUST map changed files to the output surfaces they put at risk before choosing a verification path, rather than running a habitual command and calling the change confirmed.
- MUST include the surface a change produces even when the edit looks inert — prose with no structural impact still renders, and the rendered output is what a reader consumes.
- MUST run the project's aggregate quality gate whenever a change touches any surface that gate covers.
- SHOULD consult the skill that owns a changed surface for how that surface is verified, instead of re-deriving the check here.

## Plan Fragile Obligations Before Execution

A fragile obligation is an applicable requirement that a plausible implementation can violate without an obvious failure. A dropped consumer style can type-check; duplicate safe-area clearance can disappear on a zero-inset fixture. Planning the distinguishing check first prevents the implementation's own output from becoming its expected result.

**Guidelines:**

- MUST identify fragile obligations for affected responsibilities and output surfaces before execution, with independently derived expected results and discriminating checks or necessary human-approval conditions.
- MUST keep every other applicable duty binding; the explicitly planned checks are a focused evidence set, not an exhaustive compliance score.
- MUST record expected obligations and methods in the governing plan, separately from progress and observations in existing permitted run state or internal handoffs.

When an expectation or method changes an approved plan, consult the project's change-loop plan-revision and append-only recovery practices where present. Without that optional owner, preserve the project's approval and amendment gates, keep observations separate from expectations, and report unresolved approval before dependent work. This reference defines no approval identity or storage format.

## Manual Verification

Manual verification is the first line of confirmation; the automated gate is the second. Neither replaces the other — the gate cannot tell whether the content is correct, and reading cannot catch a broken link or a wrong exit code as reliably as a checker.

**Guidelines:**

- MUST exercise or read the output surface a change produces, in the form its consumer receives it, before calling the change done — including a runnable script's observed behavior, where the skill owning that surface says how to confirm it.
- MUST NOT call a change done on the strength of a passing format/lint gate alone; the gate does not judge whether the content is correct.
- MUST report a required check that could not be run, naming the reason and the residual risk, instead of presenting the change as fully verified.

## Check the Current Integrated Output

Output conformity means that the inspected result follows its applicable governing rules and currently valid exceptions. Acquisition establishes which instructions reached an actor, not whether the actor followed them. A contribution can also be correct before integration and wrong afterward.

When a claimed departure depends on a bounded exception, consult the project's installed-rule-change practices where present to establish its human adoption and current applicability. Without that optional owner, require evidence that the human accepted the identified departure and that its bounds still apply. An agent assertion, expired or out-of-scope exception, or unadopted upstream proposal does not justify the departure. Actual host priority and tool restrictions still apply.

**Example:**

> A human adopts a fixed width for one constrained print view as a bounded departure from an identified override rule. That exception can justify the print-view result while its conditions hold; the same text in an agent draft, or applied to a mobile screen outside its scope, cannot.

**Guidelines:**

- MUST inspect the actual current integrated diff and output against the governing requirements, rather than accept a contribution receipt, author assertion or earlier result as proof of the integrated change.
- MUST derive expected behavior from the applicable domain rules and valid exceptions, not from what the implementation happens to produce.
- MUST NOT infer conformity from complete skill acquisition, or a concrete output violation from unknown acquisition alone; independently verified output establishes only the inspected property, not acquisition, finding disposition or readiness.

## Bound the Evidence Claim

A static inspection, a rendering and a native-device exercise observe different properties. Evidence from before a relevant integration change cannot establish the affected current result. A reasoned skip accounts for a required check but leaves its claimed property unverified.

**Guidelines:**

- MUST identify the material revision, inspected obligation and scope, platform, check route, independent expected result, observed stage and actual result needed to interpret each claim, using existing permitted evidence destinations rather than a new schema.
- MUST recheck affected claims after relevant integration changes; evidence for an earlier contribution is not current merely because that contribution was accepted.
- MUST distinguish static inspection, rendering, native execution and external-review completion; none establishes an unobserved property or platform by implication.
- MUST report skipped, failed or insufficient required checks as limitations, not successful conformity; a skip reason and residual risk do not change that result.

When evidence sufficiency is in question, consult the project's verification-evidence assessment practices where present. Without that optional owner, retain these claim limits rather than invent a QA gate. When preparing fresh review input or assessing posted completion, consult the project's review and change-loop practices where present; contributor observations do not replace original material and requirements with an author verdict map, or require external reviewers to enumerate successful skill loads or checks.

## Contrasting Checks

These examples apply the governing component-style and navigator-edge contracts; they illustrate check selection, not new domain rules or reports of app execution. Compare the following conditions:

| Conditions                                                                                   | Independent expectation                                                                                                 | Evidence limit                                                                                                       |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| An overrideable intrinsic width is 160; the consumer supplies 240.                           | Effective width is 240. A result of 160 violates the override contract even with complete acquisition.                  | A verified 240 establishes this override, not unknown acquisition or every styling duty.                             |
| A non-scrolling screen has a visible header and tab bar, with nonzero top and bottom insets. | The screen adds no duplicate top or bottom safe-area clearance. Hiding the header transfers the top edge to the screen. | Zero-inset-only fixtures cannot distinguish duplication; web or static evidence establishes no native-device result. |
| Lint passes, or a check stays green with the violating implementation.                       | The override and edge obligations still need distinguishing observations.                                               | An unrelated or insensitive check does not cover those obligations.                                                  |
| Native-device access is unavailable.                                                         | Record the skipped exercise and its concrete residual risk.                                                             | Static or web checks can establish their own properties, not turn the skip into native verification.                 |

## Verify the Correction Against the Purpose

A symptom can disappear while the requested behavior regresses. [Product validation](https://www.nasa.gov/reference/5-4-product-validation) distinguishes meeting specified requirements from fulfilling the intended use; review remediation needs both. A list-freshness check alone cannot distinguish a correct cache update from a page reload that loses required editor state.

The project's unit- or end-to-end-testing practices, where present, own regression-case and assertion design. Without them, the bounded default is a check of the reported failure and required preserved behavior, with expected results derived from the task or contract rather than the correction's output.

**Example:**

> **Faulty expectation:** A test expects seconds, but the public contract specifies milliseconds. Correcting that test can be justified by the contract. Changing its expectation to whatever the new implementation happens to return cannot establish correctness.

**Guidelines:**

- MUST verify a correction against the intended outcome and relevant behavior that must survive, not only the reported symptom or the reviewer's suggested edit; reproduce the original failure when practicable and disclose when that reproduction is unavailable.
- MUST select checks that distinguish the justified correction from a credible wrong remedy, using the applicable testing practices where present; a generic passing gate or closed review conversation is not evidence of that distinction.
