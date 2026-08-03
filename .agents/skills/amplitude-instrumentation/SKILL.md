---
name: amplitude-instrumentation
description: A task touching Amplitude specifically — "@amplitude/analytics-browser", "@amplitude/unified", "amplitude.init", "amplitude.track", "setUserId", "autocapture", "defaultTracking", "session replay", "Ampli", "tracking plan", "insert_id", "MTU", "serverZone", "identityStorage", "Amplitude MCP", or an Amplitude API key. For vendor-neutral event naming or what-to-track questions, use a software-instrumentation capability instead. The vendor mechanism — SDKs, init, identity and sessions, track and Identify, autocapture, tracking plans, consent, replay, ingestion, and cost.
user-invocable: false
---

# Amplitude Analytics

Use this capability whenever you wire Amplitude into an application, review an integration that already exists, or answer a question about how Amplitude behaves. It owns the **mechanism**: which package, what `init` takes, how identity resolves, what an operator does, what a limit costs when you cross it.

It does not own **what to track, how to name it, or where the call site goes**. Those are vendor-neutral decisions that a product-event-tracking capability in a software-instrumentation skill owns, and this skill defers to it rather than restating it. Nor does it cover the analyst's half of the subject — reading a funnel, a retention curve, or an experiment result — or Amplitude's product and organization administration: charts, dashboards, alerts, RBAC, SSO, billing. Those are where this skill stops.

**Version posture.** Amplitude renames configuration surfaces between minors — `defaultTracking` became `autocapture` in Browser SDK 2.10.0, and `fetchRemoteConfig` is documented in two places at once — and a wrong option key is ignored rather than raising an error. Every reference names the upstream page it was checked against and the date of that check. Treat each as verified-at-that-date, and look it up in the installed version's own documentation before depending on it. Where a surface moves faster than it can usefully be frozen, the reference prescribes a lookup instead of a value.

