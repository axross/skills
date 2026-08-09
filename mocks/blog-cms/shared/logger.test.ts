import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger";

describe("createLogger", () => {
  it("suppresses debug lines below the configured threshold", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logger = createLogger("test", "info");

    logger.debug({}, "should not appear");

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs at or above the threshold", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = createLogger("test", "info");

    logger.warn({ code: 42 }, "a recoverable condition");

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("child loggers extend the module name", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger("root", "info").child("api");

    logger.info({}, "hello");

    const [line] = spy.mock.calls[0] as [{ module: string }];
    expect(line.module).toBe("root:api");
    spy.mockRestore();
  });

  it("carries the message and context through to the console call", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger("root", "debug");

    logger.error({ postId: 7 }, "failed to publish");

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error", postId: 7, message: "failed to publish" }),
    );
    spy.mockRestore();
  });
});
