import * as amplitude from "@amplitude/analytics-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { identifyAuthor, initAnalytics, trackEvent } from "./analytics";

vi.mock("@amplitude/analytics-browser", () => ({
  init: vi.fn(),
  track: vi.fn(),
  setUserId: vi.fn(),
  identify: vi.fn(),
  Identify: class {
    set = vi.fn();
  },
}));

describe("analytics", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_AMPLITUDE_API_KEY", "test-key");
    vi.clearAllMocks();
  });

  it("does not track before initAnalytics has run", () => {
    trackEvent("draft saved", { site_slug: "acme", post_id: 1 });

    expect(amplitude.track).not.toHaveBeenCalled();
  });

  it("initializes once with the configured key", () => {
    initAnalytics();
    initAnalytics();

    expect(amplitude.init).toHaveBeenCalledTimes(1);
    expect(amplitude.init).toHaveBeenCalledWith("test-key", { autocapture: false });
  });

  it("tracks an event by its exact name and payload once initialized", () => {
    initAnalytics();

    trackEvent("post published", { site_slug: "acme", post_id: 7 });

    expect(amplitude.track).toHaveBeenCalledWith("post published", {
      site_slug: "acme",
      post_id: 7,
    });
  });

  it("sets the user id and identify properties for the signed-in author", () => {
    initAnalytics();

    identifyAuthor({ id: "author_1", name: "Ada", siteCount: 3 });

    expect(amplitude.setUserId).toHaveBeenCalledWith("author_1");
    expect(amplitude.identify).toHaveBeenCalled();
  });
});
