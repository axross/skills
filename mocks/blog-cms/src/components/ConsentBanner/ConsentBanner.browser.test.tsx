import * as amplitude from "@amplitude/analytics-browser";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ConsentProvider } from "../../lib/consent";
import { ConsentBanner } from "./ConsentBanner";

// @amplitude/analytics-browser is mocked globally in src/test/browser-setup.ts.

describe("ConsentBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubEnv("VITE_AMPLITUDE_API_KEY", "test-key");
  });

  it("does not initialize analytics before the visitor answers", () => {
    render(
      <ConsentProvider>
        <ConsentBanner />
      </ConsentProvider>,
    );

    expect(amplitude.init).not.toHaveBeenCalled();
  });

  it("initializes analytics only after Accept is clicked", async () => {
    render(
      <ConsentProvider>
        <ConsentBanner />
      </ConsentProvider>,
    );

    await userEvent.click(page.getByRole("button", { name: "Accept" }));

    await expect.poll(() => vi.mocked(amplitude.init).mock.calls.length).toBe(1);
  });

  it("stays uninitialized when the visitor declines", async () => {
    render(
      <ConsentProvider>
        <ConsentBanner />
      </ConsentProvider>,
    );

    await userEvent.click(page.getByRole("button", { name: "Decline" }));

    expect(amplitude.init).not.toHaveBeenCalled();
    await expect
      .element(page.getByRole("region", { name: "Cookie consent" }))
      .not.toBeInTheDocument();
  });
});
