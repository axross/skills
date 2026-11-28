import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, opendir, readFile, realpath, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import {
  loadDocs,
  resolveLink,
} from "../../../../../skills/living-project-documentation/scripts/docs.mjs";
import { readMarkdown } from "../../../../../skills/living-project-documentation/scripts/okf.mjs";

const upstreamCommit = "99e6407460d4e477a1a0690e40bee8f7079acbf2";
const sources = [
  {
    path: "server/app.ts",
    statements: [".orderBy(desc(revisions.createdAt), desc(revisions.id))"],
  },
  {
    path: "src/routes/RevisionsPage.tsx",
    statements: [
      "for (const revision of revisions)",
      "group.revisions.push(revision)",
      "revisions: [revision]",
    ],
  },
];
const sourceCallers = [
  "server/app.ts",
  "server/db/queries.test.ts",
  "vite.config.ts",
];

async function readExport(workspace) {
  const root = join(workspace, "docs");
  const files = new Map();
  let bytes = 0,
    entries = 0;
  const entry = await lstat(root).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (!entry) return files;
  if (!entry.isDirectory())
    throw new Error("docs must be a directory in the reconstructed workspace");
  async function visit(path, ancestors) {
    if (++entries > 192)
      throw new Error("manual inventory exceeds 192 entries");
    const actual = await realpath(path);
    if (actual !== root && !actual.startsWith(root + sep))
      throw new Error("exported entry leaves docs: " + relative(root, path));
    const info = await stat(actual);
    if (info.isDirectory()) {
      if (ancestors.includes(actual))
        throw new Error("cyclic export directory: " + relative(root, path));
      for await (const entry of await opendir(actual))
        await visit(join(path, entry.name), [...ancestors, actual]);
    } else {
      if (!info.isFile())
        throw new Error("unsupported export entry: " + relative(root, path));
      bytes += info.size;
      if (bytes > 64 * 1024) throw new Error("export exceeds 64 KiB");
      const data = await readFile(actual);
      const key = relative(workspace, path).split(sep).join("/");
      files.set(
        key,
        data.includes(0)
          ? {
              kind: "binary; contents not inspected",
              bytes: data.length,
              sha256: createHash("sha256").update(data).digest("hex"),
            }
          : data.toString("utf8"),
      );
    }
  }
  await visit(root, []);
  return files;
}

