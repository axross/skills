---
status: accepted
---

# Separate loop contracts from host authority

The portable loop previously treated a standing project mandate as satisfying
any host condition requiring a human delegation request. That interpretation
could authorize a purpose the host never permitted. It also made one host's
actor ranking, shared checkout, live communication, and scheduler assumptions
prerequisites for a policy meant to travel between hosts.

We replaced that interpretation with a boundary between change-state meaning
and execution authority. This supersedes
`2026-08-20-move-the-delegation-determination-to-phase-1-and-satisfy-a-conditional-policy-with-a-standing-mandate.md`.
Project policy still chooses gates, while current host instructions decide
which execution tools and purposes are permitted. Missing delegation is not
missing verification, and a child's completion is not a completed change.

Adding Amp branches throughout the skill would preserve the coupling.
Duplicating the library per host would let approval and review policy drift.
A new generic orchestration skill would merely move the same authority claim
elsewhere. Small prose-compatible handoffs instead preserve the evidence each
phase needs without replacing the host's contract.

The cost is a staged migration: host guidance, GitHub persistence, and entry
routing need separate integration. The portable boundary is usable through
permitted published tools without an adapter, but this change alone does not
establish whole-host compatibility. Existing approval identities, finding
dispositions, review independence, recovery evidence, and numeric caps remain
constraints rather than cleanup opportunities.
