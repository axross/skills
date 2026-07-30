# Agent Tooling

Apply this reference when an agent has Amplitude tooling available — the MCP server, Amplitude's own published skills, or its instrumentation CLI — and needs to know what each is for and where the boundaries are. This skill stands on its own: everything in it works with none of this tooling installed. What follows is what changes when it is.

Verified against Amplitude's documentation on **2026-07-29**.

## The Amplitude MCP Server

| Property       | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| US endpoint    | `https://mcp.amplitude.com/mcp`                                    |
| EU endpoint    | `https://mcp.eu.amplitude.com/mcp`                                 |
| Authentication | OAuth 2.0 with Amplitude                                           |
| Discovery      | Append `?discovery=progressive` for token-efficient tool discovery |

It is added to an agent as an HTTP MCP server at one of those URLs, authenticating through OAuth; consult the agent's own MCP configuration documentation for the exact invocation.

The server exposes tools across roughly nine families — discovery and context, content retrieval, taxonomy, session replay, query and analysis, creation, cohort sync, branch management, and guides/surveys/feedback.

Two properties govern how it should be used:

- **It inherits the authenticating user's permissions.** It grants no elevated access and respects role-based restrictions, so what it can reach is what that person can reach.
- **It is not an ingestion endpoint.** In Amplitude's words: _"The MCP isn't an ingestion endpoint. Emit events with an Amplitude SDK or the HTTP V2 API."_

**Guidelines:**

- MUST NOT attempt to send events through the MCP server; ingestion goes through an SDK or the HTTP V2 API.
- MUST select the MCP endpoint matching the organization's data residency, as with every other Amplitude endpoint.
- SHOULD use `?discovery=progressive` so the tool surface is disclosed on demand rather than loaded whole.
- MUST remember that the server acts as the authenticated person, so an action taken through it is that person's action and carries their access.

## Reading Before Writing

The MCP server's most valuable use in an instrumentation task is not creation — it is finding out what already exists. An event's current definition, the properties actually arriving, the charts built on it, and whether anyone queries it at all are all questions the repository cannot answer and the server can.

**Guidelines:**

- SHOULD read the existing event definition and its usage before changing or renaming instrumentation, since a rename breaks every chart and cohort built on the old name.
- SHOULD check whether an event is actually queried before spending effort on it, and whether a planned event is arriving before adding another.
- MUST NOT copy customer data out of Amplitude into a repository, an issue, a commit message, or a pull request. Query results contain real user records, and a repository is the wrong place for them — including in a debugging note.
- SHOULD summarise a finding in aggregate terms rather than pasting rows, when a result must be recorded at all.

## Amplitude's Documentation MCP Server

Amplitude also publishes a documentation MCP server, which answers questions about the product from current documentation rather than from an agent's training data. For a vendor whose option names move between minors, that is the difference between a rule that is right and one that was right.

**Guidelines:**

- SHOULD consult Amplitude's own documentation tooling for any version-sensitive claim rather than relying on recall, since this is precisely the surface that moves.
- MUST state which version or date a looked-up claim was verified against when writing it into code or documentation.

## Amplitude's Published Skills and Config Files

Amplitude publishes agent skills of its own, and its instrumentation tooling reads project-level configuration from an `.amplitude/` directory. A repository may therefore already carry Amplitude-specific agent context that this skill did not put there.

Amplitude also ships a wizard CLI that scaffolds an integration — useful for a first install, and worth reviewing rather than trusting, since it writes the initialization code that this skill's rules apply to.

**Guidelines:**

- SHOULD check for an `.amplitude/` directory when picking up a repository, since configuration there shapes what Amplitude's own tooling does and may contradict the project's conventions.
- MUST review scaffolded initialization code against this skill's rules rather than accepting it as correct — a wizard optimises for working quickly, not for consent gating, key handling, or identity discipline.
- MUST NOT let a generated integration ship with a key literal, an unset `sampleRate`, or an unconsidered autocapture default, whichever tool produced it.
- SHOULD look up the current contents and filenames of Amplitude's agent configuration before depending on them, as this tooling is newer and moving faster than the SDKs.
