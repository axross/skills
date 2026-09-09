import { appendFile, lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { decodeRequirementsSidecar } from "./prepare-context.mjs";

const ROOT_KEYS = [
  "blocked_reason",
  "findings",
  "issue_number",
  "pull_request",
  "repository",
  "snapshot",
  "status",
];
const FINDING_KEYS = [
  "line_end",
  "line_start",
  "observed",
  "path",
  "priority",
  "requirement_ref",
  "title",
];
const STATUSES = new Set(["clean", "findings", "blocked"]);
const PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);
const BLOCKED_REASONS = new Set([
  "insufficient-static-context",
  "requirements-ambiguous",
  "patch-unreadable",
]);
const MAX_FINDINGS = 50;
const MAX_SANITIZED_BYTES = 64_000;
const MAX_RAW_RESULT_BYTES = 128_000;
const MAX_CONTEXT_BYTES = 3_000_000;
const MAX_SIDECAR_BYTES = 3_000_000;
const TOKEN_OVERLAP_LENGTH = 8;
const CHARACTER_OVERLAP_LENGTH = 60;
const REVIEW_MARKER = "<!-- codex-action-issue-sidecar-review -->";
const CONTEXT_KEYS = [
  "files",
  "issueNodeId",
  "issueNumber",
  "pullRequest",
  "repository",
  "requirementIdentifiers",
  "requirementLineCount",
  "runAttempt",
  "runId",
  "snapshot",
  "triggerActor",
  "triggerCommentId",
];
const FILE_KEYS = ["lineCount", "path", "status"];
const FILE_STATUSES = new Set([
  "added",
  "changed",
  "copied",
  "modified",
  "removed",
  "renamed",
]);

/** returns sorted own keys and rejects arrays or null. */
function objectKeys(value, error) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(error);
  }
  return Object.keys(value).sort();
}

/** requires an object to carry exactly the named properties. */
function requireKeys(value, expected, error) {
  if (JSON.stringify(objectKeys(value, error)) !== JSON.stringify(expected)) {
    throw new Error(error);
  }
}

/** requires one safe single-line string within code-point bounds. */
function requireText(value, { maximum, minimum = 1, error }) {
  if (typeof value !== "string") throw new Error(error);
  const length = [...value].length;
  if (length < minimum || length > maximum) throw new Error(error);
  if (/[\u0000-\u001f\u007f-\u009f\u2028-\u202e\u2066-\u2069]/u.test(value)) {
    throw new Error(error);
  }
}

/** normalizes text for bounded literal-overlap checks. */
function normalizeText(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/gu, " ")
    .trim();
}

/** returns normalized word-like tokens without punctuation boundaries. */
function normalizedTokens(value) {
  return normalizeText(value).match(/[\p{L}\p{N}_]+/gu) ?? [];
}

/** returns the first forbidden requirements overlap, or null when none exists. */
export function findRequirementsOverlap(candidate, requirements) {
  const requirementTokens = normalizedTokens(requirements);
  const candidateTokens = normalizedTokens(candidate);
  if (
    requirementTokens.length >= TOKEN_OVERLAP_LENGTH &&
    candidateTokens.length >= TOKEN_OVERLAP_LENGTH
  ) {
    const spans = new Set();
    for (
      let index = 0;
      index <= candidateTokens.length - TOKEN_OVERLAP_LENGTH;
      index += 1
    ) {
      spans.add(
        candidateTokens
          .slice(index, index + TOKEN_OVERLAP_LENGTH)
          .join("\u0000"),
      );
    }
    for (
      let index = 0;
      index <= requirementTokens.length - TOKEN_OVERLAP_LENGTH;
      index += 1
    ) {
      const span = requirementTokens
        .slice(index, index + TOKEN_OVERLAP_LENGTH)
        .join("\u0000");
      if (spans.has(span)) return "eight-token-overlap";
    }
  }

  const requirementCharacters = [...normalizeText(requirements)];
  const candidateCharacters = [...normalizeText(candidate)];
  if (
    requirementCharacters.length >= CHARACTER_OVERLAP_LENGTH &&
    candidateCharacters.length >= CHARACTER_OVERLAP_LENGTH
  ) {
    const spans = new Set();
    for (
      let index = 0;
      index <= candidateCharacters.length - CHARACTER_OVERLAP_LENGTH;
      index += 1
    ) {
      spans.add(
        candidateCharacters
          .slice(index, index + CHARACTER_OVERLAP_LENGTH)
          .join(""),
      );
    }
    for (
      let index = 0;
      index <= requirementCharacters.length - CHARACTER_OVERLAP_LENGTH;
      index += 1
    ) {
      const span = requirementCharacters
        .slice(index, index + CHARACTER_OVERLAP_LENGTH)
        .join("");
      if (spans.has(span)) return "sixty-character-overlap";
    }
  }
  return null;
}

