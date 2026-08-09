import * as amplitude from "@amplitude/analytics-browser";

// The only module outside the tests that imports the Amplitude SDK —
// everything else calls through here, so consent gating, a missing key, and
// event naming are each handled in exactly one place. See lib/consent.tsx for
// what actually calls initAnalytics(): this module never checks consent
// itself.
interface Events {
  "post published": { site_slug: string; post_id: number };
  "draft saved": { site_slug: string; post_id: number };
  "Site switched": { from_site: string; to_site: string };
}

let initialized = false;

export function initAnalytics(): void {
  if (initialized) return;

  const apiKey = import.meta.env.VITE_AMPLITUDE_API_KEY;
  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.warn("VITE_AMPLITUDE_API_KEY is not set; analytics is disabled.");
    }
    return;
  }

  amplitude.init(apiKey, { autocapture: false });
  initialized = true;
}

export function trackEvent<Name extends keyof Events>(name: Name, properties: Events[Name]): void {
  if (!initialized) return;
  try {
    amplitude.track(name, properties);
  } catch {
    // Telemetry is a side effect; a failed send is never the caller's problem.
  }
}

export interface AuthorProfile {
  readonly id: string;
  readonly name: string;
  readonly siteCount: number;
}

// No caller yet: session handling lives outside this cut of the product, so
// nothing in the SPA knows who the author is. This is where the sign-in flow
// hands them over when it lands, which is why it is written and tested now
// rather than left to be invented under time pressure later.
export function identifyAuthor(author: AuthorProfile): void {
  if (!initialized) return;
  amplitude.setUserId(author.id);
  const identify = new amplitude.Identify();
  identify.set("name", author.name);
  identify.set("site_count", author.siteCount);
  amplitude.identify(identify);
}
