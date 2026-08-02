#!/usr/bin/env node
// A stand-in for the reviewer's inline-comment tool that records instead of posting.
//
// WHY A STUB RATHER THAN READING THE PROSE. A review names files it approves of
// as readily as files it faults: the review that missed #166's duplication says
// "module mocking's 'mock only what is slow...' explicitly defers to
// unit-testing", naming the one file it got right. Scoring on mentions would
// count that as a hit on the defect it missed, so the metric has to be the
// ANCHOR a finding is attached to, not the path a sentence contains.
//
// Anchors exist only as calls to the inline-comment tool, and the real one posts
// to GitHub. This server exposes a tool of the same name that appends each call
// to a JSONL file and returns success, so a probe behaves exactly as the CI
// reviewer does while nothing leaves the machine. Load it with BOTH
// `--mcp-config` and `--strict-mcp-config`: without the second flag the session's
// real GitHub server stays available and a probe can post for real.
//
// Anchors are recovered from the stream's tool_use blocks rather than from this
// file; the recording is the cross-check that the stream was read correctly, and
// the reason a probe killed mid-turn still yields the anchors it managed to emit.

import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const RECORD_PATH = process.env.REVIEW_EVAL_ANCHOR_LOG;
if (!RECORD_PATH) {
  process.stderr.write("REVIEW_EVAL_ANCHOR_LOG must name the file to record anchors into.\n");
  process.exit(1);
}

/** The tool the reviewer workflow grants, named exactly as the real one is. */
const TOOL = {
  name: "create_inline_comment",
  description:
    "Post an inline review comment anchored to a line of the diff. Use this for every finding.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Repository-relative path of the file being commented on" },
      line: { type: "number", description: "Line number in the file the finding anchors to" },
      body: { type: "string", description: "The finding text" },
    },
    required: ["path", "body"],
  },
};

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

createInterface({ input: process.stdin }).on("line", (line) => {
  const text = line.trim();
  if (text === "") return;

  let request;
  try {
    request = JSON.parse(text);
  } catch {
    return;
  }

  // A notification carries no id and takes no response.
  if (request.id === undefined) return;

  switch (request.method) {
    case "initialize":
      reply(request.id, {
        // Echo the client's version rather than pinning one, so a CLI upgrade
        // that moves the protocol forward does not silently fail to connect.
        protocolVersion: request.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "review-eval-anchor-recorder", version: "1.0.0" },
      });
      return;

    case "tools/list":
      reply(request.id, { tools: [TOOL] });
      return;

    case "tools/call": {
      const args = request.params?.arguments ?? {};
      appendFileSync(
        RECORD_PATH,
        `${JSON.stringify({ path: args.path ?? null, line: args.line ?? null, body: args.body ?? "" })}\n`,
      );
      reply(request.id, {
        content: [{ type: "text", text: "Comment recorded." }],
      });
      return;
    }

    default:
      // Unknown methods are answered rather than dropped: an unanswered request
      // leaves the client waiting for a reply that never arrives.
      reply(request.id, {});
  }
});
