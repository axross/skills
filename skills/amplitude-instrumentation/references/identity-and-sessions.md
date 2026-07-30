# Identity and Sessions

Apply this reference when wiring login, logout, or anonymous-to-known transitions, or when deciding what a session means in your product. Identity is where Amplitude integrations do their most expensive damage: a user id set on an anonymous visitor cannot be taken back, and a missing `reset()` on logout merges two people into one profile.

None of the three inspected repositories called `identify`, set a user id correctly, or reset on logout. This reference is written against that floor.

Verified against Amplitude's documentation on **2026-07-29**.

## The Three Identifiers

| Identifier   | Set by                          | Lifetime                                                        |
| ------------ | ------------------------------- | --------------------------------------------------------------- |
| Device ID    | The SDK, automatically          | Per device and storage scope, until storage clears or `reset()` |
| User ID      | Your code, after authentication | Permanent once set — it is the durable identity                 |
| Amplitude ID | Amplitude's backend             | Resolved from the other two; never set directly                 |

The Amplitude ID is the one that actually counts a person. Amplitude resolves it by merging device ids that have been seen with the same user id, which is what lets pre-login activity attach to a user who signs up later — but only in that direction.

**Guidelines:**

- MUST NOT set a user id for an anonymous visitor — not a generated UUID, not a device id, not a session token. Amplitude cannot un-merge the profiles this creates, and the merge is what makes the damage permanent.
- MUST set the user id only from an authenticated identity your backend issued, at the moment authentication completes.
- SHOULD let the SDK own the device id and MUST NOT overwrite it with `setDeviceId` unless migrating from another SDK with a recorded reason.
- MUST respect the five-character minimum on both ids — `minIdLength` defaults to `5`, and a shorter id is rejected at ingestion rather than truncated.

> **Found in `axross/aqua`**: `setUserId` is called with an anonymous identifier. Every device that has ever run the app is now one Amplitude user, and no later fix separates them.

## Login, Logout, and the Anonymous Transition

```typescript
// Sign-in: attach this device's prior anonymous activity to the real user.
amplitude.setUserId(user.id);

// Sign-out: forget the user AND the device, so the next person is a new person.
amplitude.reset();
```

`reset()` clears the user id and generates a fresh device id. Calling only `setUserId(undefined)` leaves the device id in place, so the next user on that device inherits the previous one's device history.

**Guidelines:**

- MUST call `reset()` on logout, not `setUserId(undefined)`, so the device id rotates along with the user id.
- MUST NOT call `reset()` on app background, navigation, or token refresh; it discards the device identity and inflates the user count.
- SHOULD set the user id before emitting the first post-login event, so that event carries the resolved identity rather than arriving under the anonymous device alone.
- MUST treat the User Mapping API as a backfill tool for linking ids after the fact, and MUST NOT expect it to merge user properties — it maps identities, and property values do not follow.

## Sessions

A session is an inactivity window, not a login. `sessionTimeout` defaults to **1,800,000 ms (30 minutes)** on both the Browser and React Native SDKs: an event more than that long after the previous one starts a new session.

Session **events** — `Start session` and `End session` — are a separate question from session _tracking_, and the default differs by platform. On the Browser SDK, `sessions` is part of autocapture and is **on** by default. On the React Native SDK, `trackingSessionEvents` defaults to **`false`**.

> **Found in `axross/aqua`**: `trackingSessionEvents(true)` is set explicitly. That is a defensible choice, but it doubles the event volume attributable to sessions and nothing in the repository records why it was made.

**Guidelines:**

- MUST decide deliberately whether session events are emitted, and record the decision — the platform defaults disagree, so inheriting them produces different data from web and mobile in one project.
- SHOULD leave `sessionTimeout` at its 30-minute default unless the product has a documented reason, because changing it silently redefines every session-based metric already charted.
- MUST NOT treat a session as a login or a visit; it is an inactivity window, and a single logged-in user generates many.
- SHOULD set `setSessionId` only when adopting an externally-defined session, and MUST pass epoch **milliseconds** when doing so.
- MUST NOT emit session events from both autocapture and hand-written code; the duplicate pair breaks every session-length calculation.

## Identity Across Platforms

When web and mobile report into one project, the same person carries two device ids until a user id links them. That is expected and correct — but it means every unlinked device is its own tracked user until login happens, which is a cost question as much as a correctness one.

**Guidelines:**

- SHOULD set the user id on every platform the moment authentication resolves, since an unlinked device counts separately until it is linked.
- MUST use the same user id value across platforms — the backend's canonical user identifier, not a per-platform account id — or the profiles never merge.
