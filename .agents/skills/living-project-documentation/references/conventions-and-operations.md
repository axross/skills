# Conventions and Operations

## Placing a project rule

Ask where a contributor would discover the violation. A client receiving a
missing field encounters a contract violation, so the field and missing-value
behavior go together in the Specification. A reviewer encountering a choice of
directory layout looks for the Convention and its reason, even if a linter
enforces it. An operator diagnosing a queue backlog needs the Architecture to
identify the producer and consumer before consulting a recovery Procedure.

Record the constraint, the reasoning that still governs it and a recognizable
counterexample in one place. Link to the governing practice when it is already
documented. Keep historical deliberation with the change. A project that uses
ADRs can retain them and link to the decision when its provenance matters.

## Permission and execution

Several release paths may share one decision about who can authorize a
production rollout. If that decision changes independently, give it one Policy
owner. Include the scope, exception authority and conditions for reopening
exactly as the project adopted them. Point every release entry point, including
emergency and manual paths, to that authority.

The release operator may need an activation Procedure, while the device
operator needs a Procedure for verifying installation and restoring service.
Name prerequisites, observable success and recovery for each. If the same
operator performs a single task with a locally scoped permission check, keep
that check with the steps. Do not invent an approver or a separate policy page
to populate the vocabulary.

## Contributor routes

Keep links from setup instructions, contributor guides and always-loaded agent
instructions at the point where a reader chooses the next task. Move the
actual rule to its governing page and point editable callers directly there.
