import { afterEach, describe, expect, it, vi } from "vitest";

import { encodeRequirementsSidecar } from "../../.github/codex-action-review/prepare-context.mjs";
import {
  decodePublisherPayload,
  findPublishedComment,
  publishResult,
} from "../../.github/codex-action-review/publish-result.mjs";
import { sanitizeResult } from "../../.github/codex-action-review/validate-result.mjs";

const SNAPSHOT = "0123456789abcdef0123456789abcdef01234567";
const CONTEXT = {
  repository: "axross/skills",
  pullRequest: 42,
  issueNumber: 564,
  issueNodeId: "I_kwDOExample",
  snapshot: SNAPSHOT,
  runId: 123456,
  runAttempt: 2,
  triggerActor: "axross",
  triggerCommentId: 987654,
  requirementLineCount: 1,
  requirementIdentifiers: ["REQ-7"],
  files: [{ path: "src/account-state.mjs", status: "modified", lineCount: 80 }],
};
const RESULT = {
  status: "clean",
  repository: "axross/skills",
  pull_request: 42,
  issue_number: 564,
  snapshot: SNAPSHOT,
  findings: [],
  blocked_reason: null,
};
const EXPECTED = {
  repository: "axross/skills",
  pullRequest: 42,
  runId: 123456,
  runAttempt: 2,
  triggerActor: "axross",
  triggerCommentId: 987654,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(data, { headers = {}, status = 200 } = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json", ...headers },
    status,
  });
}

function encodedPayload(context = CONTEXT) {
  const sidecar = encodeRequirementsSidecar({
    repository: context.repository,
    issueNumber: context.issueNumber,
    issueNodeId: context.issueNodeId,
    body: "REQ-7 Keep the account state stable.",
  });
  return sanitizeResult(JSON.stringify(RESULT), context, sidecar);
}

function payload() {
  return decodePublisherPayload(encodedPayload(), EXPECTED);
}

function comment(id, body = payload().body, login = "github-actions[bot]") {
  return { id, body, user: { login } };
}

describe("decodePublisherPayload()", () => {
  it("accepts the validator's exact sanitized boundary payload", () => {
    expect(decodePublisherPayload(encodedPayload(), EXPECTED)).toMatchObject({
      repository: "axross/skills",
      pullRequest: 42,
      issueNumber: 564,
      runId: 123456,
      runAttempt: 2,
      status: "clean",
    });
  });

  it("rejects a payload replayed for another workflow attempt", () => {
    expect(() =>
      decodePublisherPayload(encodedPayload(), { ...EXPECTED, runAttempt: 3 }),
    ).toThrow("publisher-payload-identity-mismatch");
  });

  it("rejects noncanonical base64 rather than accepting ambiguous bytes", () => {
    expect(() =>
      decodePublisherPayload(`${encodedPayload()}=`, EXPECTED),
    ).toThrow("publisher-payload-encoding-invalid");
  });

  it("rejects an oversized encoded payload before decoding it", () => {
    expect(() => decodePublisherPayload("A".repeat(64_004), EXPECTED)).toThrow(
      "publisher-payload-encoding-invalid",
    );
  });

  it("rejects body metadata that disagrees with the envelope", () => {
    const decoded = payload();
    decoded.body = decoded.body.replace(
      "Run: 123456, attempt 2",
      "Run: 999, attempt 1",
    );
    const encoded = Buffer.from(JSON.stringify(decoded)).toString("base64");

    expect(() => decodePublisherPayload(encoded, EXPECTED)).toThrow(
      "publisher-payload-content-invalid",
    );
  });

  it("accepts escaped metadata for one explicitly admitted bot actor", () => {
    const context = { ...CONTEXT, triggerActor: "review-app[bot]" };
    const expected = { ...EXPECTED, triggerActor: "review-app[bot]" };

    expect(
      decodePublisherPayload(encodedPayload(context), expected).body,
    ).toContain("Request: comment 987654 by review\\-app\\[bot\\]");
  });
});

describe("findPublishedComment()", () => {
  it("paginates to the sole bot-owned marker", async () => {
    const target = comment(22);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([{ id: 1, body: "ordinary", user: { login: "axross" } }], {
          headers: { link: '<https://api.github.test/page=2>; rel="next"' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse([target]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      findPublishedComment({
        apiUrl: "https://api.github.test",
        repository: "axross/skills",
        pullRequest: 42,
        token: "test-token",
      }),
    ).resolves.toEqual(target);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a marker posted by another identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse([comment(22, payload().body, "axross")]),
        ),
    );

    await expect(
      findPublishedComment({
        apiUrl: "https://api.github.test",
        repository: "axross/skills",
        pullRequest: 42,
        token: "test-token",
      }),
    ).rejects.toThrow("publisher-comment-owner-invalid");
  });

  it("rejects duplicate bot-owned markers instead of updating an arbitrary comment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse([comment(22), comment(23)])),
    );

    await expect(
      findPublishedComment({
        apiUrl: "https://api.github.test",
        repository: "axross/skills",
        pullRequest: 42,
        token: "test-token",
      }),
    ).rejects.toThrow("publisher-comment-ambiguous");
  });
});

describe("publishResult()", () => {
  it("creates one summary and verifies it through a separate read", async () => {
    const candidate = payload();
    const stored = comment(31, candidate.body);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(stored))
      .mockResolvedValueOnce(jsonResponse(stored));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishResult({
        apiUrl: "https://api.github.test",
        token: "test-token",
        payload: candidate,
      }),
    ).resolves.toEqual({ commentId: 31, updated: true });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ body: candidate.body }),
    });
  });

  it("updates the existing summary for a new correlated run", async () => {
    const candidate = payload();
    const previous = comment(31, `${candidate.marker}\nold run\n`);
    const stored = comment(31, candidate.body);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([previous]))
      .mockResolvedValueOnce(jsonResponse(stored))
      .mockResolvedValueOnce(jsonResponse(stored));
    vi.stubGlobal("fetch", fetchMock);

    await publishResult({
      apiUrl: "https://api.github.test",
      token: "test-token",
      payload: candidate,
    });

    expect(fetchMock.mock.calls[1][0]).toContain("/issues/comments/31");
    expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
  });

  it("does not rewrite an already identical result", async () => {
    const candidate = payload();
    const stored = comment(31, candidate.body);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([stored]))
      .mockResolvedValueOnce(jsonResponse(stored));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishResult({
        apiUrl: "https://api.github.test",
        token: "test-token",
        payload: candidate,
      }),
    ).resolves.toEqual({ commentId: 31, updated: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails when read-back bytes differ after a nominally successful write", async () => {
    const candidate = payload();
    const stored = comment(31, candidate.body);
    const changed = comment(31, `${candidate.marker}\nchanged after write\n`);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(stored))
      .mockResolvedValueOnce(jsonResponse(changed));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishResult({
        apiUrl: "https://api.github.test",
        token: "test-token",
        payload: candidate,
      }),
    ).rejects.toThrow("publisher-comment-readback-failed");
  });
});
