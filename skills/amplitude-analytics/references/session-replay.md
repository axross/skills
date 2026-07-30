# Session Replay

Apply this reference when adding Amplitude Session Replay, tuning what it captures, or reviewing its privacy posture. Session Replay records what a user saw and did. That makes it the highest-privacy-risk surface Amplitude offers and the one most likely to capture something nobody intended, so it earns a privacy review of its own rather than inheriting the analytics integration's.

Verified against Amplitude's documentation and the published SDK READMEs on **2026-07-29**.

## Plugin Versus Standalone

Two browser packages, and they are not interchangeable:

| Package                                    | Shape                                                 |
| ------------------------------------------ | ----------------------------------------------------- |
| `@amplitude/plugin-session-replay-browser` | A plugin added to an existing Analytics SDK client    |
| `@amplitude/session-replay-browser`        | Standalone, for use without the Analytics Browser SDK |

`@amplitude/unified` bundles replay alongside analytics and experiment, which is the least skew-prone option on web.

Mobile replay exists for iOS, Android, and React Native, where `AmpMaskView` provides view-level masking.

**Guidelines:**

- SHOULD use the plugin when the app already runs the Analytics Browser SDK, so replay and analytics share one client, one device id, and one session.
- MUST NOT run the standalone SDK alongside the Analytics SDK expecting them to share a session; the standalone package exists for the case where analytics is absent.

## `sampleRate` Is the Whole Cost Story

`sampleRate` decides what fraction of sessions are recorded, and its behaviour differs across the three ways it gets set — which is exactly why replay integrations end up capturing either nothing or everything.

| Surface                                          | `sampleRate`                           |
| ------------------------------------------------ | -------------------------------------- |
| `@amplitude/session-replay-browser` (standalone) | Defaults to **`0`** — captures nothing |
| `@amplitude/plugin-session-replay-browser`       | Documented as **required**, no default |
| The Session Replay snippet installer             | Sets **`1`** — captures every session  |

Both ends are production incidents. A default of `0` means an integration that looks complete, passes review, and silently records nothing. A snippet-installed `1` means every session is captured and the quota is spent long before anyone checks.

**Guidelines:**

- MUST set `sampleRate` explicitly rather than relying on any default, because the defaults disagree across packages and one of them is "capture nothing".
- MUST NOT leave the snippet's `1` in place beyond testing; it captures every session and burns the replay quota.
- MUST verify after wiring replay that sessions are actually appearing in Amplitude — a zero sample rate is indistinguishable from a broken integration from inside the code.
- SHOULD prefer targeted capture over a raised blanket sample rate when the goal is to see a specific behaviour, so the quota is spent on sessions someone will watch.

## Targeted Capture

Targeted Replay Capture evaluates conditions fetched from a remote config service at runtime and begins recording when they match. There is **no lookback**: activity before the condition triggers is not in the replay.

**Guidelines:**

- MUST NOT expect a targeted replay to contain the moments leading up to its trigger; capture starts at the trigger and nothing earlier is recorded.
- SHOULD choose trigger conditions that fire before the behaviour of interest rather than on it, since the triggering moment is the first frame.

## Masking

Three privacy levels ship, with **medium** as the default:

| Level        | Masks                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| Conservative | All text and all form fields — HTML text, user input, and links          |
| Medium       | All form fields and text inputs                                          |
| Light        | A subset of sensitive inputs — passwords, credit cards, telephone, email |

Element-level controls: `.amp-mask` masks text in non-input elements, `.amp-unmask` reveals input text that would otherwise be masked, `.amp-block` hides an element as a placeholder, and `AmpMaskView` does the same job on React Native.

One limitation matters more than the levels do: **masking applies to text content and form inputs, not to HTML attribute values**. `alt`, `title`, `placeholder`, `aria-label`, `value`, and custom `data-*` attributes are not masked at any level.

**Guidelines:**

- MUST NOT assume a mask level protects data rendered into an HTML attribute; no level masks attribute values, so personal data in a `title` or `aria-label` is captured.
- SHOULD start at conservative on any surface showing personal or financial data and relax deliberately, rather than starting at the default and hoping.
- MUST use `.amp-block` for a region that should not be reconstructable at all, since masking text still preserves layout and structure.
- MUST NOT use `.amp-unmask` on a field that can contain user-entered personal data.

## Consent and Opt-Out

Session Replay follows the Analytics SDK's `optOut`, and has no separate opt-out of its own. That is convenient and it is also a trap: a consent implementation that gates _analytics_ on consent but initializes replay unconditionally has no second switch to reach for.

**Guidelines:**

- MUST gate Session Replay behind consent explicitly rather than relying on it inheriting an analytics opt-out that may be applied after initialization.
- MUST give Session Replay its own entry in the privacy review and the consent notice; recording a session is a materially different disclosure from counting an event.
- SHOULD confirm with whoever owns privacy that replay is permitted on the surfaces it is enabled for, before enabling it rather than after.

## Delivery

Replay has its own endpoints — a tracking endpoint and a config endpoint — which matters when a proxy or a content security policy is in play. **Mobile Session Replay does not support custom proxy URLs** and routes directly to Amplitude regardless of configuration.

**Guidelines:**

- MUST add the replay tracking and config endpoints to the CSP and any proxy configuration separately from the analytics endpoint.
- MUST NOT plan on proxying mobile replay traffic; it is not supported, and a proxy requirement that assumes it will not be met.
