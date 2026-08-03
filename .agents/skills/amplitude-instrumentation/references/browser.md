# Browser

Apply this reference when wiring Amplitude into a web application — choosing between the script loader and npm, handling cookies and domains, or getting attribution and page views right in a single-page application.

Verified against [Amplitude's Browser SDK 2 documentation](https://amplitude.com/docs/sdks/analytics/browser/browser-sdk-2) on **2026-08-02**.

## Script Loader Versus npm

The script loader drops a `<script>` tag and enables autocapture for you. The npm package gives you the module, the types, and version control in the lockfile.

| Install       | Reach for it when                                                                   |
| ------------- | ----------------------------------------------------------------------------------- |
| Script loader | A marketing site or a page you cannot rebuild; autocapture is the whole integration |
| npm           | An application with a build step, a typed wrapper, and a review process             |

**Guidelines:**

- SHOULD install from npm in any application with a build step, so the SDK version is pinned in the lockfile and the wrapper can be typed against it.
- MUST NOT run both the script loader and the npm package on one page; two clients means two device ids and duplicated autocaptured events.
- SHOULD check what the script loader enabled before adding instrumentation to a page that already has it, because its autocapture defaults differ from a bare `init`.

## The Promise Interface

Every asynchronous call exposes a promise, which is how you confirm an event actually reached Amplitude rather than merely being queued.

```typescript
const result = await amplitude.track("Checkout Completed", props).promise;
result.code; // HTTP status
result.message; // response message
```

**Guidelines:**

- SHOULD await the promise in a verification test or a debugging session to confirm delivery and read the status code.
- MUST NOT await the tracking promise on a user-facing path; the point of the queue is that the user never waits for analytics.

## Cookies and Domains

Amplitude writes a small set of cookies — an identity cookie named `AMP_` plus the first ten characters of the API key, a marketing cookie prefixed `AMP_MKTG_`, and temporary `AMP_TEST_`/`AMP_TLDTEST_` capability probes that remove themselves. What each holds is in [Amplitude's cookies and consent-management documentation](https://amplitude.com/docs/sdks/analytics/browser/cookies-and-consent-management).

Two facts that page does not lead with, and that a consent banner has to account for: the whole set is roughly **240 bytes** per project API key, and the identity cookie carries the `userId` Base64-encoded rather than hashed — so it is readable by anything that can read the cookie.

`identityStorage` selects where identity lives: `cookie` (the default), `localStorage` (scoped per subdomain), or `none`.

**Guidelines:**

- MUST NOT set `identityStorage: "none"` without accepting that a **new device id is generated on every visit**; identity then resolves only through a user id, and anonymous visitors are uncountable.
- SHOULD use `localStorage` rather than `cookie` only when the subdomain scoping it implies is what the product actually wants, since cookie storage is what allows one identity across subdomains.
- MUST account for the `AMP_` and `AMP_MKTG_` cookies in the site's cookie policy and consent banner, because they exist regardless of whether the banner mentions them.

## Marketing Attribution

Attribution is on by default and is read **at initialization**, from the URL and referrer present at that moment. Two consequences follow: an `init` that runs before a redirect resolves records the wrong source, and in a single-page application a client-side navigation is not a new page load, so nothing re-reads attribution.

`excludeReferrers` keeps your own domains from registering as referrals — the classic symptom being your own checkout page appearing as the top acquisition source.

**Guidelines:**

- MUST configure `excludeReferrers` with the application's own domains, or internal navigation registers as external referral traffic and corrupts acquisition reporting.
- MUST initialize after the final URL is known, since attribution is captured once at init and a pre-redirect init attributes the visit wrongly.
- SHOULD verify attribution against a real campaign URL rather than assuming defaults are correct, because the failure is invisible in the code and obvious only in a chart.

## Page Views in a Single-Page Application

Autocapture's `pageViews` handles ordinary page loads. A client-side route change is not a page load, and whether the SDK observes it depends on the installed version and the router. This is the single most common source of "our page views stopped after we migrated to a SPA framework".

**Guidelines:**

- MUST verify page views actually fire on client-side navigation in the app's own router rather than assuming autocapture covers it.
- MUST NOT add a hand-written page-view event alongside a working autocaptured one; confirm which is firing first, then keep exactly one.
- SHOULD emit page views from one place — either autocapture or a single router subscription — so the count has one source.

## Web Vitals

`webVitals` is off by default. When enabled it emits performance measurements as ordinary Amplitude events, which means they consume event volume and occupy the taxonomy alongside product events.

**Guidelines:**

- SHOULD enable `webVitals` only when someone is actually charting performance in Amplitude, since the events cost volume like any other.
- SHOULD keep performance monitoring in a dedicated tool where one exists, and treat Amplitude web vitals as a convenience rather than a replacement.
