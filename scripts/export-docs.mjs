import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse, postprocess, preprocess } from "micromark";
import { readMarkdown } from "../skills/living-project-documentation/scripts/okf.mjs";

const upstream = "https://github.com/axross/skills";
const checks = new URL(
  "../skills/living-project-documentation/scripts/",
  import.meta.url,
);

/** read Git objects without consulting the index, working files or smudge filters. */
function git(...args) {
  return execFileSync("git", args, { maxBuffer: 64 * 1024 * 1024 });
}

/**
 * index paths and object types exactly as they occur in the selected revision.
 * @throws when Git cannot read the commit or its tree.
 */
function treeAt(commit) {
  const entries = new Map();
  for (const record of git("ls-tree", "--full-tree", "-rtz", commit)
    .toString("utf8")
    .split("\0")) {
    if (!record) continue;
    const tab = record.indexOf("\t");
    const [mode, type, oid] = record.slice(0, tab).split(" ");
    entries.set(record.slice(tab + 1), { mode, type, oid });
  }
  entries.set(".", { mode: "040000", type: "tree" });
  return entries;
}

/**
 * locate Markdown destinations that leave docs/. absolute, document-local and
 * external links keep the spelling the author chose.
 * @throws for malformed percent escapes in file paths.
 */
function repositoryTarget(file, destination) {
  if (/^(?:[a-z][a-z0-9+.-]*:|[/?#])/i.test(destination)) return;
  const boundary = destination.search(/[?#]/);
  const rawPath =
    boundary === -1 ? destination : destination.slice(0, boundary);
  const suffix = destination.slice(rawPath.length);
  const path = decodeURIComponent(rawPath);
  if (!path) return;
  const target = posix.join(posix.dirname(file), path).replace(/\/$/, "");
  if (target !== "docs" && !target.startsWith("docs/"))
    return { target, suffix };
}

/** substitute only selected token ranges, leaving surrounding source bytes intact. */
function replaceDestinations(text, edits, replacement) {
  let result = "",
    cursor = 0;
  for (const edit of edits) {
    result += text.slice(cursor, edit.start) + replacement(edit);
    cursor = edit.end;
  }
  return result + text.slice(cursor);
}

/**
 * build a revision-pinned GitHub URL from the target object in the selected tree.
 * @throws for missing paths, unsupported entries and missing Markdown fragments.
 */
function publishedUrl(file, destination, target, suffix, commit, entries) {
  const entry = entries.get(target);
  if (
    !entry ||
    !(
      entry.type === "tree" ||
      entry.mode === "100644" ||
      entry.mode === "100755"
    )
  )
    throw new Error(
      `${file}: ${destination} does not name a file or directory in ${commit}`,
    );
  const fragment = suffix.indexOf("#");
  if (
    entry.type === "blob" &&
    target.toLowerCase().endsWith(".md") &&
    fragment !== -1
  ) {
    const anchor = decodeURIComponent(suffix.slice(fragment + 1));
    entry.anchors ??= readMarkdown(
      git("cat-file", "blob", entry.oid).toString("utf8"),
    ).anchors;
    if (anchor && !entry.anchors.has(anchor))
      throw new Error(
        `${file}: ${destination} has no matching fragment in ${commit}`,
      );
  }
  const encoded = target
    .split("/")
    .map((part) =>
      encodeURIComponent(part).replace(
        /[!'()*]/g,
        (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase(),
      ),
    )
    .join("/");
  return `${upstream}/${entry.type}/${commit}${target === "." ? "" : "/" + encoded}${suffix}`;
}

/**
 * pin active repository links to their blob or tree in this commit. a second
 * parse maps definitions to actual readers and excludes inert HTML content.
 * @throws if a referenced Git path is absent or cannot be published as a file or directory.
 */
function pinLinks(file, text, commit, entries) {
  const header = text.match(/^(?:\uFEFF)?---\r?\n[\s\S]*?^---\r?$(?:\n|$)/m);
  const offset = header?.index === 0 ? header[0].length : 0;
  const body = text.slice(offset);
  const events = postprocess(
    parse()
      .document()
      .write(preprocess()(body, undefined, true)),
  );
  const edits = [];
  const prefix = `export-${randomUUID()}-`;
  for (const [event, token] of events) {
    if (
      event !== "enter" ||
      !["resourceDestinationString", "definitionDestinationString"].includes(
        token.type,
      )
    )
      continue;
    const start = token.start.offset + offset;
    const end = token.end.offset + offset;
    const destination = text.slice(start, end);
    if (!/^(?:[a-z][a-z0-9+.-]*:|[/?#])/i.test(destination))
      edits.push({ start, end, destination, marker: prefix + edits.length });
  }
  if (!edits.length) return text;
  const marked = replaceDestinations(
    text,
    edits,
    (edit) => edit.marker + "/" + edit.destination,
  );
  const active = new Map();
  for (const { target } of readMarkdown(marked).links) {
    if (!target.startsWith(prefix)) continue;
    const slash = target.indexOf("/");
    active.set(target.slice(0, slash), target.slice(slash + 1));
  }
  return replaceDestinations(text, edits, ({ marker, destination }) => {
    const normalized = active.get(marker);
    const source = normalized && repositoryTarget(file, normalized);
    if (!source) return destination;
    return publishedUrl(
      file,
      destination,
      source.target,
      source.suffix,
      commit,
      entries,
    );
  });
}

/**
 * export tracked regular files from docs/ to a new directory and validate
 * the standalone result. a failed export releases only the directory it created.
 * @throws on revision, destination, link or validation errors.
 */
async function exportDocs(directory, revision) {
  const commit = git(
    "rev-parse",
    "--verify",
    "--end-of-options",
    revision + "^{commit}",
  )
    .toString()
    .trim();
  const entries = treeAt(commit);
  if (!entries.has("docs/index.md"))
    throw new Error(`no docs/index.md in ${commit}`);
  await mkdir(directory);
  try {
    for (const [file, entry] of entries) {
      if (!file.startsWith("docs/") || entry.type === "tree") continue;
      if (!["100644", "100755"].includes(entry.mode))
        throw new Error(`unsupported entry: ${file}`);
      const output = join(directory, file.slice("docs/".length));
      const bytes = git("cat-file", "blob", entry.oid);
      const contents = file.endsWith(".md")
        ? pinLinks(file, bytes.toString("utf8"), commit, entries)
        : bytes;
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, contents, { flag: "wx" });
    }
    for (const name of [
      "check-index.mjs",
      "check-references.mjs",
      "check-glossary.mjs",
    ]) {
      execFileSync(
        process.execPath,
        [fileURLToPath(new URL(name, checks)), directory],
        { stdio: "inherit" },
      );
    }
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  console.log(`Exported docs/ at ${commit} to ${directory}`);
}

const [directory, revision = "HEAD", ...extra] = process.argv.slice(2);
if (!directory || extra.length) {
  console.error(
    "Usage: node scripts/export-docs.mjs <new-directory> [revision]",
  );
  process.exitCode = 2;
} else {
  try {
    await exportDocs(resolve(directory), revision);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
