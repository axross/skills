# Channel Selection

Apply this reference when qualifying a GitHub channel or handling a failure. A route is qualified for a particular operation in the current session, not for every operation on a named host.

## Qualify an Authenticated Route

The sanctioned channel is the harness's GitHub tool channel: for example, GitHub MCP in a configured Claude Code session. Neither the name Amp nor the absence of MCP establishes what other routes work. A permitted alternative is an authenticated, high-level route the session already provides, such as a GitHub CLI operation.

Two channel properties can justify an alternative:

- **Absent:** the session exposes no GitHub tool channel.
- **Functionally limited:** the channel exposes the operation but cannot normally complete or verify it faithfully, such as a body read that removes HTML comments.

An authentication failure, timeout, rate limit, or 5xx is neither property. It is a failed invocation, not permission to switch credentials. A channel that exposes no write operation is also different from an absent channel: its missing operation is not an escape hatch.

**Guidelines:**

- MAY select another authenticated, high-level route only when the sanctioned channel is absent or has an established normal-operation limitation for the requested operation.
- MUST establish the alternative's presence and authenticated identity without printing credentials; keep tokens out of commands, logs, and output.
- MUST qualify the route's operation, target, required fidelity, and verification capability under the current host restrictions and least permission needed.
- MUST NOT use an alternative to reach an operation a present sanctioned channel does not expose, or to bypass a prohibited purpose.
- MUST NOT treat a transient invocation failure as grounds to switch routes or credentials; report the failure and apply [publication-and-recovery.md](./publication-and-recovery.md) if an effect may have occurred.
- MUST report the current session's observed capability or limitation, not a universal claim about a host, cloud environment, or private repository.

## Keep Raw Operations Default-Deny

A raw REST or GraphQL call is not authorized merely because a high-level command is unavailable. Some harnesses normally restrict GraphQL operations while serving REST reads. Establish that functional limitation rather than relabeling any high-level error as one.

The following consequences keep a raw operation denied, except for the bounded conversation-resolution condition in [Qualify Addressed-Thread Resolution](#qualify-addressed-thread-resolution):

| Property                     | Examples                                                               |
| ---------------------------- | ---------------------------------------------------------------------- |
| Irreversible                 | Merging a pull request; deleting or force-updating a ref               |
| Silently wrong               | Replacing a whole label list; replacing a body from an unverified read |
| Privilege- or gate-affecting | APPROVE or REQUEST_CHANGES; collaborator permissions; Actions secrets  |
| Outward-facing or costly     | Dispatching a workflow; publishing a release                           |

**Guidelines:**

- MUST treat raw routes as default-deny: an operation is eligible only when it has none of these consequences, or qualifies for the addressed-thread exception below, serves something the sanctioned channel cannot serve under the channel-selection rules above, and satisfies every other access and authorization rule.
- MUST classify unlisted operations by those consequences, not by whether the table names them.
- MUST NOT infer write permission from a raw route that supplies stored bytes for reading.
- MUST NOT substitute ordinary comments for findings required on diff lines. A top-level COMMENT review is an alternative only when inline findings are not required; otherwise report the unavailable review operation.

## Qualify Addressed-Thread Resolution

Closing a substantively addressed review conversation can satisfy a conversation-resolution merge condition. Completing that granted condition differs from creating a review verdict, changing protection, or concealing an outstanding finding. This exception removes only that condition-based denial, not the other raw-operation boundaries.

**Guidelines:**

- SHOULD prefer an eligible authenticated high-level resolution operation when one exists.
- MAY qualify raw resolution of a specific, substantively addressed review thread when the channel-selection rules above permit the alternative, the actual host/tool permits the operation, identity and target are established, and a valid grant covers resolution and its material downstream effects.
- MUST establish disposition through the change-loop owner's authority contract where present; otherwise require an actual human closure decision covering the outstanding matters. A sufficiently specific human instruction can supply both that decision and the operation grant; do not invent a second approval. A generic instruction to handle review does not establish an informed dismissal.
- MUST NOT deny that resolution solely because it satisfies the granted conversation-resolution condition, or require privileged protection reads solely to prove that no such condition effect exists.
- MUST keep every other raw-disqualifying consequence denied even when authorized. Resolution causing an irreversible automatic merge is outside this exception; assess any separately eligible high-level route independently and never infer merge authority from a resolution grant.
- MUST preserve the existing present-sanctioned-channel missing-operation restriction, host prohibitions, permission prompts, and route/credential boundaries. This exception covers resolving only, not reopening, review dismissal, verdict creation, protection changes, fabricated checks, or bypassing an outstanding finding.

### Assess Material Downstream Effects

A failed administrative read does not establish a resolution-mutation rejection. It can still leave evidence missing that is necessary to qualify the route or its effects. Assess what matters to this operation, not every conceivable automation.

**Guidelines:**

- MUST assess documented or observable material downstream effects, including enabled auto-merge, before qualification.
- MUST stop before resolution when unavailable evidence is necessary to establish route eligibility or grant coverage; report the specific unknown and the evidence or informed authorization needed. Authorization cannot make another raw-disqualifying consequence eligible.
- MUST NOT require an unbounded administrative audit to prove that no conceivable automation exists, or treat schema availability or viewer capability as an operation grant.
- MUST report administrative read failure, resolution not attempted under the current route policy, and an observed mutation rejection as different observations; do not substitute one for another.
