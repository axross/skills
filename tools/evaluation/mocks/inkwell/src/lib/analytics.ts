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
// The shell can learn who the author is before the visitor has answered the
// consent banner, and React runs the shell's effects before the provider's.
// Holding the author here rather than dropping it means the identify still
// happens, and still only once the SDK has actually started.
let pendingAuthor: AuthorProfile | null = null;

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

  if (pendingAuthor) {
    const author = pendingAuthor;
    pendingAuthor = null;
    identifyAuthor(author);
  }
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

// Called from the shell once the visitor has accepted analytics and the
// author has resolved — see routes/Layout.tsx. Nothing here checks consent:
// the SDK is only ever started from lib/consent.tsx, so an author handed over
// before that is held above rather than sent.
export function identifyAuthor(author: AuthorProfile): void {
  if (!initialized) {
    pendingAuthor = author;
    return;
  }
  amplitude.setUserId(author.id);
  const identify = new amplitude.Identify();
  identify.set("name", author.name);
  identify.set("site_count", author.siteCount);
  amplitude.identify(identify);
}
