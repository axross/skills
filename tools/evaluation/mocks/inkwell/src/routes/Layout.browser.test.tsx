import * as amplitude from "@amplitude/analytics-browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { ConsentProvider } from "../lib/consent";
import { Layout } from "./Layout";

// The shell is the one place that knows both who the author is and what the
// visitor answered, so it is where "nothing is identified before consent" is
// actually decided. @amplitude/analytics-browser is mocked globally in
// src/test/browser-setup.ts, which is what these cases assert against — a
// call reaching the SDK is the thing consent is protecting against.
vi.mock("../lib/api", () => ({
  api: {
    getAuthor: () => Promise.resolve({ id: "author_1", name: "Ada Whitfield", siteCount: 2 }),
    listSites: () =>
      Promise.resolve([
        { id: 1, name: "Acme Blog", slug: "acme", deployHookUrl: "https://hooks.example.invalid" },
      ]),
  },
}));

function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <ConsentProvider>
        <MemoryRouter initialEntries={["/sites/acme/posts"]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/sites/:siteSlug/posts" element={<p>Posts go here.</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ConsentProvider>
    </QueryClientProvider>,
  );
}

describe("Layout", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubEnv("VITE_AMPLITUDE_API_KEY", "test-key");
  });

  it("identifies nobody while the visitor has not answered the consent banner", async () => {
    renderShell();

    // The author has resolved — so nothing being sent is the consent gate,
    // not a query that never finished.
    await expect.element(page.getByText("Ada Whitfield")).toBeInTheDocument();
    expect(amplitude.setUserId).not.toHaveBeenCalled();
    expect(amplitude.identify).not.toHaveBeenCalled();
  });

  it("identifies nobody when the visitor has declined", async () => {
    window.localStorage.setItem("inkwell:consent", "denied");

    renderShell();

    await expect.element(page.getByText("Ada Whitfield")).toBeInTheDocument();
    expect(amplitude.setUserId).not.toHaveBeenCalled();
    expect(amplitude.identify).not.toHaveBeenCalled();
  });

  it("identifies the author once, when the visitor has accepted", async () => {
    window.localStorage.setItem("inkwell:consent", "granted");

    renderShell();

    await expect.poll(() => vi.mocked(amplitude.identify).mock.calls.length).toBe(1);
    expect(amplitude.setUserId).toHaveBeenCalledWith("author_1");
  });
});