/** escapes model text for fixed Markdown contexts. */
export function escapeMarkdown(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/([\\`*_{}\[\]()#+\-.!|])/gu, "\\$1")
    .replaceAll("@", "&#64;");
}

/** validates trusted review context before using it to accept model output. */
function validateContext(context) {
  requireKeys(context, CONTEXT_KEYS, "review-context-properties-invalid");
  requireText(context.repository, {
    maximum: 200,
    error: "review-context-repository-invalid",
  });
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(context.repository)) {
    throw new Error("review-context-repository-invalid");
  }
  for (const [value, error] of [
    [context.pullRequest, "review-context-pull-request-invalid"],
    [context.issueNumber, "review-context-issue-number-invalid"],
    [context.runId, "review-context-run-id-invalid"],
    [context.runAttempt, "review-context-run-attempt-invalid"],
    [context.triggerCommentId, "review-context-trigger-comment-id-invalid"],
    [context.requirementLineCount, "review-context-requirement-lines-invalid"],
  ]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(error);
  }
  requireText(context.issueNodeId, {
    maximum: 200,
    error: "review-context-issue-node-invalid",
  });
  requireText(context.triggerActor, {
    maximum: 100,
    error: "review-context-actor-invalid",
  });
  if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]*|[A-Za-z0-9-]*\[bot\])$/u.test(
      context.triggerActor,
    )
  ) {
    throw new Error("review-context-actor-invalid");
  }
  if (
    typeof context.snapshot !== "string" ||
    !/^[0-9a-f]{40}$/u.test(context.snapshot)
  ) {
    throw new Error("review-context-snapshot-invalid");
  }
  if (!Array.isArray(context.requirementIdentifiers)) {
    throw new Error("review-context-requirement-identifiers-invalid");
  }
  for (const identifier of context.requirementIdentifiers) {
    if (
      typeof identifier !== "string" ||
      !/^(?:AC|REQ)-[A-Z0-9][A-Z0-9._-]{0,63}$/u.test(identifier)
    ) {
      throw new Error("review-context-requirement-identifiers-invalid");
    }
  }
  if (
    !Array.isArray(context.files) ||
    context.files.length < 1 ||
    context.files.length > 1_000
  ) {
    throw new Error("review-context-files-invalid");
  }
  const paths = new Set();
  for (const file of context.files) {
    requireKeys(file, FILE_KEYS, "review-context-file-properties-invalid");
    requireText(file.path, {
      maximum: 500,
      error: "review-context-file-path-invalid",
    });
    if (
      file.path.startsWith("/") ||
      file.path
        .split("/")
        .some((part) => part === "" || part === "." || part === "..") ||
      paths.has(file.path)
    ) {
      throw new Error("review-context-file-path-invalid");
    }
    paths.add(file.path);
    if (!FILE_STATUSES.has(file.status))
      throw new Error("review-context-file-status-invalid");
    if (
      file.lineCount !== null &&
      (!Number.isSafeInteger(file.lineCount) || file.lineCount < 0)
    ) {
      throw new Error("review-context-file-lines-invalid");
    }
  }
}

/** validates one model result against trusted context and disclosure policy. */
export function validateResult(result, context, requirements) {
  requireKeys(result, ROOT_KEYS, "result-properties-invalid");
  if (!STATUSES.has(result.status)) throw new Error("result-status-invalid");
  if (result.repository !== context.repository)
    throw new Error("result-repository-mismatch");
  if (result.pull_request !== context.pullRequest) {
    throw new Error("result-pull-request-mismatch");
  }
  if (result.issue_number !== context.issueNumber)
    throw new Error("result-issue-mismatch");
  if (result.snapshot !== context.snapshot)
    throw new Error("result-snapshot-mismatch");
  if (
    !Array.isArray(result.findings) ||
    result.findings.length > MAX_FINDINGS
  ) {
    throw new Error("result-findings-invalid");
  }

  if (
    result.status === "clean" &&
    (result.findings.length !== 0 || result.blocked_reason !== null)
  ) {
    throw new Error("result-clean-inconsistent");
  }
  if (
    result.status === "findings" &&
    (result.findings.length === 0 || result.blocked_reason !== null)
  ) {
    throw new Error("result-findings-inconsistent");
  }
  if (
    result.status === "blocked" &&
    (result.findings.length !== 0 ||
      !BLOCKED_REASONS.has(result.blocked_reason))
  ) {
    throw new Error("result-blocked-inconsistent");
  }
  if (
    result.status !== "blocked" &&
    context.files.some((file) => file.lineCount === null)
  ) {
    throw new Error("result-static-context-incomplete");
  }

  const files = new Map(context.files.map((file) => [file.path, file]));
  const identifiers = new Set(context.requirementIdentifiers);
  const freeText = [];
  for (const finding of result.findings) {
    requireKeys(finding, FINDING_KEYS, "finding-properties-invalid");
    if (!PRIORITIES.has(finding.priority))
      throw new Error("finding-priority-invalid");
    requireText(finding.path, { maximum: 500, error: "finding-path-invalid" });
    const file = files.get(finding.path);
    if (!file || !Number.isSafeInteger(file.lineCount) || file.lineCount < 1) {
      throw new Error("finding-path-invalid");
    }
    if (
      !Number.isSafeInteger(finding.line_start) ||
      !Number.isSafeInteger(finding.line_end) ||
      finding.line_start < 1 ||
      finding.line_start > finding.line_end ||
      finding.line_end > file.lineCount
    ) {
      throw new Error("finding-lines-invalid");
    }
    requireText(finding.title, {
      maximum: 160,
      error: "finding-title-invalid",
    });
    requireText(finding.observed, {
      maximum: 600,
      error: "finding-observed-invalid",
    });
    requireText(finding.requirement_ref, {
      maximum: 64,
      minimum: 2,
      error: "finding-requirement-ref-invalid",
    });
    const locator = /^L(\d{6})$/u.exec(finding.requirement_ref);
    if (locator) {
      const line = Number(locator[1]);
      if (line < 1 || line > context.requirementLineCount) {
        throw new Error("finding-requirement-ref-invalid");
      }
    } else if (!identifiers.has(finding.requirement_ref)) {
      throw new Error("finding-requirement-ref-invalid");
    }

    freeText.push(finding.title, finding.observed);
  }
  if (findRequirementsOverlap(freeText.join("\n"), requirements)) {
    throw new Error("result-requirements-disclosure");
  }
}

/** renders only validated fields through fixed Markdown with contextual escaping. */
export function renderResult(result, context) {
  const lines = [
    REVIEW_MARKER,
    `Codex Action review: ${result.status}`,
    "",
    `Pull request: #${context.pullRequest}`,
    `Closing Issue: #${context.issueNumber}`,
    `Snapshot: ${context.snapshot}`,
    `Request: comment ${context.triggerCommentId} by ${escapeMarkdown(context.triggerActor)}`,
    `Run: ${context.runId}, attempt ${context.runAttempt}`,
  ];
  if (result.status === "blocked") {
    lines.push(`Blocked reason: ${result.blocked_reason}`);
  }
  for (const finding of result.findings) {
    lines.push(
      "",
      `${finding.priority}: ${escapeMarkdown(finding.title)}`,
      `Location: ${escapeMarkdown(finding.path)}:${finding.line_start}-${finding.line_end}`,
      `Observed: ${escapeMarkdown(finding.observed)}`,
      `Requirement: ${escapeMarkdown(finding.requirement_ref)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/** parses, validates, renders, and packages the only payload allowed into publication. */
export function sanitizeResult(rawResult, context, sidecar) {
  let result;
  try {
    result = JSON.parse(rawResult);
  } catch {
    throw new Error("result-json-invalid");
  }
  validateContext(context);
  const decoded = decodeRequirementsSidecar(sidecar);
  if (
    decoded.repository !== context.repository ||
    decoded.issueNumber !== context.issueNumber ||
    decoded.issueNodeId !== context.issueNodeId ||
    decoded.lineCount !== context.requirementLineCount
  ) {
    throw new Error("sidecar-context-mismatch");
  }
  validateResult(result, context, decoded.body);
  const body = renderResult(result, context);
  const payload = {
    marker: REVIEW_MARKER,
    repository: context.repository,
    pullRequest: context.pullRequest,
    issueNumber: context.issueNumber,
    snapshot: context.snapshot,
    runId: context.runId,
    runAttempt: context.runAttempt,
    triggerActor: context.triggerActor,
    triggerCommentId: context.triggerCommentId,
    status: result.status,
    body,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64",
  );
  if (Buffer.byteLength(encoded) > MAX_SANITIZED_BYTES) {
    throw new Error("sanitized-payload-too-large");
  }
  return encoded;
}

/** reads a bounded regular UTF-8 file without following an Action-selected symlink. */
async function readBoundedFile(path, maximum, error) {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch {
    throw new Error(error);
  }
  if (!metadata.isFile() || metadata.size > maximum) throw new Error(error);
  try {
    return await readFile(path, "utf8");
  } catch {
    throw new Error(error);
  }
}

async function main(environment = process.env) {
  const required = [
    "GITHUB_OUTPUT",
    "RESULT_FILE",
    "REVIEW_CONTEXT_FILE",
    "REQUIREMENTS_SIDECAR_FILE",
  ];
  for (const name of required) {
    if (!environment[name])
      throw new Error(`missing-${name.toLowerCase().replaceAll("_", "-")}`);
  }
  const [rawResult, contextText, sidecar] = await Promise.all([
    readBoundedFile(
      environment.RESULT_FILE,
      MAX_RAW_RESULT_BYTES,
      "result-file-invalid",
    ),
    readBoundedFile(
      environment.REVIEW_CONTEXT_FILE,
      MAX_CONTEXT_BYTES,
      "review-context-file-invalid",
    ),
    readBoundedFile(
      environment.REQUIREMENTS_SIDECAR_FILE,
      MAX_SIDECAR_BYTES,
      "requirements-sidecar-file-invalid",
    ),
  ]);
  let context;
  try {
    context = JSON.parse(contextText);
  } catch {
    throw new Error("review-context-json-invalid");
  }
  const payload = sanitizeResult(rawResult, context, sidecar);
  await appendFile(environment.GITHUB_OUTPUT, `payload=${payload}\n`, {
    encoding: "utf8",
  });
}

async function run() {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`Review validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await run();
}
