# Consulting and Upkeep

## Consult before planning

Start with the index. Open the pages whose descriptions match the task and
follow any precondition or authority the change could affect. A plan names the
pages that will become inaccurate. If none of the routes concerns the change,
say so and stop reading. Revisit the list if implementation reveals a new
dependency.

## Find the affected claim

| Change                                            | Consult                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| A metric changes eligibility, units or weighting  | Its Definition and the Specifications that consume it                        |
| A mode returns a different result or error        | Its result Specification and readers that present the value                  |
| Responsibility moves between components           | The Architecture, diagrams and operational diagnostics that use the boundary |
| A team changes an implementation practice         | Its Convention, counterexamples and enforcement                              |
| A release permission changes                      | The Policy and each entry point that relies on it                            |
| A command, prerequisite or success signal changes | Its Procedure and the caller's route to recovery                             |
| A term, file or heading moves                     | Glossary conventions, indexes, inbound links and external anchors            |

## Record what became true

Write observable behavior in the present tense. Distinguish a target
architecture the team has adopted from the components deployed today. Carry a
settled constraint and the reason it still holds into the page whose reader
applies it. Replace the old rationale when it no longer explains the rule.
Leave proposals and unimplemented alternatives with the plan.

After extraction, check a boundary case without reading the original page.
Trace a consumer from the index to the result contract and an operator from a
release entry point to its authority. A change that removes a feature also
retires its obsolete routes; preserve a forwarding route if an external reader
still depends on the old address. Run the [validators](./validators.md) and
read the changed pages independently of their diff.
