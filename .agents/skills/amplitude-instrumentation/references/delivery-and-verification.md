# Delivery and Verification

Apply this reference when events are not arriving, when an ad blocker or a content security policy sits between the app and Amplitude, or when deciding what "this instrumentation works" should mean before a change ships. Verification is the step every inspected repository skipped: none of the three has a single test, assertion, or documented manual check covering its analytics.

Verified against [Amplitude's HTTP V2 API documentation](https://amplitude.com/docs/apis/analytics/http-v2) on **2026-08-02**.

## Why Events Go Missing

Client-side analytics has an adversary that server-side code does not. Tracking-prevention extensions and browser features block requests to `amplitude.com` domains outright, so a correct integration can still deliver nothing for a meaningful share of users.

The supported answer is a **domain proxy**: route Amplitude traffic through your own domain. It also becomes the one place a field can be stripped before it reaches Amplitude at all.

The endpoints a proxy must cover:

| Endpoint                 | Carries                      |
| ------------------------ | ---------------------------- |
| `/2/httpapi` or `/batch` | Analytics events             |
| `/sessions/v2/track`     | Session Replay data          |
| `/config`                | Session Replay configuration |

Browser SDK scripts can additionally be self-hosted, so even the script load survives a blocked domain. **Mobile Session Replay does not support custom proxy URLs** and routes directly to Amplitude regardless.

**Guidelines:**

- SHOULD proxy Amplitude traffic through a first-party domain on any web product where blocked analytics would materially bias the data.
- MUST configure every endpoint the integration uses when proxying — analytics and, if replay is enabled, both of its endpoints — since a partial proxy silently loses one signal.
- MUST add each endpoint to the content security policy, and MUST NOT assume the analytics entry covers replay.
- MUST NOT design a mobile architecture that depends on proxying Session Replay; it is unsupported.

## Cross-Domain Identity

When one user crosses two of your domains, identity does not follow automatically. Amplitude's supported mechanism passes `ampDeviceId`, `ampSessionId`, and `ampTimestamp` between them.

Single-page applications have a related failure: an internal navigation can register as a referral from your own site, so your own pages become your top acquisition source.

**Guidelines:**

- MUST pass `ampDeviceId`, `ampSessionId`, and `ampTimestamp` across a domain boundary the same user crosses, or the journey splits into two users.
- MUST configure `excludeReferrers` with the application's own domains to prevent self-referral from corrupting acquisition data.

## Tools for Confirming an Event Arrived

| Tool                     | Answers                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| Ingestion Debugger       | Did the event reach Amplitude, and was it malformed?             |
| User Lookup              | What does this specific user's event stream actually contain?    |
| Instrumentation Explorer | A browser extension for inspecting events as the page emits them |
| `logLevel: Debug`        | What is the SDK doing locally?                                   |
| The `.promise` interface | What status code did this specific call return?                  |

**Guidelines:**

- MUST confirm an event **arrived** rather than that the call was made; a `track` call returns without waiting, so local success proves nothing about delivery.
- MUST verify the event's identity and app version alongside its name and properties, since an event arriving under the wrong user id is a defect that looks like success.
- SHOULD raise `logLevel` to a debug level while wiring, and MUST NOT leave it raised in a release build.
- SHOULD use User Lookup to check a real user's stream after a release, because aggregate charts hide an identity defect that a single user's timeline makes obvious.

## Testing Instrumentation

Analytics code is testable in exactly the way other side-effecting code is: mock the wrapper, assert the call. What is not worth doing is letting the real SDK run in a test suite — it will attempt network calls, write storage, and pollute a project with test traffic.

```typescript
// Assert the fact, at the boundary the application owns.
expect(track).toHaveBeenCalledWith("Checkout Completed", {
  orderTotal: 42.5,
  currency: "USD",
});
```

**Guidelines:**

- MUST keep the Amplitude SDK inert in tests — mock the project wrapper rather than the vendor module, so the assertion is against the application's own contract.
- MUST NOT let a test suite emit to a real Amplitude project; test traffic in production data is indistinguishable from real usage afterwards.
- SHOULD assert the event name and its properties in the test that covers the behaviour producing them, rather than in a separate analytics test that drifts.
- SHOULD run `ampli status` as a coverage check where the project uses Ampli, since a unit test proves an event _can_ fire and not that every planned event exists.

## What Only a Release Build Proves

Several failures are invisible in development. A key that is missing only in the production environment, an ad blocker, a native module that did not link, a consent banner that never grants, autocapture configured remotely rather than in code — none reproduce on a developer's machine.

**Guidelines:**

- MUST verify instrumentation in a release or production-equivalent build before considering it done, because the highest-cost failures do not occur in development.
- MUST check that events arrive with the expected app version, since a version mismatch is how an over-the-air update that failed to carry a native change reveals itself.
- SHOULD watch event volume for the first hours after a release, so a runaway emitter is caught while it is still cheap.
