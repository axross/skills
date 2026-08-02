# Autocapture and Plugins

Apply this reference when enabling autocapture, auditing what it already sends, or writing a plugin to enrich or drop events. Autocapture is the fastest way to get data into Amplitude and the fastest way to get data you did not intend to collect — it emits a fixed event and property schema without a line of instrumentation, which makes it a validation contract you inherit rather than one you write.

Verified against [Amplitude's Browser SDK 2 documentation](https://amplitude.com/docs/sdks/analytics/browser/browser-sdk-2) on **2026-08-02**.

## Platform Support

This is the single most consequential fact in the reference, because it inverts an assumption carried over from web:

> **The React Native SDK has no autocapture.** Every event in a React Native app is hand-written through `track`. Web, iOS, and Android have autocapture; React Native does not.

**Guidelines:**

- MUST NOT assume screen views, sessions, or element interactions arrive automatically in a React Native app; nothing is captured that the code does not emit.
- MUST check the installed SDK's own documentation for autocapture support before planning instrumentation around it, since support and defaults differ per platform.

## The Web Option Set

The option is `autocapture`; `defaultTracking` is the deprecated name it replaced in Browser SDK **2.10.0**. Each sub-option and its default is listed in the [Browser SDK 2 reference](https://amplitude.com/docs/sdks/analytics/browser/browser-sdk-2).

Two things that list does not tell you. The defaults split into an **on** group — attribution, page views, sessions, form interactions, file downloads, page-URL enrichment — and an **off** group led by `elementInteractions`, and the split is not arbitrary: what is off is what is high-volume or high-cardinality. And the defaults differ per platform, so a project reading the web list and assuming it holds elsewhere is wrong twice over.

The events these emit — `Page viewed`, `Start session`, `End session`, `Form started`, `Form submitted`, `File downloaded`, `Element clicked`, `Element changed`, `Network request`, `Web vitals` — occupy the project's 2,000-event-type ceiling and appear in the taxonomy alongside hand-written events.

On iOS and Android, sessions is enabled by default and app lifecycles, screen views, and element interactions are not.

**Guidelines:**

- MUST treat the autocaptured event and property names as a schema the tracking plan has to account for, not as free data outside the taxonomy.
- SHOULD enable `elementInteractions` deliberately rather than reflexively — it is off by default because it produces high-volume, high-cardinality events keyed on DOM structure.
- MUST NOT hand-write an event that duplicates an autocaptured one; two `Page viewed` sources double every page-view metric.
- SHOULD confirm which autocapture options are on in an existing project before adding instrumentation, since the answer may live in remote configuration rather than in the repository.

## Remote Configuration

Autocapture can be configured from the Amplitude UI rather than from code, and the SDK fetches that configuration at runtime — `remoteConfig.fetchRemoteConfig` defaults to `true`.

This is a genuine trade. It lets a non-engineer change collection without a release, and it means **the repository is no longer the source of truth for what the app collects**. A code review cannot tell you what an app is capturing.

**Guidelines:**

- MUST NOT treat the `init` options as a complete record of what the app collects when remote configuration is enabled; check the Amplitude UI too.
- SHOULD disable remote configuration when the project requires that collection changes go through code review, and record that as a deliberate decision.
- MUST verify a collection-related privacy claim against the live remote configuration rather than against the source, because the source can be correct while the running app is not.

## Privacy Defaults That Are Load-Bearing

Autocapture's defaults do real privacy work, and knowing which protections are automatic tells you which ones you must add.

Automatic, without configuration:

- Text inputs and `contenteditable` elements contribute **only class names and the `type` attribute** — the text a user typed is excluded.
- Password and hidden fields likewise contribute only class and type.
- Pattern matching masks text that looks like a **credit card number, social security number, or email address**.
- Clicked elements contribute their displayed `textContent`, while value attributes, event handlers, style attributes, and React-specific attributes are suppressed.

Manual controls:

| Control                    | Effect                                                    |
| -------------------------- | --------------------------------------------------------- |
| `data-amp-mask`            | Redacts an element's text content recursively as `*****`  |
| `data-amp-mask-attributes` | Masks named HTML attributes across child elements         |
| `data-amp-track-*`         | Explicitly permits specific data through the restrictions |
| RegEx masking              | Custom pattern-based redaction, configured on the SDK     |
| URL exclude/allow lists    | Restrict capture by domain or path, in Data Settings      |

Where an exclude list and an allow list name the same pattern, **the exclude list wins**.

**Guidelines:**

- MUST apply `data-amp-mask` to any element rendering personal data as text, because the automatic protections cover typed input and known patterns — not arbitrary rendered content.
- MUST NOT rely on pattern masking as a PII control; it catches three recognisable formats and nothing else.
- SHOULD audit what `textContent` autocapture actually collects on pages that render names, addresses, or account identifiers, since displayed text is captured by default.
- MUST NOT use `data-amp-track-*` to re-admit sensitive data that a default protection excluded.

## Plugins

Plugins are the supported extension point. An **enrichment** plugin transforms an event on its way out; a **destination** plugin sends it somewhere else. The enrichment hook is also the drop hook: returning `null` discards the event.

```typescript
// Enrichment: redact one property, and drop internal traffic entirely.
amplitude.add({
  name: "redact-and-filter",
  type: "enrichment",
  execute: async (event) => {
    if (isInternalUser(event)) return null; // dropped
    delete event.event_properties?.email;
    return event;
  },
});
```

**Guidelines:**

- MUST use an enrichment plugin returning `null` to drop or redact an event before it leaves the client, rather than filtering after ingestion where the raw value has already been stored.
- SHOULD put cross-cutting property enrichment in a plugin instead of repeating it at every call site.
- MUST NOT perform blocking or failure-prone work inside a plugin; it runs on the event path and an exception there costs events.
- SHOULD prefer an official Amplitude plugin over a hand-written one where it exists, and pin its version alongside the SDK's.
- MAY override `transportProvider` to control how requests are sent, and MUST verify the replacement preserves retry and batching behaviour before relying on it.