async function currentFile(workspace, name) {
  const path = join(workspace, name);
  try {
    if ((await realpath(path)) !== path)
      throw new Error("indirect caller outside its declared location: " + name);
    const info = await stat(path);
    if (!info.isFile() || info.size > 32 * 1024)
      throw new Error("unsupported caller: " + name);
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function linksFrom(workspace, path, text, docs) {
  if (typeof text !== "string") return [];
  const lines = text.split("\n");
  const links = readMarkdown(text, "type", { wholeRoot: true }).links;
  const resolved = [];
  for (const link of links) {
    const target = docs
      ? await resolveLink(docs, { path: join(workspace, path) }, link.target)
      : {};
    const landed = target.page?.path ?? target.path;
    resolved.push({
      line: link.line,
      context: lines[link.line - 1],
      target: link.target,
      error: target.error,
      file: landed && relative(workspace, landed).split(sep).join("/"),
      fragment: target.fragment,
      exists:
        !!landed &&
        (!target.fragment ||
          target.page?.anchors.has(target.fragment) === true),
    });
  }
  return resolved;
}

async function exportedPaths(workspace, docs, files) {
  const unresolved = [];
  const reachable = new Set();
  const pending = ["docs/index.md"];
  while (pending.length) {
    const path = pending.pop();
    if (!files.has(path) || reachable.has(path)) continue;
    reachable.add(path);
    if (!path.endsWith(".md")) continue;
    for (const link of await linksFrom(
      workspace,
      path,
      files.get(path),
      docs,
    )) {
      if (link.exists) pending.push(link.file);
      else
        unresolved.push({ from: path, line: link.line, target: link.target });
    }
  }
  return { reachable: [...reachable].sort(), unresolved };
}

async function verifiedSources(workspace, files, reachable) {
  const result = [];
  const checkout = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: workspace,
    encoding: "utf8",
  }).trim();
  const knownBlobs = [];
  for (const source of sources) {
    const text = await readFile(
      new URL("../../../mocks/inkwell/" + source.path, import.meta.url),
      "utf8",
    );
    const blob = createHash("sha1")
      .update("blob " + Buffer.byteLength(text) + "\0" + text)
      .digest("hex");
    const canonicalCheckoutBlob = execFileSync(
      "git",
      ["rev-parse", "HEAD:" + source.path],
      { cwd: workspace, encoding: "utf8" },
    ).trim();
    const lines = text.split("\n");
    knownBlobs.push(blob);
    const matches = [];
    for (const path of reachable) {
      const document = files.get(path);
      if (typeof document !== "string") continue;
      if (document === text) {
        matches.push({
          document: path,
          source: source.path,
          blob,
          kind: "whole source",
        });
      } else if (document.includes(source.path)) {
        const revision = [
          blob,
          upstreamCommit,
          ...(canonicalCheckoutBlob === blob ? [checkout] : []),
        ].find((id) => document.includes(id));
        if (revision) {
          const citedLines = lines.flatMap((line, index) => {
            const code = line.trim();
            return code.length >= 15 &&
              !code.startsWith("//") &&
              document.includes(code)
              ? [index + 1]
              : [];
          });
          if (citedLines.length)
            matches.push({
              document: path,
              source: source.path,
              revision,
              citedLines,
              kind: "matching source lines",
            });
        }
      }
      for (const match of document.matchAll(/https?:\/\/[^\s)"'<>\]]+/g)) {
        const url = URL.parse(match[0]);
        if (!url) continue;
        const prefix =
          url.hostname === "github.com"
            ? "/axross/skills/(?:blob|raw)/"
            : url.hostname === "raw.githubusercontent.com"
              ? "/axross/skills/"
              : null;
        if (!prefix) continue;
        const pin = url.pathname.match(
          new RegExp(
            "^" +
              prefix +
              "([a-f0-9]{40})/tools/evaluation/mocks/inkwell/(.+)$",
          ),
        );
        if (!pin || pin[2] !== source.path) continue;
        const range = url.hash.match(/^#L(\d+)(?:-L(\d+))?$/);
        const start = range && Number(range[1]);
        const end = range && Number(range[2] ?? range[1]);
        const sample = !url.hash
          ? text
          : start >= 1 && end >= start && end <= lines.length
            ? lines.slice(start - 1, end).join("\n")
            : "";
        const status =
          pin[1] !== upstreamCommit
            ? "unverified revision"
            : sample
              ? "verified source"
              : "invalid source range";
        matches.push({
          document: path,
          url: url.href,
          revision: pin[1],
          status,
          sourceLines:
            status === "verified source"
              ? source.statements.filter((statement) =>
                  sample.includes(statement),
                )
              : [],
          kind: "upstream locator",
        });
      }
    }
    result.push({ source: source.path, matches });
  }
  for (const { matches } of result) {
    for (const match of matches) {
      if (
        match.kind === "upstream locator" &&
        knownBlobs.includes(match.revision)
      )
        match.status = "file blob used as a commit";
    }
  }
  return result;
}

export async function outcomeView(workspace, factorId) {
  const root = await realpath(workspace);
  const files = await readExport(root);
  const readme = await currentFile(root, "README.md");
  const agents = await currentFile(root, "AGENTS.md");
  const callers = {};
  for (const path of sourceCallers) {
    const text = await currentFile(root, path);
    callers[path] =
      factorId === "preserves-the-card-and-updates-current-callers"
        ? text
        : (text?.split("\n").filter((line) => /docs\/|\.md\b/.test(line)) ??
          null);
  }
  const docs = files.size
    ? await loadDocs(join(root, "docs"), root, { wholeRoot: true })
    : null;
  const { reachable, unresolved } = await exportedPaths(root, docs, files);
  const material = {
    published: Object.fromEntries(
      [...files].sort(([left], [right]) => left.localeCompare(right)),
    ),
    reachableFromIndex: reachable,
    unresolvedPublishedLinks: unresolved,
    currentCallers: { "README.md": readme, "AGENTS.md": agents, ...callers },
    readmeLandings: (await linksFrom(root, "README.md", readme, docs)).filter(
      (link) =>
        link.file?.startsWith("docs/") || /^(?:\.\/)?docs\//.test(link.target),
    ),
    indexChoices: await linksFrom(
      root,
      "docs/index.md",
      files.get("docs/index.md"),
      docs,
    ),
  };
  if (factorId === "preserves-the-card-and-updates-current-callers") {
    const git = (args) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8" });
    const original = git([
      "ls-tree",
      "-r",
      "--name-only",
      "-z",
      "HEAD",
      "docs",
    ]).split("\0");
    material.originalPublishedEntries = original
      .filter((path) => path.endsWith(".md"))
      .map((path) => ({
        path,
        anchors: [...readMarkdown(git(["show", "HEAD:" + path])).anchors],
      }));
  }
  if (factorId === "supplies-inspectable-ordering-evidence")
    material.sourceChecks = await verifiedSources(root, files, reachable);
  return material;
}
