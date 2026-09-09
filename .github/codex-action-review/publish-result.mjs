import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { escapeMarkdown } from "./validate-result.mjs";

const REVIEW_MARKER = "<!-- codex-action-issue-sidecar-review -->";
const PUBLISHER_LOGIN = "github-actions[bot]";
const MAX_ENCODED_PAYLOAD_BYTES = 64_000;
const PAYLOAD_KEYS = [
  "body",
  "issueNumber",
  "marker",
  "pullRequest",
  "repository",
  "runAttempt",
  "runId",
  "snapshot",
  "status",
  "triggerActor",
  "triggerCommentId",
];
const STATUSES = new Set(["clean", "findings", "blocked"]);

/** decodes and validates the sanitized publisher boundary payload. */
export function decodePublisherPayload(encoded, expected) {
  if (
    typeof encoded !== "string" ||
    Buffer.byteLength(encoded) > MAX_ENCODED_PAYLOAD_BYTES ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)
  ) {
    throw new Error("publisher-payload-encoding-invalid");
  }
  let payload;
  try {
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded) {
      throw new Error("publisher-payload-encoding-invalid");
    }
    payload = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    if (error?.message === "publisher-payload-encoding-invalid") throw error;
    throw new Error("publisher-payload-json-invalid");
  }
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(PAYLOAD_KEYS)
  ) {
    throw new Error("publisher-payload-properties-invalid");
  }
  if (
    payload.repository !== expected.repository ||
    payload.pullRequest !== expected.pullRequest ||
    payload.runId !== expected.runId ||
    payload.runAttempt !== expected.runAttempt ||
    payload.triggerActor !== expected.triggerActor ||
    payload.triggerCommentId !== expected.triggerCommentId
  ) {
    throw new Error("publisher-payload-identity-mismatch");
  }
  if (
    payload.marker !== REVIEW_MARKER ||
    typeof payload.body !== "string" ||
    !payload.body.startsWith(`${REVIEW_MARKER}\n`) ||
    Buffer.byteLength(payload.body) > 64_000 ||
    !STATUSES.has(payload.status) ||
    !Number.isSafeInteger(payload.issueNumber) ||
    payload.issueNumber < 1 ||
    typeof payload.snapshot !== "string" ||
    !/^[0-9a-f]{40}$/u.test(payload.snapshot)
  ) {
    throw new Error("publisher-payload-content-invalid");
  }
  const requiredLines = [
    `Codex Action review: ${payload.status}`,
    `Pull request: #${payload.pullRequest}`,
    `Closing Issue: #${payload.issueNumber}`,
    `Snapshot: ${payload.snapshot}`,
    `Request: comment ${payload.triggerCommentId} by ${escapeMarkdown(payload.triggerActor)}`,
    `Run: ${payload.runId}, attempt ${payload.runAttempt}`,
  ];
  for (const line of requiredLines) {
    if (!payload.body.split("\n").includes(line)) {
      throw new Error("publisher-payload-content-invalid");
    }
  }
  return payload;
}

/** sends one authenticated GitHub request with fixed, non-reflecting errors. */
async function githubRequest(url, token, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers,
      },
    });
  } catch {
    throw new Error("publisher-github-unavailable");
  }
  if (!response.ok)
    throw new Error(`publisher-github-failed-${response.status}`);
  try {
    return {
      data: await response.json(),
      link: response.headers.get("link") ?? "",
    };
  } catch {
    throw new Error("publisher-github-response-invalid");
  }
}

/** finds the sole bot-owned review summary through all comment pages. */
export async function findPublishedComment({
  apiUrl,
  repository,
  pullRequest,
  token,
}) {
  const matches = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, link } = await githubRequest(
      `${apiUrl}/repos/${repository}/issues/${pullRequest}/comments?per_page=100&page=${page}`,
      token,
    );
    if (!Array.isArray(data)) throw new Error("publisher-comments-invalid");
    for (const comment of data) {
      if (
        typeof comment?.body === "string" &&
        comment.body.startsWith(`${REVIEW_MARKER}\n`)
      ) {
        if (
          comment.user?.login !== PUBLISHER_LOGIN ||
          !Number.isSafeInteger(comment.id)
        ) {
          throw new Error("publisher-comment-owner-invalid");
        }
        matches.push(comment);
      }
    }
    if (!link.includes('rel="next"')) break;
    if (page === 20) throw new Error("publisher-comments-pagination-exceeded");
  }
  if (matches.length > 1) throw new Error("publisher-comment-ambiguous");
  return matches[0] ?? null;
}

/** creates or updates the deterministic bot-owned summary and verifies stored bytes. */
export async function publishResult({ apiUrl, token, payload }) {
  const existing = await findPublishedComment({
    apiUrl,
    repository: payload.repository,
    pullRequest: payload.pullRequest,
    token,
  });
  let comment = existing;
  if (!existing) {
    ({ data: comment } = await githubRequest(
      `${apiUrl}/repos/${payload.repository}/issues/${payload.pullRequest}/comments`,
      token,
      { method: "POST", body: JSON.stringify({ body: payload.body }) },
    ));
  } else if (existing.body !== payload.body) {
    ({ data: comment } = await githubRequest(
      `${apiUrl}/repos/${payload.repository}/issues/comments/${existing.id}`,
      token,
      { method: "PATCH", body: JSON.stringify({ body: payload.body }) },
    ));
  }
  if (
    !Number.isSafeInteger(comment?.id) ||
    comment.user?.login !== PUBLISHER_LOGIN ||
    comment.body !== payload.body
  ) {
    throw new Error("publisher-comment-verification-failed");
  }

  const { data: stored } = await githubRequest(
    `${apiUrl}/repos/${payload.repository}/issues/comments/${comment.id}`,
    token,
  );
  if (
    stored?.user?.login !== PUBLISHER_LOGIN ||
    stored?.body !== payload.body
  ) {
    throw new Error("publisher-comment-readback-failed");
  }
  return { commentId: comment.id, updated: existing?.body !== payload.body };
}

async function main(environment = process.env) {
  const required = [
    "GITHUB_API_URL",
    "GITHUB_REPOSITORY",
    "GITHUB_RUN_ATTEMPT",
    "GITHUB_RUN_ID",
    "GITHUB_TOKEN",
    "PR_NUMBER",
    "SANITIZED_PAYLOAD",
    "TRIGGER_ACTOR",
    "TRIGGER_COMMENT_ID",
  ];
  for (const name of required) {
    if (!environment[name])
      throw new Error(`missing-${name.toLowerCase().replaceAll("_", "-")}`);
  }
  const payload = decodePublisherPayload(environment.SANITIZED_PAYLOAD, {
    repository: environment.GITHUB_REPOSITORY,
    pullRequest: Number(environment.PR_NUMBER),
    runId: Number(environment.GITHUB_RUN_ID),
    runAttempt: Number(environment.GITHUB_RUN_ATTEMPT),
    triggerActor: environment.TRIGGER_ACTOR,
    triggerCommentId: Number(environment.TRIGGER_COMMENT_ID),
  });
  await publishResult({
    apiUrl: environment.GITHUB_API_URL,
    token: environment.GITHUB_TOKEN,
    payload,
  });
}

async function run() {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`Review publication failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await run();
}
