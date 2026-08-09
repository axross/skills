import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { triggerDeployHook } from "./deploy-hook";

describe("triggerDeployHook", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("succeeds on the first attempt", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    const result = await triggerDeployHook("acme", "https://hooks.example.invalid/deploy/acme");

    expect(result).toEqual({ ok: true, attempts: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries once after a network failure and then succeeds", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await triggerDeployHook("acme", "https://hooks.example.invalid/deploy/acme");

    expect(result).toEqual({ ok: true, attempts: 2 });
  });

  it("treats a non-2xx response as a failure worth retrying", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await triggerDeployHook("acme", "https://hooks.example.invalid/deploy/acme");

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("gives up after exhausting every retry", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    const result = await triggerDeployHook("acme", "https://hooks.example.invalid/deploy/acme");

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