**Platform scope.** [Browser SDK 2](https://amplitude.com/docs/sdks/analytics/browser/browser-sdk-2) and the [React Native SDK](https://amplitude.com/docs/sdks/analytics/react-native/react-native-sdk) are first-class. iOS, Android, Flutter, Unity, Unreal, and Node are named as families with a prescribed lookup: the concepts carry across them, the method names do not.

This skill stands alone. Amplitude's own MCP servers, published skills, and `.amplitude/` configuration are covered where they change what you should do, but nothing here requires any of them to be installed.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## SDK and Wrapper

See [sdk-and-wrapper.md](./references/sdk-and-wrapper.md) for:

- Choosing between the browser, unified, React Native, and server packages, and the script loader
- Why one client per app, and the narrow case for a second named instance
- What the project wrapper normalizes before Amplitude sees it
- Renamed surfaces that are ignored rather than rejected when you use the old key

## Initialization and Projects

See [initialization-and-projects.md](./references/initialization-and-projects.md) for:

- The `init` signature, what cannot change afterwards, and why init timing decides attribution
- API key handling, the public client key versus the secret and Data tokens, and never a hardcoded fallback
- One project per environment versus one project with an environment property
- Data residency, cross-platform instrumentation, and organization-level identity resolution

## Identity and Sessions

See [identity-and-sessions.md](./references/identity-and-sessions.md) for:

- Device ID, user ID, and the resolved Amplitude ID, and why a user id is unchangeable once set
- Never setting an id for an anonymous visitor, and the merge that makes it permanent
- `reset()` as the logout call, and what `setUserId(undefined)` leaves behind
- Session timeout, session events, and the platform defaults that disagree

## Events and Properties

See [events-and-properties.md](./references/events-and-properties.md) for:

- The `track` call, the transport constraints every SDK event inherits, and silent truncation
- The 2,000 / 2,000 / 1,000 per-project ceilings and what happens past them
- Event properties versus user properties, and choosing the right `Identify` operator
- Groups, the `Revenue` object, batching defaults, and `insert_id` deduplication

## Autocapture and Plugins

See [autocapture-and-plugins.md](./references/autocapture-and-plugins.md) for:

- The web option set with defaults, the events it emits, and the absence of autocapture on React Native
- Remote configuration, and why the repository stops being the record of what an app collects
- The privacy protections that apply automatically, and the masking attributes that do not
- Enrichment versus destination plugins, and returning `null` as the drop-and-redact hook

## Tracking Plan and Ampli

See [tracking-plan-and-ampli.md](./references/tracking-plan-and-ampli.md) for:

- Sources, events, properties, and Amplitude's own naming convention
- Plan branches mapped onto Git branches, and publishing when the code merges
- What Observe cannot see, and why rejecting a violation destroys data
- The Ampli commands, `ampli status` as a CI coverage check, and when a hand-written wrapper wins

## Data Repair

See [data-repair.md](./references/data-repair.md) for:

- Query-time transformations, what they can fix, and the three constraints on them
- Hide versus block versus delete versus drop, and which one a requirement actually needs
- Repair constructs whose availability depends on the plan
- Why every tool here is a stopgap and the emitter still has to be fixed

## Privacy and Consent

See [privacy-and-consent.md](./references/privacy-and-consent.md) for:

- Why `optOut` does not prevent cookies, and what that means for a pre-consent promise
- The three consent models, and the absence of any built-in CMP integration
- `identityStorage` modes and what `none` costs in analytics terms
- Separate projects for consented and non-consented streams, and the identifier-reuse trap
- Advertising identifiers, IP derivation, deletion, and the re-ingestion trap

## Session Replay

See [session-replay.md](./references/session-replay.md) for:

- Plugin versus standalone, and `sampleRate` defaulting to zero so a correct-looking integration records nothing
- Targeted capture and the absence of any lookback before the trigger
- Mask levels, the element-level controls, and the attribute values no level masks
- Replay following the analytics SDK's `optOut`, and the separate privacy review it earns

## Experiment Interface

See [experiment-interface.md](./references/experiment-interface.md) for:

- `[Experiment] Exposure` versus `[Experiment] Assignment`, and which one analysis runs on
- The `[Experiment] <flag_key>` user property and its per-project ceiling
- Why the built-in events are billing-exempt and a custom substitute is not
- Local versus remote evaluation, and where this stops and experimentation begins

## Server and APIs

See [server-and-apis.md](./references/server-and-apis.md) for:

- Per-call identity on a server, and the global setter that corrupts concurrent requests
- HTTP V2 versus Batch Event Upload, the regional endpoints, and the limits that shape a producer
- `insert_id` as the retry contract, and which failures are worth retrying
- Which credential each API takes, and what belongs server-side only

## Cost and Limits

See [cost-and-limits.md](./references/cost-and-limits.md) for:

- MTU versus event volume, and the guardrail that ties them together
- What counts toward volume and what does not, including hidden and autocaptured events
- Unlinked devices inflating MTU, and why a fix can make the number fall
- What a runaway release costs, and why sampling is a contract decision

## Delivery and Verification

See [delivery-and-verification.md](./references/delivery-and-verification.md) for:

- The domain proxy, the endpoints it must cover, and CSP entries
- Cross-domain identity parameters and the self-referral problem
- The Ingestion Debugger, User Lookup, debug logging, and confirming an event actually arrived
- Mocking the wrapper in tests, and what only a release build proves

## Browser

See [browser.md](./references/browser.md) for:

- Script loader versus npm, and the promise interface
- The cookies Amplitude writes and the `identityStorage` choice behind them
- Attribution read at init, `excludeReferrers`, and page views in a single-page application

## React Native

See [react-native.md](./references/react-native.md) for:

- AsyncStorage backing both storage slots, and what overriding only one degrades
- Declaring it in `dependencies`, with the autolinking caveat that makes the mistake survivable
- No autocapture, session events off by default, and the over-the-air native-code rule
- Expo Go, the compatibility matrix, and the latest-only support policy

## Agent Tooling

See [agent-tooling.md](./references/agent-tooling.md) for:

- The Amplitude MCP server, its endpoints, permission inheritance, and that it is not an ingestion path
- Reading an existing definition before renaming instrumentation
- Never copying customer data out of Amplitude into a repository
- Amplitude's published skills, `.amplitude/` configuration, and reviewing scaffolded code
