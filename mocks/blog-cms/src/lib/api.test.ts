import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

describe("api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with the parsed body on a 2xx response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([{ id: 1, slug: "acme" }]), { status: 200 }),
    );

    const sites = await api.listSites();

    expect(sites).toEqual([{ id: 1, slug: "acme" }]);
  });

  it("throws an ApiError carrying the status on a non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("Site not found.", { status: 404 }));

    let caught: unknown;
    try {
      await api.listPosts("does-not-exist");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(404);
    expect((caught as ApiError).message).toBe("Site not found.");
  });

  it("sends a save as a PUT with a JSON body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }));

    await api.savePost("acme", 1, { title: "Hi", body: "Text" });

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ title: "Hi", body: "Text" }));
  });
});
