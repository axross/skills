# Privacy and Consent

Apply this reference when wiring consent, handling a data-subject request, or reviewing what an Amplitude integration collects. None of the three inspected repositories has any consent handling at all, which is the usual starting point: consent is added after a legal review rather than when the SDK goes in.

Verified against [Amplitude's privacy-and-consent implementation guide](https://amplitude.com/docs/data/privacy-and-consent-implementation) on **2026-08-02**.

## The Rule Everything Else Follows From

> _"Amplitude may create cookies as soon as the SDK initializes, regardless of the user's opt-out status. If you require that no cookies exist before consent, defer SDK initialization until after the user provides consent."_

`optOut` stops events. It does not stop initialization from writing cookies. Any consent posture that promises "no cookies before consent" is satisfied only by not calling `init`.

**Guidelines:**

- MUST NOT call `init` before consent when the project's posture is that no cookies exist before consent; no configuration option achieves this after initialization.
- MUST NOT treat `optOut: true` as equivalent to not initializing — it suppresses events while cookies are already written.

## The Three Consent Models

| Model                           | How it works                                                                  | Costs                                                          |
| ------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Deferred initialization**     | Queue or discard events in your own code; call `init` only once consent lands | Strictest, and the only one that writes no cookies pre-consent |
| **Initialize opted out**        | `init` with `optOut: true`, flip it when consent arrives                      | Cookies exist from initialization                              |
| **Consent management platform** | A CMP holds the consent state and your code initializes accordingly           | Amplitude ships **no default integration** with any CMP        |

**Guidelines:**

- MUST choose the consent model deliberately against the project's legal posture rather than adopting whichever is easiest to wire.
- MUST write the CMP integration yourself, since Amplitude provides no built-in integration with any consent platform.
- SHOULD keep the consent decision in one module beside the SDK, so what happens before consent is reviewable in one place.
- MUST re-check consent on return visits rather than assuming a prior grant persists, because the storage holding that grant may itself be consent-gated.

## Identity Storage and Consent

`identityStorage` interacts directly with consent posture:

- `cookie` — the default; standard cookie persistence.
- `localStorage` — same data, scoped per subdomain.
- `none` — **a new `device_id` on every visit**. No persistent client identifier, and no way to count an anonymous returning visitor.

`none` is the option a strict posture reaches for. It genuinely reduces what is stored, and it genuinely destroys anonymous-visitor analytics — an honest trade, not a free one.

**Guidelines:**

- MUST state the analytics consequence when adopting `identityStorage: "none"` — anonymous visitors become uncountable and every visit is a new user.
- SHOULD classify the `AMP_` and `AMP_MKTG_` cookies correctly in the consent banner rather than leaving them uncategorised.

## Consented and Non-Consented Streams

Where a product tracks both consented and non-consented users, the supported approach is **separate Amplitude projects** — one per stream.

The trap is identifier reuse. If the same device id or user id appears in both projects, the separation is nominal: the two datasets can be rejoined by the identifier they share, and the non-consented stream is no longer non-identifying.

**Guidelines:**

- MUST use separate projects for consented and non-consented streams rather than a property distinguishing them within one project.
- MUST NOT reuse device ids or user ids across the two projects, because a shared identifier makes the separation reversible and defeats its purpose.

## What Amplitude Derives, and Turning It Off

Amplitude derives location from IP address. `trackingOptions.ipAddress`, `.language`, and `.platform` each default to `true` and each can be turned off. A **domain proxy** is the other lever: it is the point at which a field can be stripped before it ever reaches Amplitude.

**Guidelines:**

- MUST disable IP collection at the SDK when the privacy posture forbids IP-derived location, rather than planning to delete it after ingestion.
- SHOULD strip fields at a domain proxy when they must never reach Amplitude at all, since post-ingestion controls act on data already stored.

## Advertising Identifiers

Amplitude's guidance distinguishes the vendor-scoped identifiers from the advertising ones: **IDFV** (iOS) and **App Set ID** (Android) are recommended; **IDFA** and the Android Advertising ID are not.

**Guidelines:**

- SHOULD use IDFV or App Set ID where a platform identifier is needed, and MUST NOT collect IDFA or the Android Advertising ID for analytics purposes.
- MUST NOT send an advertising identifier as the Amplitude user id under any circumstances.

## Deletion, Access, and Retention

Amplitude provides a **User Privacy API** for deletion requests and a **DSAR API** for access requests, plus Data Access Control, Time to Live settings, and bot/internal-traffic blocking.

The re-ingestion trap is the part that surprises people: deleting a user does not stop the client from sending that user again. If the app is still running with the same identifiers, the deleted profile reappears.

**Guidelines:**

- MUST stop the source from emitting for a deleted user before issuing the deletion, or the profile is recreated by the next event.
- MUST use the User Privacy API for deletion rather than blocking or hiding, since neither removes stored data.
- SHOULD configure bot and internal-traffic blocking, because internal traffic distorts every metric and counts toward volume.
- SHOULD confirm the project's Time to Live and Data Access Control settings with whoever owns the Amplitude organization, as neither is visible from the SDK.
